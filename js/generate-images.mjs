import {
  applyHumanRealismToDOM,
  postProcessHandwritingCanvas
} from './utils/humanize.mjs';
import {
  applyPaperStyles,
  removePaperStyles,
  renderOutput
} from './utils/generate-utils.mjs';
import { createPDF } from './utils/helpers.mjs';

const pageEl = document.querySelector('.page-a');
let outputImages = [];

/**
 * To generate image, we add styles to DIV and converts that HTML Element into Image.
 * This is the function that deals with it.
 */
async function convertDIVToImage(alreadyHumanized = false) {
  const paperContentEl = document.querySelector('.page-a .paper-content');
  const realismEl = document.querySelector('#human-realism');
  const realismIntensity = realismEl ? Number(realismEl.value) : 1.0;

  // Only humanize here if not already humanized before pagination measurement
  const restoreDOM = alreadyHumanized
    ? () => {}
    : applyHumanRealismToDOM(paperContentEl, realismIntensity);

  const options = {
    scrollX: 0,
    scrollY: -window.scrollY,
    scale: Number(document.querySelector('#resolution').value) || 3,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true
  };

  /** Function html2canvas comes from a library html2canvas which is included in the index.html */
  let canvas;
  try {
    canvas = await html2canvas(pageEl, options);
    postProcessHandwritingCanvas(canvas, realismIntensity);
  } finally {
    restoreDOM();
  }

  /** Send image data for modification if effect is scanner */
  if (document.querySelector('#page-effects').value === 'scanner') {
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    contrastImage(imageData, 0.55);
    canvas.getContext('2d').putImageData(imageData, 0, 0);
  }

  outputImages.push(canvas);
  // Displaying no. of images on addition
  if (outputImages.length >= 1) {
    document.querySelector('#output-header').textContent =
      'Output ' + '( ' + outputImages.length + ' )';
  }
}

/**
 * Renders an array of logical lines/blocks into .paper-content using zero-margin <div> blocks
 * so inline lines, centered titles, indented bullet/numbered items, and blank spacer lines ("")
 * all have 100% deterministic integer multiples of --line-height-val with zero <br> ambiguity.
 */
function joinLogicalLines(lines) {
  return lines
    .map((raw) => {
      const trimmed = raw.trim();
      if (trimmed === '') {
        return '<div style="margin:0; padding:0;">&nbsp;</div>';
      }
      if (/^<div\b/i.test(trimmed)) {
        return trimmed;
      }
      return `<div style="margin:0; padding:0;">${raw}</div>`;
    })
    .join('');
}

/**
 * Normalizes the editor DOM into an array of discrete logical lines/blocks
 * while preserving 100% of formatting (centered headings, empty blank lines,
 * bullet points, numbered lists, bold, italic, underline) matching HTML5 layout rules.
 */
