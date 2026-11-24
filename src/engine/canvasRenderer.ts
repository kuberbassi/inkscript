import { SHEET_GEOMETRY, STENCIL_COLORS } from '../constants/studioTokens';
import { GeneratedPage, StudioSettings } from '../types/studio';
import { HandwritingHumanizer } from './humanizer';
import { extractLogicalUnits, joinLogicalLines } from './markdownParser';
import { SeededRandom } from './prng';
import {
  buildPerturbedGlyphPath,
  ensureVectorFontLoaded,
  getCachedVectorFont
} from './vectorFontEngine';

const PAGE_WIDTH = SHEET_GEOMETRY.WIDTH_PX;
const PAGE_HEIGHT = SHEET_GEOMETRY.HEIGHT_PX;

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

function parseHexColor(hex: string): RGBColor | null {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16)
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }
  return null;
}

/**
 * Produces subtle ballpoint/gel ink tonal shifts (brighter cobalt on light glides,
 * deeper indigo on firm downstrokes) so color inkjet prints look like real pen ink
 * rather than a flat uniform digital hex fill.
 */
function getTonalInkColor(
  baseRgb: RGBColor | null,
  fallbackHex: string,
  opacity: number,
  realismEff: number
): string {
  if (!baseRgb || realismEff <= 0) return fallbackHex;
  // Center around normal opacity (~0.87): lower opacity -> slightly brighter/airier; higher -> richer/deeper
  const delta = Math.round((0.87 - opacity) * 95 * Math.min(1.2, realismEff));
  const r = Math.max(0, Math.min(255, baseRgb.r + delta));
  const g = Math.max(0, Math.min(255, baseRgb.g + Math.round(delta * 1.05)));
  const b = Math.max(0, Math.min(255, baseRgb.b + Math.round(delta * 1.15)));
  return `rgb(${r}, ${g}, ${b})`;
}

let cachedInkGrainCanvas: HTMLCanvasElement | null = null;

/**
 * Generates a lightweight 64x64 procedural ballpoint/paper micro-grain tile once.
 * Used with destination-out at very low alpha (0.04-0.08) so ink has organic paper-fiber texture.
 */
function getInkGrainTile(): HTMLCanvasElement {
  if (cachedInkGrainCanvas) return cachedInkGrainCanvas;
  const tile = document.createElement('canvas');
  tile.width = 64;
  tile.height = 64;
  const tctx = tile.getContext('2d')!;
  const imgData = tctx.createImageData(64, 64);
  const d = imgData.data;
  const rng = new SeededRandom(918273);
  for (let i = 0; i < d.length; i += 4) {
    const v = rng.next();
    // Sparse micro-pores where paper tooth catches slightly less ink
    const alpha = v > 0.72 ? Math.round((v - 0.72) * 280) : 0;
    d[i] = 0;
    d[i + 1] = 0;
    d[i + 2] = 0;
    d[i + 3] = alpha;
  }
  tctx.putImageData(imgData, 0, 0);
  cachedInkGrainCanvas = tile;
  return tile;
}

function isHeadingBlock(blockHTML: string): boolean {
  if (/data-hw-heading="true"/.test(blockHTML)) return true;
  const plain = blockHTML
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  if (!plain) return false;
  // Q1. / Q2. / Question 1:
  if (/^Q\d+[.):]\s+\S+/i.test(plain) && plain.length < 110) {
    return true;
  }
  // Short label lines like "Program:", "Output:", "Conclusion:", "Main features of OOP:"
  if (/^[A-Z][a-zA-Z0-9\s-]{1,42}:$/.test(plain)) {
    return true;
  }
  if (
    /^\d+[.)]\s+\S+/.test(plain) &&
    plain.length < 58 &&
    !/\.$/.test(plain)
  ) {
    return true;
  }
  if (/^#[#\s]*/.test(plain) && plain.length < 48) {
    return true;
  }
  return false;
}

function isCodeBlock(blockHTML: string): boolean {
  return (
    /class="[^"]*hw-code-block/.test(blockHTML) ||
    /data-hw-code="true"/.test(blockHTML) ||
    /^<pre\b/i.test(blockHTML.trim())
  );
}

function isTableBlock(blockHTML: string): boolean {
  return /<table\b/i.test(blockHTML);
}

function isBlankBlock(blockHTML: string): boolean {
  const plain = blockHTML
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return plain.length === 0 && !/<img\b/i.test(blockHTML);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function applyScannerContrast(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  contrast = 0.55
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = factor * (data[i] - 128) + 128;
    data[i + 1] = factor * (data[i + 1] - 128) + 128;
    data[i + 2] = factor * (data[i + 2] - 128) + 128;
  }
  ctx.putImageData(imageData, 0, 0);
}

function hasAncestorTag(
  node: Node,
  rootEl: HTMLElement,
  tags: string[]
): boolean {
  let cur = node.parentNode as HTMLElement | null;
  while (cur && cur !== rootEl && cur.nodeType === Node.ELEMENT_NODE) {
    if (tags.includes(cur.tagName.toLowerCase())) {
      return true;
    }
    cur = cur.parentNode as HTMLElement | null;
  }
  return false;
}

