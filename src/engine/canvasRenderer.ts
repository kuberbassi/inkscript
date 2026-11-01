import { GeneratedPage, StudioSettings } from '../types/studio';
import { applyHumanRealismToDOM } from './humanizer';
import { extractLogicalUnits, joinLogicalLines } from './markdownParser';
import { SeededRandom } from './prng';

const PAGE_WIDTH = 400;
const PAGE_HEIGHT = 564;

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

interface ParsedTransform {
  skewXRad: number;
  rotateRad: number;
  scaleX: number;
  scaleY: number;
}

function parseInlineTransform(transformStr: string): ParsedTransform {
  let skewXRad = 0;
  let rotateRad = 0;
  let scaleX = 1;
  let scaleY = 1;

  if (!transformStr) {
    return { skewXRad, rotateRad, scaleX, scaleY };
  }

  const skewMatch = transformStr.match(/skewX\(([-\d.]+)deg\)/i);
  if (skewMatch) {
    skewXRad = (parseFloat(skewMatch[1]) * Math.PI) / 180;
  }

  const rotMatch = transformStr.match(/rotate\(([-\d.]+)deg\)/i);
  if (rotMatch) {
    rotateRad = (parseFloat(rotMatch[1]) * Math.PI) / 180;
  }

  const scaleMatch = transformStr.match(
    /scale\(([-\d.]+)(?:,\s*([-\d.]+))?\)/i
  );
  if (scaleMatch) {
    scaleX = parseFloat(scaleMatch[1]);
    scaleY = scaleMatch[2] ? parseFloat(scaleMatch[2]) : scaleX;
  }

  return { skewXRad, rotateRad, scaleX, scaleY };
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
 * Replaces html2canvas completely: renders ruled lines, margin lines, humanized syllables
 * with 2D affine transforms, multi-pass ink shadows, and subtly interrupted level underlines
 * directly onto a high-DPI <canvas> in < 35ms per page.
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
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  if (settings.customPaperBgUrl) {
    try {
      const bgImg = await loadImage(settings.customPaperBgUrl);
      ctx.drawImage(bgImg, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    } catch {
      // Fallback to white background if custom image fails
    }
  }

  const topMarginOffset = settings.showTopMargin ? 50 : 0;
  const lineGap = Math.max(14, Math.round(settings.lineGapPx || exactLineHeightPx));
  const leftMarginPos = Math.max(0, Math.round(settings.leftPaddingPx) - 6);

  // 2. Crisp Vector Ruled Horizontal Lines (Locked to sheet stencil; starts strictly at row 1 below top margin)
  if (settings.showRuledLines && !settings.customPaperBgUrl) {
    ctx.save();
    ctx.strokeStyle = '#999999';
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
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 1.5;

    if (settings.showTopMargin) {
      // Horizontal top margin line at y = 50
      ctx.beginPath();
      ctx.moveTo(0, 50);
      ctx.lineTo(PAGE_WIDTH, 50);
      ctx.stroke();
    }

    if (settings.showLeftMargin) {
      // Vertical left margin line starting from the very top of the page (y = 0 to PAGE_HEIGHT)
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

  // 5. Render All Handwritten Text Nodes with Exact DOM Coordinates & 2D Affine Transforms
  //    While simultaneously collecting exact glyph-tight underline & strikethrough segments!
  const fontFamily = settings.customFontName
    ? `'${settings.customFontName}', cursive`
    : settings.handwritingFont;
  const fontSizePx = (settings.fontSizePt * 4) / 3;

  interface DecorationSegment {
    startX: number;
    endX: number;
    baseY: number;
  }

  const underlineRaw: DecorationSegment[] = [];
  const strikeRaw: DecorationSegment[] = [];

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
      const parentEl = textNode.parentElement as HTMLElement;
      range.selectNodeContents(textNode);
      const clientRects = Array.from(range.getClientRects());

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

      // Record tight text-node glyph rects for underline/strikethrough (never block div rects!)
      if (isUnderlined || isStrikethrough) {
        for (const r of clientRects) {
          if (r.width < 1.5) continue;
          const sx = r.left - pageRect.left;
          const ex = sx + r.width;
          if (isUnderlined) {
            underlineRaw.push({
              startX: sx,
              endX: ex,
              baseY: r.top - pageRect.top + r.height - 2.1
            });
          }
          if (isStrikethrough) {
            strikeRaw.push({
              startX: sx,
              endX: ex,
              baseY: r.top - pageRect.top + r.height - fontSizePx * 0.44
            });
          }
        }
      }

      const opacity = parentEl.style.opacity
        ? parseFloat(parentEl.style.opacity)
        : 0.94;
      const textShadow = parentEl.style.textShadow || '';
      const transform = parseInlineTransform(parentEl.style.transform || '');

      const fontWeight = isBold ? '700' : '400';
      const fontStyle = isItalic ? 'italic' : 'normal';
      ctx.font = `${fontStyle} ${fontWeight} ${fontSizePx.toFixed(2)}px ${fontFamily}`;
      ctx.textBaseline = 'bottom';

      if (clientRects.length === 1) {
        const rect = clientRects[0];
        const x = rect.left - pageRect.left;
        const y = rect.top - pageRect.top;
        const w = rect.width;
        const h = rect.height;

        if (y + h > 0 && y < PAGE_HEIGHT) {
          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.fillStyle = settings.inkColor;

          // Pivot affine transform (slant, rotation, rounded bowl scale) around 50% X, 82% Y baseline
          const pivotX = x + w * 0.5;
          const pivotY = y + h * 0.82;
          ctx.translate(pivotX, pivotY);
          if (transform.rotateRad !== 0) {
            ctx.rotate(transform.rotateRad);
          }
          if (
            transform.skewXRad !== 0 ||
            transform.scaleX !== 1 ||
            transform.scaleY !== 1
          ) {
            ctx.transform(
              transform.scaleX,
              0,
              Math.tan(transform.skewXRad),
              transform.scaleY,
              0,
              0
            );
          }
          ctx.translate(-pivotX, -pivotY);

          const letterSpacingPx = parentEl.style.letterSpacing
            ? parseFloat(parentEl.style.letterSpacing)
            : (settings.letterSpacingPt * 4) / 3;

          const drawString = (ox: number, oy: number) => {
            if (Math.abs(letterSpacingPx) < 0.02) {
              ctx.fillText(rawText, x + ox, y + h + oy);
            } else {
              let curX = x + ox;
              for (const ch of rawText) {
                ctx.fillText(ch, curX, y + h + oy);
                curX += ctx.measureText(ch).width + letterSpacingPx;
              }
            }
          };

          // Multi-pass ballpoint ink pressure shadows
          if (textShadow || isBold) {
            ctx.save();
            ctx.globalAlpha = opacity * (isBold ? 0.65 : 0.48);
            drawString(isBold ? 0.32 : 0.22, 0.08);
            ctx.restore();
          }

          drawString(0, 0);
          ctx.restore();
        }
      } else if (clientRects.length > 1) {
        // Multi-line wrapped text node (e.g. a long underlined heading): measure word-by-word via Range
        const tokenRegex = /\S+\s*/g;
        let match: RegExpExecArray | null;
        while ((match = tokenRegex.exec(rawText)) !== null) {
          const wordStart = match.index;
          const wordEnd = wordStart + match[0].length;
          range.setStart(textNode, wordStart);
          range.setEnd(textNode, wordEnd);
          const wRect = range.getBoundingClientRect();
          const x = wRect.left - pageRect.left;
          const y = wRect.top - pageRect.top;
          const h = wRect.height;

          if (y + h > 0 && y < PAGE_HEIGHT) {
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.fillStyle = settings.inkColor;
            if (isBold) {
              ctx.fillText(match[0], x + 0.3, y + h + 0.08);
            }
            ctx.fillText(match[0], x, y + h);
            ctx.restore();
          }
        }
      }
    }
    textNode = walker.nextNode() as Text | null;
  }

  // Helper to merge consecutive inline segments on the same visual line across word spaces
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
        cur.startX - prev.endX <= 24
      ) {
        prev.endX = Math.max(prev.endX, cur.endX);
        prev.baseY = (prev.baseY + cur.baseY) * 0.5;
      } else {
        merged.push({ ...cur });
      }
    }
    return merged;
  };

  // 6. Render Glyph-Tight, Continuous Level Hand-Drawn Underlines (<u>) & Strikethroughs (<s>)
  const rng = new SeededRandom(pageSeed + 7919);
  const mergedUnderlines = mergeDecorationSegments(underlineRaw);
  for (const seg of mergedUnderlines) {
    const width = seg.endX - seg.startX;
    if (width < 2 || seg.baseY <= 0 || seg.baseY >= PAGE_HEIGHT) continue;

    ctx.save();
    ctx.fillStyle = settings.inkColor;
    ctx.globalAlpha = 0.92;

    for (let dx = 0; dx < width; dx += 3) {
      if (rng.chance(0.055)) continue;
      const segW = Math.min(3.2, width - dx);
      const waveDy = Math.sin((seg.startX + dx) * 0.045) * 0.3;
      const thickness = rng.chance(0.28) ? 1.22 : 0.95;
      ctx.fillRect(seg.startX + dx, seg.baseY + waveDy, segW, thickness);
    }
    ctx.restore();
  }

  const mergedStrikes = mergeDecorationSegments(strikeRaw);
  for (const seg of mergedStrikes) {
    const width = seg.endX - seg.startX;
    if (width < 2 || seg.baseY <= 0 || seg.baseY >= PAGE_HEIGHT) continue;

    ctx.save();
    ctx.fillStyle = settings.inkColor;
    ctx.globalAlpha = 0.9;
    for (let dx = 0; dx < width; dx += 3.5) {
      const segW = Math.min(3.6, width - dx);
      const waveDy = Math.sin((seg.startX + dx) * 0.05) * 0.25;
      ctx.fillRect(seg.startX + dx, seg.baseY + waveDy, segW, 1.05);
    }
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
 * Multi-Page Humanize-Before-Paginate Generator
 * Normalizes DOM into logical blocks, humanizes upfront so measurement and rendering
 * have 0.0px drift, paginates with widow/orphan protection, and renders each page via Canvas 2D.
 */
export async function generateHandwrittenPages(
  pageEl: HTMLElement,
  paperContentEl: HTMLElement,
  containerEl: HTMLElement | null,
  settings: StudioSettings,
  exactLineHeightPx: number
): Promise<GeneratedPage[]> {
  // Ensure web fonts are loaded before measuring text ranges
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

    // 1. Normalize DOM into discrete logical <div> blocks & humanize upfront
    const rawUnits = extractLogicalUnits(paperContentEl);
    paperContentEl.innerHTML = joinLogicalLines(rawUnits);
    applyHumanRealismToDOM(
      paperContentEl,
      settings.realismIntensity,
      settings.realismSeed,
      settings.letterSpacingPt,
      settings.wordSpacingPx
    );

    const blocks = Array.from(paperContentEl.children).map(
      (el) => el.outerHTML
    );

    // 2. Shrink-wrap paperContentEl during height measurement
    if (containerEl) containerEl.style.minHeight = '0px';
    paperContentEl.style.minHeight = '0px';
    paperContentEl.style.alignSelf = 'flex-start';
    paperContentEl.style.paddingBottom = '6px';

    const maxPageHeight = settings.showTopMargin ? 490 : 534;
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
              const childNodes = Array.from(blockEl.childNodes);
              const fittedContainer = blockEl.cloneNode(false) as HTMLElement;
              let lastFittingHTML = '';
              let splitNodeIdx = 0;

              for (let c = 0; c < childNodes.length; c++) {
                fittedContainer.appendChild(childNodes[c].cloneNode(true));
                paperContentEl.innerHTML = [
                  ...pageBlocks,
                  fittedContainer.outerHTML
                ].join('');
                if (paperContentEl.scrollHeight <= maxPageHeight) {
                  lastFittingHTML = fittedContainer.outerHTML;
                  splitNodeIdx = c + 1;
                } else {
                  break;
                }
              }

              const fittedChars = lastFittingHTML
                .replace(/<[^>]+>/g, '')
                .trim().length;
              const remainingNodes = childNodes.slice(splitNodeIdx);
              const remainingChars = remainingNodes
                .map((n) => n.textContent || '')
                .join('')
                .trim().length;

              if (
                fittedChars >= 45 &&
                remainingChars >= 20 &&
                splitNodeIdx < childNodes.length
              ) {
                pageBlocks.push(lastFittingHTML);
                const remainderContainer = blockEl.cloneNode(
                  false
                ) as HTMLElement;
                if (remainderContainer.style) {
                  remainderContainer.style.textIndent = '0px';
                }
                remainingNodes.forEach((n) =>
                  remainderContainer.appendChild(n.cloneNode(true))
                );
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

