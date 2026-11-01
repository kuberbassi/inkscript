import { SHEET_GEOMETRY, STENCIL_COLORS } from '../constants/studioTokens';
import { GeneratedPage, StudioSettings } from '../types/studio';
import { computeWordRealism } from './humanizer';
import { extractLogicalUnits, joinLogicalLines } from './markdownParser';
import { SeededRandom } from './prng';

const PAGE_WIDTH = SHEET_GEOMETRY.WIDTH_PX;
const PAGE_HEIGHT = SHEET_GEOMETRY.HEIGHT_PX;

function isHeadingBlock(blockHTML: string): boolean {
  const plain = blockHTML
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  if (!plain) return false;
  if (
    /^\d+[.)]\s+\S+/.test(plain) &&
    plain.length < 58 &&
    !/\.$/.test(plain)
  ) {
    return true;
  }
  if (
    /^(#[#\s]*|[A-Z][a-zA-Z\s-]{2,40}:)$/.test(plain) &&
    plain.length < 45
  ) {
    return true;
  }
  return false;
}

function isBlankBlock(blockHTML: string): boolean {
  const plain = blockHTML
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return plain.length === 0;
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

/**
 * Direct HTML5 Canvas 2D Vector Page Renderer
 * Renders ruled lines, independent top/left margins, baseline-locked words
 * using exact alphabetic baseline metrics (fontBoundingBoxAscent), and smooth
 * continuous underlines that match the Live Sheet Preview pixel-for-pixel.
 */
export async function renderCurrentSheetToCanvas(
  pageEl: HTMLElement,
  paperContentEl: HTMLElement,
  settings: StudioSettings,
  exactLineHeightPx: number,
  pageSeed: number
): Promise<HTMLCanvasElement> {
  const scale = settings.exportScale || 4;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_WIDTH * scale);
  canvas.height = Math.round(PAGE_HEIGHT * scale);

  const ctx = canvas.getContext('2d')!;
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

  const topMarginOffset = settings.showTopMargin
    ? SHEET_GEOMETRY.TOP_MARGIN_HEIGHT_PX
    : 0;
  const lineGap = Math.max(
    SHEET_GEOMETRY.MIN_LINE_GAP_PX,
    Math.round(settings.lineGapPx || exactLineHeightPx)
  );
  const leftMarginPos = Math.max(
    0,
    Math.round(settings.leftPaddingPx) -
      SHEET_GEOMETRY.LEFT_MARGIN_LINE_OFFSET_PX
  );

  // 2. Crisp Vector Ruled Horizontal Lines (Locked to sheet stencil; starts strictly at row 1 below top margin)
  if (settings.showRuledLines && !settings.customPaperBgUrl) {
    ctx.save();
    ctx.strokeStyle = STENCIL_COLORS.RULED_LINE;
    ctx.lineWidth = 1.05;
    let lineY = topMarginOffset + lineGap - 0.6;
    while (lineY < PAGE_HEIGHT - 2) {
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(PAGE_WIDTH, lineY);
      ctx.stroke();
      lineY += lineGap;
    }
    ctx.restore();
  }

  // 3. Independent Vector Top Margin & Full-Height Left Margin Lines (Single 1.5px stroke each)
  if (!settings.customPaperBgUrl) {
    ctx.save();
    ctx.strokeStyle = STENCIL_COLORS.MARGIN_LINE;
    ctx.lineWidth = 1.5;

    if (settings.showTopMargin) {
      ctx.beginPath();
      ctx.moveTo(0, SHEET_GEOMETRY.TOP_MARGIN_HEIGHT_PX);
      ctx.lineTo(PAGE_WIDTH, SHEET_GEOMETRY.TOP_MARGIN_HEIGHT_PX);
      ctx.stroke();
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
  const pageRect = pageEl.getBoundingClientRect();
  const imgElements = Array.from(paperContentEl.querySelectorAll('img'));
  for (const imgEl of imgElements) {
    if (imgEl.src) {
      try {
        const loadedImg = await loadImage(imgEl.src);
        const r = imgEl.getBoundingClientRect();
        const x = r.left - pageRect.left;
        const y = r.top - pageRect.top;
        if (r.width > 0 && r.height > 0) {
          ctx.drawImage(loadedImg, x, y, r.width, r.height);
        }
      } catch {
        // Ignore broken image
      }
    }
  }

  // 5. Render All Handwritten Text Words Locked to Exact DOM Alphabetic Baseline
  const fontFamily = settings.customFontName
    ? `'${settings.customFontName}', cursive`
    : settings.handwritingFont;
  const fontSizePx = (settings.fontSizePt * 4) / 3;
  const letterSpacingPx = (settings.letterSpacingPt * 4) / 3;

  interface DecorationSegment {
    startX: number;
    endX: number;
    baseY: number;
  }

  const underlineRaw: DecorationSegment[] = [];
  const strikeRaw: DecorationSegment[] = [];

  const wordRng = new SeededRandom(pageSeed);
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

      const fontWeight = isBold ? '700' : '400';
      const fontStyle = isItalic ? 'italic' : 'normal';
      ctx.font = `${fontStyle} ${fontWeight} ${fontSizePx.toFixed(2)}px ${fontFamily}`;
      ctx.textBaseline = 'alphabetic';

      // Measure each non-whitespace word token via DOM Range so horizontal & vertical coordinates
      // match the Live Sheet Preview with 0.0px drift
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

        const x = wRect.left - pageRect.left;
        const y = wRect.top - pageRect.top;
        const w = wRect.width;
        const h = wRect.height;

        // Exact alphabetic baseline inside the DOM glyph bounding box
        const metrics = ctx.measureText(word);
        const fontAscent =
          metrics.fontBoundingBoxAscent !== undefined &&
          metrics.fontBoundingBoxAscent > 0
            ? metrics.fontBoundingBoxAscent
            : h * 0.72;
        const baselineY = y + fontAscent;

        if (baselineY > 0 && y < PAGE_HEIGHT) {
          const realism = computeWordRealism(
            word,
            wordRng,
            settings.realismIntensity,
            isBold
          );

          ctx.save();
          ctx.fillStyle = settings.inkColor;

          // Pivot micro-slant & scale strictly on (x + w/2, baselineY) so the word never leaves the ruled line
          const pivotX = x + w * 0.5;
          const pivotY = baselineY;
          ctx.translate(pivotX, pivotY);
          if (
            realism.skewRad !== 0 ||
            realism.scaleX !== 1 ||
            realism.scaleY !== 1
          ) {
            ctx.transform(
              realism.scaleX,
              0,
              Math.tan(realism.skewRad),
              realism.scaleY,
              0,
              0
            );
          }
          ctx.translate(-pivotX, -pivotY);

          const drawWord = (ox: number, oy: number) => {
            if (Math.abs(letterSpacingPx) < 0.02) {
              ctx.fillText(word, x + ox, baselineY + oy);
            } else {
              let curX = x + ox;
              for (const ch of word) {
                ctx.fillText(ch, curX, baselineY + oy);
                curX += ctx.measureText(ch).width + letterSpacingPx;
              }
            }
          };

          if (realism.shadowAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = realism.shadowAlpha;
            drawWord(realism.shadowOffsetX, realism.shadowOffsetY);
            ctx.restore();
          }

          ctx.globalAlpha = realism.opacity;
          drawWord(0, 0);
          ctx.restore();

          // Record glyph-tight underline & strikethrough anchored to the alphabetic baseline
          if (isUnderlined) {
            underlineRaw.push({
              startX: x,
              endX: x + w,
              baseY: baselineY + 1.8
            });
          }
          if (isStrikethrough) {
            strikeRaw.push({
              startX: x,
              endX: x + w,
              baseY: baselineY - fontSizePx * 0.3
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
      Math.abs(a.baseY - b.baseY) < 5 ? a.startX - b.startX : a.baseY - b.baseY
    );
    const merged: DecorationSegment[] = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      const prev = merged[merged.length - 1];
      if (
        Math.abs(cur.baseY - prev.baseY) < 5 &&
        cur.startX - prev.endX <= 28
      ) {
        prev.endX = Math.max(prev.endX, cur.endX);
        prev.baseY = (prev.baseY + cur.baseY) * 0.5;
      } else {
        merged.push({ ...cur });
      }
    }
    return merged;
  };

  // 6. Render Continuous, Baseline-Aligned Hand-Drawn Underlines (<u>) & Strikethroughs (<s>)
  const mergedUnderlines = mergeDecorationSegments(underlineRaw);
  for (const seg of mergedUnderlines) {
    const width = seg.endX - seg.startX;
    if (width < 2 || seg.baseY <= 0 || seg.baseY >= PAGE_HEIGHT) continue;

    ctx.save();
    ctx.strokeStyle = settings.inkColor;
    ctx.lineWidth = 1.15;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.92;

    ctx.beginPath();
    ctx.moveTo(seg.startX, seg.baseY);
    for (let dx = 4; dx <= width; dx += 4) {
      const px = seg.startX + Math.min(dx, width);
      const waveDy = Math.sin(px * 0.04) * 0.18;
      ctx.lineTo(px, seg.baseY + waveDy);
    }
    ctx.stroke();
    ctx.restore();
  }

  const mergedStrikes = mergeDecorationSegments(strikeRaw);
  for (const seg of mergedStrikes) {
    const width = seg.endX - seg.startX;
    if (width < 2 || seg.baseY <= 0 || seg.baseY >= PAGE_HEIGHT) continue;

    ctx.save();
    ctx.strokeStyle = settings.inkColor;
    ctx.lineWidth = 1.05;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.9;

    ctx.beginPath();
    ctx.moveTo(seg.startX, seg.baseY);
    ctx.lineTo(seg.endX, seg.baseY);
    ctx.stroke();
    ctx.restore();
  }

  // 7. Apply Optional Page Surface Effect (Soft Shadow or Scanner Contrast)
  if (settings.pageEffect === 'shadows' || settings.pageEffect === 'scanner') {
    ctx.save();
    const angle = ((pageSeed % 70) + 50) * (Math.PI / 180);
    const grad = ctx.createLinearGradient(
      0,
      0,
      Math.cos(angle) * PAGE_WIDTH,
      Math.sin(angle) * PAGE_HEIGHT
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.32)');
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
 * Normalizes DOM into logical blocks without mutating inline geometry so measurement
 * and rendering have 0.0px drift from the Live Preview, paginates with widow/orphan
 * protection, and renders each page via Canvas 2D.
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

    // 1. Normalize DOM into discrete logical <div> blocks (without altering inline layout boxes)
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

            // Try partial word-level fitting for long paragraphs (110+ chars)
            const tempWrapper = document.createElement('div');
            tempWrapper.innerHTML = candidateBlock;
            const blockEl = tempWrapper.firstElementChild as HTMLElement | null;
            const plainText = blockEl ? (blockEl.textContent || '').trim() : '';

            if (
              blockEl &&
              plainText.length >= 110 &&
              !isHeadingBlock(candidateBlock)
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

        while (
          pageBlocks.length > 1 &&
          isBlankBlock(pageBlocks[pageBlocks.length - 1])
        ) {
          pageBlocks.pop();
        }

        // Widow/Orphan Protection for standalone headings
        if (
          pageBlocks.length > 2 &&
          blockIdx < blocks.length &&
          isHeadingBlock(pageBlocks[pageBlocks.length - 1])
        ) {
          blockIdx--;
          pageBlocks.pop();
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