function hasAncestorClass(
  node: Node,
  rootEl: HTMLElement,
  className: string
): boolean {
  let cur = node.parentNode as HTMLElement | null;
  while (cur && cur !== rootEl && cur.nodeType === Node.ELEMENT_NODE) {
    if (cur.classList && cur.classList.contains(className)) {
      return true;
    }
    cur = cur.parentNode as HTMLElement | null;
  }
  return false;
}

/**
 * Draws a slightly hand-sketched straight line (for table dividers, underlines, strikethroughs)
 * using quadratic Bezier segments with organic pen wobble.
 */
function strokeHandDrawnLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rng: SeededRandom,
  wobbleAmp: number,
  stepPx = 18
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;

  const steps = Math.max(2, Math.round(dist / stepPx));
  // Perpendicular unit vector
  const nx = -dy / dist;
  const ny = dx / dist;

  ctx.beginPath();
  ctx.moveTo(x1, y1);

  if (wobbleAmp <= 0.02) {
    ctx.lineTo(x2, y2);
    ctx.stroke();
    return;
  }

  let prevX = x1;
  let prevY = y1;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const isEnd = i === steps;
    const edgeFade = Math.sin(t * Math.PI);
    const offset = isEnd
      ? rng.uniform(-wobbleAmp * 0.35, wobbleAmp * 0.35)
      : rng.uniform(-wobbleAmp, wobbleAmp) * (0.45 + 0.55 * edgeFade);
    const ptX = x1 + dx * t + nx * offset;
    const ptY = y1 + dy * t + ny * offset;

    const midX = (prevX + ptX) * 0.5;
    const midY = (prevY + ptY) * 0.5;
    ctx.quadraticCurveTo(prevX, prevY, midX, midY);
    prevX = ptX;
    prevY = ptY;
  }
  ctx.lineTo(prevX, prevY);
  ctx.stroke();
}

export interface SheetRenderOptions {
  /** Override export scale (e.g., 1.5-2 for fast live preview overlay) */
  scaleOverride?: number;
  /** Vertical scroll offset of pageEl when rendering live preview viewport */
  scrollTop?: number;
  /** Optional target canvas to draw directly into (avoids reallocating for live preview) */
  targetCanvas?: HTMLCanvasElement;
}

/**
 * Snaps every table and embedded image inside paperContentEl so its total occupied height
 * (height + marginBottom) is an exact integer multiple of lineGapPx.
 * Prevents cumulative vertical baseline drift on ruled sheets as you scroll past tables/images.
 */
export function snapBlocksToRuledGrid(
  paperContentEl: HTMLElement,
  lineGapPx: number,
  scaleFactorY = 1
): void {
  if (!lineGapPx || lineGapPx < 8) return;
  const gridBlocks = Array.from(
    paperContentEl.querySelectorAll<HTMLElement>('table.hw-table, table, img')
  );
  for (const el of gridBlocks) {
    el.style.marginBottom = '0px';
    const rawH = el.getBoundingClientRect().height * scaleFactorY;
    if (rawH <= 0) continue;
    const rem = rawH % lineGapPx;
    if (rem > 0.35 && rem < lineGapPx - 0.35) {
      el.style.marginBottom = `${(lineGapPx - rem).toFixed(2)}px`;
    }
  }
}

/**
 * Direct HTML5 Canvas 2D Vector Page Renderer (Tier 1 + Tier 2 opentype.js)
 * Renders ruled lines, independent margins, grid-locked hand-drawn tables,
 * Bezier-perturbed vector glyphs, hand-drawn underlines, and organic ink grain.
 */