function extractLogicalUnits(paperContentEl) {
  const units = [];
  let inlineBuffer = '';

  function flushInline() {
    if (inlineBuffer.trim() !== '') {
      units.push(inlineBuffer);
    }
    inlineBuffer = '';
  }

  function walkNodes(parentEl, inheritedAlign = '') {
    Array.from(parentEl.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const escaped = node.nodeValue
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        inlineBuffer += escaped;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();

      if (tag === 'br') {
        if (inlineBuffer.trim() !== '') {
          flushInline();
        } else {
          units.push('');
        }
        return;
      }

      if (tag === 'ul') {
        flushInline();
        Array.from(node.children).forEach((li) => {
          if (li.tagName && li.tagName.toLowerCase() === 'li') {
            units.push(
              `<div style="margin:0; padding:0 0 0 18px; text-indent:-12px;">&bull; ${li.innerHTML}</div>`
            );
          }
        });
        return;
      }

      if (tag === 'ol') {
        flushInline();
        let idx = 1;
        Array.from(node.children).forEach((li) => {
          if (li.tagName && li.tagName.toLowerCase() === 'li') {
            units.push(
              `<div style="margin:0; padding:0 0 0 18px; text-indent:-14px;">${idx}. ${li.innerHTML}</div>`
            );
            idx++;
          }
        });
        return;
      }

      if (
        tag === 'div' ||
        tag === 'p' ||
        tag === 'h1' ||
        tag === 'h2' ||
        tag === 'h3' ||
        tag === 'h4' ||
        tag === 'blockquote'
      ) {
        flushInline();
        const align =
          (node.style && node.style.textAlign) ||
          node.getAttribute('align') ||
          inheritedAlign;
        const padLeft = node.style ? node.style.paddingLeft : '';
        const textIndent = node.style ? node.style.textIndent : '';

        // Empty block (e.g. <div><br></div>) is a single blank line
        if (node.textContent.trim() === '' && !node.querySelector('img')) {
          units.push('');
          return;
        }

        // If the block has nested block elements or <br>, split its contents while keeping alignment
        const hasNestedBlocks = Array.from(node.children).some((c) =>
          ['div', 'p', 'ul', 'ol', 'br'].includes(c.tagName.toLowerCase())
        );

        let styleStr = 'margin:0; padding:0;';
        if (padLeft) styleStr = `margin:0; padding:0 0 0 ${padLeft};`;
        if (textIndent) styleStr += ` text-indent:${textIndent};`;
        if (align) styleStr += ` text-align:${align};`;

        if (!hasNestedBlocks) {
          units.push(`<div style="${styleStr}">${node.innerHTML}</div>`);
        } else {
          const prevLen = units.length;
          walkNodes(node, align);
          flushInline();
          if (align) {
            for (let k = prevLen; k < units.length; k++) {
              if (units[k].trim() !== '' && !/^<div\b/i.test(units[k])) {
                units[k] =
                  `<div style="margin:0; padding:0; text-align:${align};">${units[k]}</div>`;
              }
            }
          }
        }
        return;
      }

      // Inline element (<b>, <u>, <i>, <s>, <span>, etc.)
      inlineBuffer += node.outerHTML;
    });
  }

  walkNodes(paperContentEl);
  flushInline();

  while (units.length > 0 && units[0].trim() === '') {
    units.shift();
  }
  while (units.length > 0 && units[units.length - 1].trim() === '') {
    units.pop();
  }
  return units;
}

/**
 * Checks whether a block's plain text is a standalone section heading or numbered header
 * that should never be stranded alone at the very bottom of a page.
 */
function isHeadingBlock(blockHTML) {
  const plain = blockHTML
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  if (!plain) return false;
  if (/^\d+[\.\)]\s+\S+/.test(plain) && plain.length < 58 && !/\.$/.test(plain)) {
    return true;
  }
  if (
    /^(#[#\s]*|[A-Z][a-zA-Z\s\-]{2,40}:)$/.test(plain) &&
    plain.length < 45
  ) {
    return true;
  }
  return false;
}

function isBlankBlock(blockHTML) {
  const plain = blockHTML
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return plain.length === 0;
}

/**
 * This is the function that gets called on clicking "Generate Image" button.
 *
 * CRITICAL PAGINATION ARCHITECTURE:
 * We normalize into logical <div> blocks AND apply human realism (`applyHumanRealismToDOM`)
 * BEFORE measuring `scrollHeight` and splitting pages. This guarantees 0.0px difference
 * between pagination height measurement and `html2canvas` rendering, so no sentence or
 * numbered item can ever wrap onto an extra line after pagination and get clipped at a page break!
 */