export async function renderCurrentSheetToCanvas(
  pageEl: HTMLElement,
  paperContentEl: HTMLElement,
  settings: StudioSettings,
  exactLineHeightPx: number,
  pageSeed: number,
  options: SheetRenderOptions = {}
): Promise<HTMLCanvasElement> {
  const scale = options.scaleOverride || settings.exportScale || 4;
  const scrollTop = options.scrollTop ?? 0;

  const fontFamily = settings.customFontName
    ? `'${settings.customFontName}', cursive`
    : settings.handwritingFont;

  // Preload Tier 2 vector font(s) if realism is active
  if (settings.realismIntensity > 0) {
    const preloadTasks: Promise<unknown>[] = [
      ensureVectorFontLoaded(fontFamily)
    ];
    if (
      fontFamily.includes('Cedarville Cursive') &&
      !fontFamily.includes('Cedarville Classic')
    ) {
      preloadTasks.push(ensureVectorFontLoaded("'Caveat', cursive"));
    }
    await Promise.all(preloadTasks);
  }

  const canvas = options.targetCanvas || document.createElement('canvas');
  const targetW = Math.round(PAGE_WIDTH * scale);
  const targetH = Math.round(PAGE_HEIGHT * scale);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, targetW, targetH);
  ctx.save();
  ctx.scale(scale, scale);

  // 1. Page Background (Clean White or Uploaded Custom Sheet Image)
  ctx.fillStyle = STENCIL_COLORS.PAPER_BG;
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  if (settings.customPaperBgUrl) {
    try {
      const bgImg = await loadImage(settings.customPaperBgUrl);
      ctx.drawImage(bgImg, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    } catch {
      // Fallback to white background if custom image fails
    }
  }

  const lineGap = Math.max(
    SHEET_GEOMETRY.MIN_LINE_GAP_PX,
    Math.round(settings.lineGapPx || exactLineHeightPx)
  );
  const leftMarginPos = Math.max(
    0,
    Math.round(settings.leftPaddingPx) -
      SHEET_GEOMETRY.LEFT_MARGIN_LINE_OFFSET_PX
  );

  const pageRect = pageEl.getBoundingClientRect();
  const scaleFactorX = pageRect.width > 0 ? PAGE_WIDTH / pageRect.width : 1;
  const scaleFactorY = pageRect.height > 0 ? PAGE_HEIGHT / pageRect.height : 1;

  // Snap tables & images to exact multiples of lineGap so lines never drift downward
  snapBlocksToRuledGrid(paperContentEl, lineGap, scaleFactorY);

  const paperRect = paperContentEl.getBoundingClientRect();
  const paperTopInPage = (paperRect.top - pageRect.top) * scaleFactorY;

  // 2. Delicate Notebook-Accurate Vector Ruled Horizontal Lines (optimized for inkjet print)
  if (settings.showRuledLines && !settings.customPaperBgUrl) {
    ctx.save();
    ctx.strokeStyle = STENCIL_COLORS.RULED_LINE;
    ctx.lineWidth = 0.72;
    let lineY = paperTopInPage + lineGap - 0.6;
    while (lineY < -2) {
      lineY += lineGap;
    }
    while (lineY < PAGE_HEIGHT - 1) {
      if (lineY >= paperTopInPage - 1) {
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(PAGE_WIDTH, lineY);
        ctx.stroke();
      }
      lineY += lineGap;
    }
    ctx.restore();
  }

  // 3. Independent Vector Top Margin & Full-Height Left Margin Lines (soft notebook rose)
  if (!settings.customPaperBgUrl) {
    ctx.save();
    ctx.strokeStyle = STENCIL_COLORS.MARGIN_LINE;
    ctx.lineWidth = 1.05;

    if (settings.showTopMargin) {
      const topLineY = paperTopInPage;
      if (topLineY > 0 && topLineY < PAGE_HEIGHT) {
        ctx.beginPath();
        ctx.moveTo(0, topLineY);
        ctx.lineTo(PAGE_WIDTH, topLineY);
        ctx.stroke();
      }
    }

    if (settings.showLeftMargin) {
      ctx.beginPath();
      ctx.moveTo(leftMarginPos + 0.75, 0);
      ctx.lineTo(leftMarginPos + 0.75, PAGE_HEIGHT);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 4. Render Embedded Diagrams / Sketches (<img> inside paperContentEl)
  const imgElements = Array.from(paperContentEl.querySelectorAll('img'));
  for (const imgEl of imgElements) {
    if (imgEl.src) {
      try {
        const loadedImg = await loadImage(imgEl.src);
        const r = imgEl.getBoundingClientRect();
        const x = (r.left - pageRect.left) * scaleFactorX;
        const y = (r.top - pageRect.top) * scaleFactorY;
        const w = r.width * scaleFactorX;
        const h = r.height * scaleFactorY;
        if (w > 0 && h > 0 && y + h > 0 && y < PAGE_HEIGHT) {
          ctx.drawImage(loadedImg, x, y, w, h);
        }
      } catch {
        // Ignore broken image
      }
    }
  }

  // Create dedicated offscreen ink layer so we can apply organic ink grain & multiply blend
  const useInkLayer = settings.realismIntensity > 0;
  let inkCanvas: HTMLCanvasElement | null = null;
  let inkCtx: CanvasRenderingContext2D = ctx;

  if (useInkLayer) {
    inkCanvas = document.createElement('canvas');
    inkCanvas.width = targetW;
    inkCanvas.height = targetH;
    inkCtx = inkCanvas.getContext('2d')!;
    inkCtx.scale(scale, scale);
  }

  const eff = Math.min(2.0, settings.realismIntensity * 0.82);
  const decoRng = new SeededRandom(pageSeed + 7919);
  const baseInkRgb = parseHexColor(settings.inkColor);

  const snapYToRuledLine = (yVal: number): number => {
    if (!settings.showRuledLines || settings.customPaperBgUrl) return yVal;
    const k = Math.round((yVal - (paperTopInPage - 0.6)) / lineGap);
    return paperTopInPage + k * lineGap - 0.6;
  };

  // 5. Render Clean Single-Pass Hand-Drawn Table Grid Lines Snapped to Notebook Ruled Lines
  const tables = Array.from(
    paperContentEl.querySelectorAll('table.hw-table, table')
  );
  for (const tableEl of tables) {
    const tRect = tableEl.getBoundingClientRect();
    const tx = (tRect.left - pageRect.left) * scaleFactorX;
    const ty = (tRect.top - pageRect.top) * scaleFactorY;
    const tw = tRect.width * scaleFactorX;
    const th = tRect.height * scaleFactorY;

    if (ty + th > 0 && ty < PAGE_HEIGHT && tw > 0 && th > 0) {
      const xSet: number[] = [tx, tx + tw];
      const ySet: number[] = [snapYToRuledLine(ty), snapYToRuledLine(ty + th)];
      let headerBottomY: number | null = null;

      const rows = Array.from(tableEl.querySelectorAll('tr'));
      rows.forEach((tr, rIdx) => {
        const rRect = tr.getBoundingClientRect();
        const ryTop = snapYToRuledLine((rRect.top - pageRect.top) * scaleFactorY);
        const ryBot = snapYToRuledLine((rRect.bottom - pageRect.top) * scaleFactorY);
        ySet.push(ryTop, ryBot);
        if (rIdx === 0 && tr.querySelector('th')) {
          headerBottomY = ryBot;
        }
        const cells = Array.from(tr.children);
        cells.forEach((cell) => {
          const cRect = cell.getBoundingClientRect();
          xSet.push(
            (cRect.left - pageRect.left) * scaleFactorX,
            (cRect.right - pageRect.left) * scaleFactorX
          );
        });
      });

      const dedupeCoords = (vals: number[], eps = 2.0): number[] => {
        const sorted = [...vals].sort((a, b) => a - b);
        const out: number[] = [];
        for (const v of sorted) {
          if (out.length === 0 || Math.abs(v - out[out.length - 1]) > eps) {
            out.push(v);
          }
        }
        return out;
      };

      const uniqueXs = dedupeCoords(xSet);
      const uniqueYs = dedupeCoords(ySet);
      const snappedTopY = uniqueYs[0] ?? ty;
      const snappedBotY = uniqueYs[uniqueYs.length - 1] ?? ty + th;
      const wobble = 0.36 * eff;

      inkCtx.save();
      inkCtx.strokeStyle = settings.inkColor;
      inkCtx.lineCap = 'round';
      inkCtx.lineJoin = 'round';

      // Horizontal lines (traced cleanly right along the notebook ruled lines)
      uniqueYs.forEach((ly, idx) => {
        const isOuter = idx === 0 || idx === uniqueYs.length - 1;
        const isHeaderSep =
          headerBottomY !== null && Math.abs(ly - headerBottomY) < 2.5;
        inkCtx.lineWidth = isHeaderSep ? 1.05 : isOuter ? 0.95 : 0.78;
        inkCtx.globalAlpha = isOuter || isHeaderSep ? 0.68 : 0.5;
        strokeHandDrawnLine(inkCtx, tx, ly, tx + tw, ly, decoRng, wobble, 28);
      });

      // Vertical lines (connecting snappedTopY to snappedBotY cleanly at corners)
      uniqueXs.forEach((lx, idx) => {
        const isOuter = idx === 0 || idx === uniqueXs.length - 1;
        inkCtx.lineWidth = isOuter ? 0.95 : 0.8;
        inkCtx.globalAlpha = isOuter ? 0.68 : 0.52;
        strokeHandDrawnLine(
          inkCtx,
          lx,
          snappedTopY,
          lx,
          snappedBotY,
          decoRng,
          wobble,
          26
        );
      });

      inkCtx.restore();
    }
  }

  // 6. Render All Handwritten Text Words (Tier 1 + Tier 2 Vector Perturbation)
  const fontSizePx = (settings.fontSizePt * 4) / 3;
  const letterSpacingPx = (settings.letterSpacingPt * 4) / 3;

  interface DecorationSegment {
    startX: number;
    endX: number;
    baseY: number;
  }

  const underlineRaw: DecorationSegment[] = [];
  const strikeRaw: DecorationSegment[] = [];

  const humanizer = new HandwritingHumanizer(
    pageSeed,
    settings.realismIntensity,
    settings.showRuledLines
  );
  const walker = document.createTreeWalker(
    paperContentEl,
    NodeFilter.SHOW_TEXT,
    null
  );

  const range = document.createRange();
  let textNode = walker.nextNode() as Text | null;

  while (textNode) {
    const rawText = textNode.nodeValue || '';
    if (rawText.trim().length > 0) {
      const isBold = hasAncestorTag(textNode, paperContentEl, ['b', 'strong']);
      const isItalic = hasAncestorTag(textNode, paperContentEl, ['i', 'em']);
      const isUnderlined = hasAncestorTag(textNode, paperContentEl, [
        'u',
        'ins'
      ]);
      const isStrikethrough = hasAncestorTag(textNode, paperContentEl, [
        's',
        'strike',
        'del'
      ]);
      const isCode =
        hasAncestorClass(textNode, paperContentEl, 'hw-code-block') ||
        hasAncestorClass(textNode, paperContentEl, 'hw-code-line') ||
        hasAncestorTag(textNode, paperContentEl, ['pre', 'code']);
      const isTableCell = hasAncestorTag(textNode, paperContentEl, ['td', 'th']);

      // Use natural regular font weight in Canvas and let humanizer apply subtle pen-pressure
      // strokeWidth for bold (avoids heavy double-thickened faux-bold marker look)
      const fontWeight = '400';
      const fontStyle = isItalic ? 'italic' : 'normal';
      inkCtx.font = `${fontStyle} ${fontWeight} ${fontSizePx.toFixed(2)}px ${fontFamily}`;
      inkCtx.textBaseline = 'alphabetic';

      const wordRegex = /\S+/g;
      let match: RegExpExecArray | null;

      while ((match = wordRegex.exec(rawText)) !== null) {
        const word = match[0];
        const wordStart = match.index;
        const wordEnd = wordStart + word.length;

        range.setStart(textNode, wordStart);
        range.setEnd(textNode, wordEnd);
        const wRect = range.getBoundingClientRect();
        if (wRect.width < 0.5 || wRect.height < 0.5) continue;

        const x = (wRect.left - pageRect.left) * scaleFactorX;
        const y = (wRect.top - pageRect.top) * scaleFactorY;
        const w = wRect.width * scaleFactorX;
        const h = wRect.height * scaleFactorY;

        const metrics = inkCtx.measureText(word);
        const fontAscent =
          metrics.fontBoundingBoxAscent !== undefined &&
          metrics.fontBoundingBoxAscent > 0
            ? metrics.fontBoundingBoxAscent
            : h * 0.72;
        const baselineY = y + fontAscent;

        if (baselineY > -12 && y < PAGE_HEIGHT + 12) {
          // Use document-space Y so scrolling in live preview keeps each line's profile stable
          const docLineY = baselineY + scrollTop;
          const syllables = humanizer.computeWordSyllables(word, {
            isBold,
            isItalic,
            isCode,
            isTableCell,
            x,
            lineY: docLineY
          });

          let curX = x + (syllables[0]?.offsetX ?? 0);
          const wordStartX = curX;
          let avgLineOffsetY = 0;

          for (const sylData of syllables) {
            const syl = sylData.syllable;
            const isCapitalSyllable = /^[A-Z]+$/.test(syl);
            const sylFontFamily =
              isCapitalSyllable &&
              fontFamily.includes('Cedarville Cursive') &&
              !fontFamily.includes('Cedarville Classic')
                ? `'Caveat', cursive`
                : fontFamily;

            inkCtx.font = `${fontStyle} ${fontWeight} ${fontSizePx.toFixed(2)}px ${sylFontFamily}`;
            const sylMetrics = inkCtx.measureText(syl);
            const sylW = sylMetrics.width;
            const sylBaselineY = baselineY + sylData.baselineOffsetY;
            avgLineOffsetY += sylData.baselineOffsetY;

            inkCtx.save();
            const pivotX = curX + sylW * 0.5;
            const pivotY = sylBaselineY;
            inkCtx.translate(pivotX, pivotY);

            if (sylData.rotateRad !== 0) {
              inkCtx.rotate(sylData.rotateRad);
            }
            if (
              sylData.skewRad !== 0 ||
              sylData.scaleX !== 1 ||
              sylData.scaleY !== 1
            ) {
              inkCtx.transform(
                sylData.scaleX,
                0,
                Math.tan(sylData.skewRad),
                sylData.scaleY,
                0,
                0
              );
            }
            inkCtx.translate(-pivotX, -pivotY);

            // Attempt Tier 2 opentype.js Bezier outline perturbation when realism > 0
            const vectorFont =
              sylData.perturbAmpPx > 0.01
                ? getCachedVectorFont(sylFontFamily)
                : null;
            const usedVectorPath =
              vectorFont !== null &&
              buildPerturbedGlyphPath(
                inkCtx,
                vectorFont,
                syl,
                curX,
                sylBaselineY,
                fontSizePx,
                {
                  amplitudePx: sylData.perturbAmpPx,
                  instanceSeed: sylData.instanceSeed,
                  targetWidth: sylW
                }
              );

            const sylInkColor = getTonalInkColor(
              baseInkRgb,
              settings.inkColor,
              sylData.opacity,
              eff
            );

            if (usedVectorPath) {
              // 1. Subtle pen pressure stroke (if bold or firm pressure)
              if (sylData.strokeWidth > 0) {
                inkCtx.strokeStyle = sylInkColor;
                inkCtx.lineWidth = sylData.strokeWidth;
                inkCtx.lineJoin = 'round';
                inkCtx.lineCap = 'round';
                inkCtx.globalAlpha = Math.min(0.95, sylData.opacity * 0.96);
                inkCtx.stroke();
              }

              // 2. Main perturbed vector ink fill
              inkCtx.fillStyle = sylInkColor;
              inkCtx.globalAlpha = sylData.opacity;
              inkCtx.fill();
            } else {
              // Graceful Canvas 2D fallback (e.g., Devanagari, emojis, or offline font)
              if (sylData.strokeWidth > 0) {
                inkCtx.save();
                inkCtx.strokeStyle = sylInkColor;
                inkCtx.lineWidth = sylData.strokeWidth;
                inkCtx.lineJoin = 'round';
                inkCtx.lineCap = 'round';
                inkCtx.globalAlpha = Math.min(0.95, sylData.opacity * 0.96);
                inkCtx.strokeText(syl, curX, sylBaselineY);
                inkCtx.restore();
              }

              if (sylData.shadowAlpha > 0) {
                inkCtx.save();
                inkCtx.fillStyle = sylInkColor;
                inkCtx.globalAlpha = sylData.shadowAlpha;
                inkCtx.fillText(
                  syl,
                  curX + sylData.shadowOffsetX,
                  sylBaselineY + sylData.shadowOffsetY
                );
                inkCtx.restore();
              }

              inkCtx.fillStyle = sylInkColor;
              inkCtx.globalAlpha = sylData.opacity;
              inkCtx.fillText(syl, curX, sylBaselineY);
            }

            inkCtx.restore();

            curX += sylW + letterSpacingPx + sylData.letterSpacingOffset;
          }

          avgLineOffsetY =
            syllables.length > 0 ? avgLineOffsetY / syllables.length : 0;

          if (isUnderlined) {
            underlineRaw.push({
              startX: wordStartX,
              endX: Math.max(curX, wordStartX + w),
              baseY: baselineY + avgLineOffsetY + 2.0
            });
          }
          if (isStrikethrough) {
            strikeRaw.push({
              startX: wordStartX,
              endX: Math.max(curX, wordStartX + w),
              baseY: baselineY + avgLineOffsetY - fontSizePx * 0.3
            });
          }
        }
      }
    }
    textNode = walker.nextNode() as Text | null;
  }

  // Merge consecutive word segments on the same visual line across spaces
  const mergeDecorationSegments = (
    segs: DecorationSegment[]
  ): DecorationSegment[] => {
    if (segs.length === 0) return [];
    const sorted = [...segs].sort((a, b) =>
      Math.abs(a.baseY - b.baseY) < 6 ? a.startX - b.startX : a.baseY - b.baseY
    );
    const merged: DecorationSegment[] = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      const prev = merged[merged.length - 1];
      if (
        Math.abs(cur.baseY - prev.baseY) < 6 &&
        cur.startX - prev.endX <= 30
      ) {
        prev.endX = Math.max(prev.endX, cur.endX);
        prev.baseY = (prev.baseY + cur.baseY) * 0.5;
      } else {
        merged.push({ ...cur });
      }
    }
    return merged;
  };

  // 7. Render Hand-Drawn Underlines (<u>) & Strikethroughs (<s>) with organic wobble & slope
  const mergedUnderlines = mergeDecorationSegments(underlineRaw);
  for (const seg of mergedUnderlines) {
    const width = seg.endX - seg.startX;
    if (width < 2 || seg.baseY <= 0 || seg.baseY >= PAGE_HEIGHT) continue;

    const overshootStart = decoRng.uniform(-1.5, 1.0) * eff;
    const overshootEnd = decoRng.uniform(-0.8, 2.2) * eff;
    const tiltDy = decoRng.uniform(-0.7, 0.85) * eff;

    inkCtx.save();
    inkCtx.strokeStyle = settings.inkColor;
    inkCtx.lineWidth = 0.92;
    inkCtx.lineCap = 'round';
    inkCtx.globalAlpha = 0.84;
    strokeHandDrawnLine(
      inkCtx,
      seg.startX + overshootStart,
      seg.baseY,
      seg.endX + overshootEnd,
      seg.baseY + tiltDy,
      decoRng,
      0.85 * eff,
      20
    );
    inkCtx.restore();
  }

  const mergedStrikes = mergeDecorationSegments(strikeRaw);
  for (const seg of mergedStrikes) {
    const width = seg.endX - seg.startX;
    if (width < 2 || seg.baseY <= 0 || seg.baseY >= PAGE_HEIGHT) continue;

    inkCtx.save();
    inkCtx.strokeStyle = settings.inkColor;
    inkCtx.lineWidth = 0.95;
    inkCtx.lineCap = 'round';
    inkCtx.globalAlpha = 0.82;
    strokeHandDrawnLine(
      inkCtx,
      seg.startX - 1 * eff,
      seg.baseY,
      seg.endX + 1.5 * eff,
      seg.baseY + decoRng.uniform(-0.8, 0.8) * eff,
      decoRng,
      0.75 * eff,
      18
    );
    inkCtx.restore();
  }

  // 8. Composite Ink Layer with Subtle Ballpoint Micro-Grain Texture + Multiply Blend
  if (useInkLayer && inkCanvas) {
    inkCtx.save();
    inkCtx.setTransform(1, 0, 0, 1, 0, 0);
    inkCtx.globalCompositeOperation = 'destination-out';
    inkCtx.globalAlpha = Math.min(0.14, 0.055 * eff);
    const grainPattern = inkCtx.createPattern(getInkGrainTile(), 'repeat');
    if (grainPattern) {
      inkCtx.fillStyle = grainPattern;
      inkCtx.fillRect(0, 0, targetW, targetH);
    }
    inkCtx.restore();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(inkCanvas, 0, 0);
    ctx.restore();
  }

  // 9. Apply Optional Page Surface Effect (Soft Shadow or Scanner Contrast)
  if (settings.pageEffect === 'shadows' || settings.pageEffect === 'scanner') {
    ctx.save();
    const angle = ((pageSeed % 70) + 50) * (Math.PI / 180);
    const grad = ctx.createLinearGradient(
      0,
      0,
      Math.cos(angle) * PAGE_WIDTH,
      Math.sin(angle) * PAGE_HEIGHT
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    ctx.restore();
  }

  ctx.restore();

  if (settings.pageEffect === 'scanner') {
    applyScannerContrast(ctx, canvas.width, canvas.height, 0.55);
  }

  return canvas;
}

/**
 * Multi-Page Generator
 * Normalizes DOM into logical blocks, paginates with smart keep-together protection
 * (never orphans headings/questions before tables/code, keeps code blocks intact),
 * and renders each page via Canvas 2D + Tier 2 vector font engine.
 */
export async function generateHandwrittenPages(
  pageEl: HTMLElement,
  paperContentEl: HTMLElement,
  containerEl: HTMLElement | null,
  settings: StudioSettings,
  exactLineHeightPx: number
): Promise<GeneratedPage[]> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const initialPaperContent = paperContentEl.innerHTML;
  const prevScrollTop = pageEl.scrollTop;
  const prevContainerMinHeight = containerEl ? containerEl.style.minHeight : '';
  const prevPaperMinHeight = paperContentEl.style.minHeight;
  const prevAlignSelf = paperContentEl.style.alignSelf;
  const prevPaddingBottom = paperContentEl.style.paddingBottom;
  const prevOverflowY = pageEl.style.overflowY;

  const generatedPages: GeneratedPage[] = [];

  try {
    pageEl.scrollTo(0, 0);
    pageEl.style.overflowY = 'hidden';

    // 1. Normalize DOM into discrete logical blocks (keeping code & tables intact)
    const rawUnits = extractLogicalUnits(paperContentEl);
    paperContentEl.innerHTML = joinLogicalLines(rawUnits);

    const blocks = Array.from(paperContentEl.children).map(
      (el) => el.outerHTML
    );

    // 2. Shrink-wrap paperContentEl during height measurement
    if (containerEl) containerEl.style.minHeight = '0px';
    paperContentEl.style.minHeight = '0px';
    paperContentEl.style.alignSelf = 'flex-start';
    paperContentEl.style.paddingBottom = '6px';

    const maxPageHeight = settings.showTopMargin
      ? SHEET_GEOMETRY.MAX_CONTENT_HEIGHT_WITH_TOP_MARGIN
      : SHEET_GEOMETRY.MAX_CONTENT_HEIGHT_WITHOUT_TOP_MARGIN;
    const totalScrollHeight = paperContentEl.scrollHeight;

    if (totalScrollHeight > maxPageHeight && blocks.length > 1) {
      let blockIdx = 0;
      let pageNum = 1;

      while (blockIdx < blocks.length) {
        while (blockIdx < blocks.length && isBlankBlock(blocks[blockIdx])) {
          blockIdx++;
        }
        if (blockIdx >= blocks.length) break;

        const pageBlocks: string[] = [];

        while (blockIdx < blocks.length) {
          const candidateBlock = blocks[blockIdx];
          paperContentEl.innerHTML = [...pageBlocks, candidateBlock].join('');

          if (paperContentEl.scrollHeight <= maxPageHeight) {
            pageBlocks.push(candidateBlock);
            blockIdx++;
          } else {
            if (isBlankBlock(candidateBlock)) {
              blockIdx++;
              break;
            }

            // Never split a code block or table if there is already content on this page;
            // move it intact to the next page!
            if (
              (isCodeBlock(candidateBlock) || isTableBlock(candidateBlock)) &&
              pageBlocks.length > 0
            ) {
              break;
            }

            // Try partial word-level fitting for long prose paragraphs (110+ chars)
            const tempWrapper = document.createElement('div');
            tempWrapper.innerHTML = candidateBlock;
            const blockEl = tempWrapper.firstElementChild as HTMLElement | null;
            const plainText = blockEl ? (blockEl.textContent || '').trim() : '';

            if (
              blockEl &&
              plainText.length >= 110 &&
              !isHeadingBlock(candidateBlock) &&
              !isCodeBlock(candidateBlock) &&
              !isTableBlock(candidateBlock)
            ) {
              const words = blockEl.innerHTML.split(/(\s+)/);
              const fittedContainer = blockEl.cloneNode(false) as HTMLElement;
              let lastFittingHTML = '';
              let splitIdx = 0;

              let currentHTML = '';
              for (let wIdx = 0; wIdx < words.length; wIdx++) {
                currentHTML += words[wIdx];
                fittedContainer.innerHTML = currentHTML;
                paperContentEl.innerHTML = [
                  ...pageBlocks,
                  fittedContainer.outerHTML
                ].join('');
                if (paperContentEl.scrollHeight <= maxPageHeight) {
                  lastFittingHTML = fittedContainer.outerHTML;
                  splitIdx = wIdx + 1;
                } else {
                  break;
                }
              }

              const fittedChars = lastFittingHTML
                .replace(/<[^>]+>/g, '')
                .trim().length;
              const remainingHTML = words.slice(splitIdx).join('').trim();
              const remainingChars = remainingHTML
                .replace(/<[^>]+>/g, '')
                .trim().length;

              if (
                fittedChars >= 45 &&
                remainingChars >= 20 &&
                splitIdx < words.length
              ) {
                pageBlocks.push(lastFittingHTML);
                const remainderContainer = blockEl.cloneNode(
                  false
                ) as HTMLElement;
                if (remainderContainer.style) {
                  remainderContainer.style.textIndent = '0px';
                }
                remainderContainer.innerHTML = remainingHTML;
                blocks[blockIdx] = remainderContainer.outerHTML;
              }
            }

            if (pageBlocks.length === 0) {
              pageBlocks.push(candidateBlock);
              blockIdx++;
            }
            break;
          }
        }

        // Trim trailing blank lines on page
        while (
          pageBlocks.length > 1 &&
          isBlankBlock(pageBlocks[pageBlocks.length - 1])
        ) {
          pageBlocks.pop();
        }

        // Widow/Orphan Protection: pull up to 2 trailing heading/question/label lines
        // (e.g. "Q4. Write a C++ program..." + "Program:") onto the next page with their body/table/code
        let pulledCount = 0;
        while (
          pulledCount < 2 &&
          pageBlocks.length > 1 &&
          blockIdx < blocks.length &&
          isHeadingBlock(pageBlocks[pageBlocks.length - 1])
        ) {
          blockIdx--;
          pageBlocks.pop();
          pulledCount++;
          while (
            pageBlocks.length > 1 &&
            isBlankBlock(pageBlocks[pageBlocks.length - 1])
          ) {
            pageBlocks.pop();
          }
        }

        paperContentEl.innerHTML = pageBlocks.join('');

        if (containerEl) containerEl.style.minHeight = prevContainerMinHeight;
        paperContentEl.style.minHeight = prevPaperMinHeight;
        paperContentEl.style.alignSelf = prevAlignSelf;
        paperContentEl.style.paddingBottom = prevPaddingBottom;
        pageEl.scrollTo(0, 0);

        const canvas = await renderCurrentSheetToCanvas(
          pageEl,
          paperContentEl,
          settings,
          exactLineHeightPx,
          settings.realismSeed + pageNum * 101
        );

        generatedPages.push({
          id: `page-${Date.now()}-${pageNum}`,
          dataUrl: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height,
          pageNumber: pageNum
        });
        pageNum++;

        if (containerEl) containerEl.style.minHeight = '0px';
        paperContentEl.style.minHeight = '0px';
        paperContentEl.style.alignSelf = 'flex-start';
        paperContentEl.style.paddingBottom = '6px';
      }
    } else {
      if (containerEl) containerEl.style.minHeight = prevContainerMinHeight;
      paperContentEl.style.minHeight = prevPaperMinHeight;
      paperContentEl.style.alignSelf = prevAlignSelf;
      paperContentEl.style.paddingBottom = prevPaddingBottom;
      pageEl.scrollTo(0, 0);

      const canvas = await renderCurrentSheetToCanvas(
        pageEl,
        paperContentEl,
        settings,
        exactLineHeightPx,
        settings.realismSeed
      );

      generatedPages.push({
        id: `page-${Date.now()}-1`,
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
        pageNumber: 1
      });
    }
  } finally {
    paperContentEl.innerHTML = initialPaperContent;
    if (containerEl) containerEl.style.minHeight = prevContainerMinHeight;
    paperContentEl.style.minHeight = prevPaperMinHeight;
    paperContentEl.style.alignSelf = prevAlignSelf;
    paperContentEl.style.paddingBottom = prevPaddingBottom;
    pageEl.style.overflowY = prevOverflowY;
    pageEl.scrollTo(0, prevScrollTop);
  }

  return generatedPages;
}