export async function generateImages() {
  applyPaperStyles();
  pageEl.scroll(0, 0);

  const paperContentEl = document.querySelector('.page-a .paper-content');
  const containerEl = document.querySelector('.left-margin-and-content');
  const realismEl = document.querySelector('#human-realism');
  const realismIntensity = realismEl ? Number(realismEl.value) : 1.0;

  const initialPaperContent = paperContentEl.innerHTML;
  const prevContainerMinHeight = containerEl ? containerEl.style.minHeight : '';
  const prevPaperMinHeight = paperContentEl.style.minHeight;
  const prevAlignSelf = paperContentEl.style.alignSelf;
  const prevPaddingBottom = paperContentEl.style.paddingBottom;

  try {
    // 1. Normalize DOM into discrete logical <div> blocks and apply humanization ONCE upfront
    const rawUnits = extractLogicalUnits(paperContentEl);
    paperContentEl.innerHTML = joinLogicalLines(rawUnits);
    applyHumanRealismToDOM(paperContentEl, realismIntensity);

    // Extract the already-humanized block outerHTMLs so pagination measures the EXACT final layout
    const blocks = Array.from(paperContentEl.children).map((el) => el.outerHTML);

    // 2. Shrink-wrap paperContentEl during height measurement
    if (containerEl) containerEl.style.minHeight = '0px';
    paperContentEl.style.minHeight = '0px';
    paperContentEl.style.alignSelf = 'flex-start';
    paperContentEl.style.paddingBottom = '6px';

    // Subtract top-margin height (50px) if .margined is active, plus safe bottom margin so descenders never clip
    const isMargined = pageEl.classList.contains('margined');
    const maxPageHeight = isMargined ? 490 : 534;
    const totalScrollHeight = paperContentEl.scrollHeight;

    if (totalScrollHeight > maxPageHeight && blocks.length > 1) {
      if (initialPaperContent.includes('<img')) {
        alert(
          "You're trying to generate more than one page, Images and some formatting may not work correctly with multiple images" // eslint-disable-line max-len
        );
      }

      let blockIdx = 0;
      while (blockIdx < blocks.length) {
        // Skip leading blank lines at the top of a new page
        while (blockIdx < blocks.length && isBlankBlock(blocks[blockIdx])) {
          blockIdx++;
        }
        if (blockIdx >= blocks.length) break;

        const pageBlocks = [];

        while (blockIdx < blocks.length) {
          const candidateBlock = blocks[blockIdx];
          paperContentEl.innerHTML = [...pageBlocks, candidateBlock].join('');

          if (paperContentEl.scrollHeight <= maxPageHeight) {
            pageBlocks.push(candidateBlock);
            blockIdx++;
          } else {
            // If a blank spacer line overflowed at the bottom of the page, skip it and finish this page
            if (isBlankBlock(candidateBlock)) {
              blockIdx++;
              break;
            }

            // If this is a long multi-line paragraph (3+ lines) and not a short numbered/bullet point,
            // try fitting as many whole humanized words (.hw-word) as fit on the current page
            const tempWrapper = document.createElement('div');
            tempWrapper.innerHTML = candidateBlock;
            const blockEl = tempWrapper.firstElementChild;
            const plainText = blockEl ? blockEl.textContent.trim() : '';

            if (
              blockEl &&
              plainText.length >= 110 &&
              !isHeadingBlock(candidateBlock)
            ) {
              const childNodes = Array.from(blockEl.childNodes);
              const fittedContainer = blockEl.cloneNode(false);
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
                const remainderContainer = blockEl.cloneNode(false);
                // Remove negative text-indent on continuation of an indented paragraph
                if (remainderContainer.style) {
                  remainderContainer.style.textIndent = '0px';
                }
                remainingNodes.forEach((n) =>
                  remainderContainer.appendChild(n.cloneNode(true))
                );
                blocks[blockIdx] = remainderContainer.outerHTML;
              }
            }

            // Safety fallback if a single huge block on an empty page exceeds maxPageHeight
            if (pageBlocks.length === 0) {
              pageBlocks.push(candidateBlock);
              blockIdx++;
            }
            break;
          }
        }

        // Remove trailing blank spacer lines at the bottom of the page
        while (
          pageBlocks.length > 1 &&
          isBlankBlock(pageBlocks[pageBlocks.length - 1])
        ) {
          pageBlocks.pop();
        }

        // Human Widow/Orphan Protection:
        // Never leave a standalone section heading (like "4. Differences" or "Objective:")
        // stranded at the bottom of a page without at least 1 line of its body content below it
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

        // Render the exact humanized blocks that were measured for this page
        paperContentEl.innerHTML = pageBlocks.join('');

        // Restore full-page container height while taking the snapshot so ruled lines fill the page
        if (containerEl) containerEl.style.minHeight = prevContainerMinHeight;
        paperContentEl.style.minHeight = prevPaperMinHeight;
        paperContentEl.style.alignSelf = prevAlignSelf;
        paperContentEl.style.paddingBottom = prevPaddingBottom;
        pageEl.scrollTo(0, 0);

        await convertDIVToImage(true);

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
      await convertDIVToImage(true);
    }
  } finally {
    paperContentEl.innerHTML = initialPaperContent;
    if (containerEl) containerEl.style.minHeight = prevContainerMinHeight;
    paperContentEl.style.minHeight = prevPaperMinHeight;
    paperContentEl.style.alignSelf = prevAlignSelf;
    paperContentEl.style.paddingBottom = prevPaddingBottom;
  }

  removePaperStyles();
  renderOutput(outputImages);
  setRemoveImageListeners();
}

/**
 * Delete all generated images
 */

export const deleteAll = () => {
  outputImages.splice(0, outputImages.length);
  renderOutput(outputImages);
  document.querySelector('#output-header').textContent =
    'Output' + (outputImages.length ? ' ( ' + outputImages.length + ' )' : '');
};

const arrayMove = (arr, oldIndex, newIndex) => {
  if (newIndex >= arr.length) {
    let k = newIndex - arr.length + 1;
    while (k--) {
      arr.push(undefined);
    }
  }
  arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
  return arr; // for testing
};

export const moveLeft = (index) => {
  if (index === 0) return outputImages;
  outputImages = arrayMove(outputImages, index, index - 1);
  renderOutput(outputImages);
};

export const moveRight = (index) => {
  if (index + 1 === outputImages.length) return outputImages;
  outputImages = arrayMove(outputImages, index, index + 1);
  renderOutput(outputImages);
};

/**
 * Downloads generated images as PDF
 */
export const downloadAsPDF = () => createPDF(outputImages);

/**
 * Sets event listeners for close button on output images.
 */
function setRemoveImageListeners() {
  document
    .querySelectorAll('.output-image-container > .close-button')
    .forEach((closeButton) => {
      closeButton.addEventListener('click', (e) => {
        outputImages.splice(Number(e.target.dataset.index), 1);
        // Displaying no. of images on deletion
        if (outputImages.length >= 0) {
          document.querySelector('#output-header').textContent =
            'Output' +
            (outputImages.length ? ' ( ' + outputImages.length + ' )' : '');
        }
        renderOutput(outputImages);
        // When output changes, we have to set remove listeners again
        setRemoveImageListeners();
      });
    });

  document.querySelectorAll('.move-left').forEach((leftButton) => {
    leftButton.addEventListener('click', (e) => {
      moveLeft(Number(e.target.dataset.index));
      // Displaying no. of images on deletion
      renderOutput(outputImages);
      // When output changes, we have to set remove listeners again
      setRemoveImageListeners();
    });
  });

  document.querySelectorAll('.move-right').forEach((rightButton) => {
    rightButton.addEventListener('click', (e) => {
      moveRight(Number(e.target.dataset.index));
      // Displaying no. of images on deletion
      renderOutput(outputImages);
      // When output changes, we have to set remove listeners again
      setRemoveImageListeners();
    });
  });
}

/** Modifies image data to add contrast */

function contrastImage(imageData, contrast) {
  const data = imageData.data;
  contrast *= 255;
  const factor = (contrast + 255) / (255.01 - contrast);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = factor * (data[i] - 128) + 128;
    data[i + 1] = factor * (data[i + 1] - 128) + 128;
    data[i + 2] = factor * (data[i + 2] - 128) + 128;
  }
  return imageData;
}
