const pageEl = document.querySelector('.page-a');
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function addFontFromFile(fileObj) {
  if (!fileObj) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const newFont = new FontFace('temp-font', e.target.result);
    newFont.load().then((loadedFace) => {
      document.fonts.add(loadedFace);
      pageEl.style.fontFamily = 'temp-font';
      document.body.style.setProperty('--handwriting-font', 'temp-font');
    });
  };
  reader.readAsArrayBuffer(fileObj);
}

/**
 * @method createPDF
 * @param imgs array of images (in base64)
 * @description
 * Creates PDF from list of given images
 */
function createPDF(imgs) {
  // eslint-disable-next-line new-cap
  const doc = new jsPDF('p', 'pt', 'a4');
  const width = doc.internal.pageSize.width;
  const height = doc.internal.pageSize.height;
  for (const i in imgs) {
    doc.addImage(
      imgs[i],
      'PNG',
      0,
      0,
      width,
      height,
      'image-' + i,
      'FAST'
    );
    if (i != imgs.length - 1) {
      doc.addPage();
    }
  }
  doc.save('handwritten-sheet.pdf');
}

function applyInlineMarkdown(str) {
  return (
    str
      // Bold + Italic (***text***)
      .replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>')
      // Bold (**text**)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      // Underline (__text__)
      .replace(/__(.+?)__/g, '<u>$1</u>')
      // Italic (*text* or _text_)
      .replace(/\*(?!\s)(.+?)(?<!\s)\*/g, '<i>$1</i>')
      // Strikethrough (~~text~~)
      .replace(/~~(.+?)~~/g, '<s>$1</s>')
      // Inline code (`text` -> underlined/bold key term)
      .replace(/`([^`]+)`/g, '<b>$1</b>')
  );
}

/**
 * Sanitizes rich HTML clipboard data (from ChatGPT, Notion, Google Docs, Word, Webpages)
 * into clean, ruled-line-friendly handwritten HTML (preserving bold, italic, underline,
 * headings, numbered lists, and bullet points while stripping background colors, fonts, and margins).
 */
function sanitizeRichHTMLToHandwriting(rawHTML) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHTML, 'text/html');
  const outLines = [];

  function processInlineNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const escaped = node.nodeValue
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return applyInlineMarkdown(escaped);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '<br/>';

    const childrenHTML = Array.from(node.childNodes)
      .map(processInlineNode)
      .join('');

    const fontWeight = node.style ? node.style.fontWeight : '';
    const textDecoration = node.style ? node.style.textDecoration : '';
    const fontStyle = node.style ? node.style.fontStyle : '';

    let res = childrenHTML;
    if (
      tag === 'b' ||
      tag === 'strong' ||
      fontWeight === 'bold' ||
      Number(fontWeight) >= 600
    ) {
      res = `<b>${res}</b>`;
    }
    if (tag === 'i' || tag === 'em' || fontStyle === 'italic') {
      res = `<i>${res}</i>`;
    }
    if (
      tag === 'u' ||
      (textDecoration && textDecoration.includes('underline'))
    ) {
      res = `<u>${res}</u>`;
    }
    if (
      tag === 's' ||
      tag === 'strike' ||
      tag === 'del' ||
      (textDecoration && textDecoration.includes('line-through'))
    ) {
      res = `<s>${res}</s>`;
    }
    return res;
  }

  function walkBlocks(parent) {
    Array.from(parent.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue.trim();
        if (text) {
          outLines.push(applyInlineMarkdown(text));
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();

      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const content = processInlineNode(node).trim();
        if (content) {
          if (tag === 'h1' || tag === 'h2') {
            outLines.push(
              `<div style="text-align: center;"><b><u>${content}</u></b></div>`
            );
          } else {
            outLines.push(`<b><u>${content}</u></b>`);
          }
        }
      } else if (tag === 'ul') {
        Array.from(node.children).forEach((li) => {
          if (li.tagName && li.tagName.toLowerCase() === 'li') {
            const itemHTML = processInlineNode(li).trim();
            if (itemHTML) outLines.push(`&nbsp;&nbsp;&bull; ${itemHTML}`);
          }
        });
      } else if (tag === 'ol') {
        let idx = 1;
        Array.from(node.children).forEach((li) => {
          if (li.tagName && li.tagName.toLowerCase() === 'li') {
            const itemHTML = processInlineNode(li).trim();
            if (itemHTML) outLines.push(`&nbsp;&nbsp;${idx}. ${itemHTML}`);
            idx++;
          }
        });
      } else if (tag === 'p' || tag === 'div' || tag === 'blockquote') {
        // Check if it contains nested block elements
        const hasBlockChild = Array.from(node.children).some((c) =>
          ['p', 'div', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'blockquote'].includes(
            c.tagName.toLowerCase()
          )
        );
        if (hasBlockChild) {
          walkBlocks(node);
        } else {
          const content = processInlineNode(node).trim();
          const align = node.style ? node.style.textAlign : '';
          if (content) {
            if (align === 'center' || align === 'right') {
              outLines.push(`<div style="text-align: ${align};">${content}</div>`);
            } else {
              outLines.push(content);
            }
          }
        }
      } else if (tag === 'br') {
        outLines.push('');
      } else {
        const content = processInlineNode(node).trim();
        if (content) outLines.push(content);
      }
    });
  }

  walkBlocks(doc.body);
  return outLines.join('<br/>');
}

function parsePlainMarkdownToHandwriting(rawText) {
  const lines = rawText.split(/\r?\n/);
  const formattedLines = lines.map((line) => {
    let l = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Top-level H1/H2 Heading (# Heading or ## Heading -> centered bold underlined title)
    if (/^#{1,2}\s+(.+)$/.test(l)) {
      const headingText = applyInlineMarkdown(l.replace(/^#{1,2}\s+/, ''));
      return `<div style="text-align: center;"><b><u>${headingText}</u></b></div>`;
    }

    // Sub-headings (### Heading -> left-aligned bold underlined heading)
    if (/^#{3,6}\s+(.+)$/.test(l)) {
      const headingText = applyInlineMarkdown(l.replace(/^#{3,6}\s+/, ''));
      return `<b><u>${headingText}</u></b>`;
    }

    // Bullet points (* item, - item, • item)
    if (/^\s*[-*•]\s+(.+)$/.test(l)) {
      const bulletText = applyInlineMarkdown(l.replace(/^\s*[-*•]\s+/, ''));
      return `&nbsp;&nbsp;&bull; ${bulletText}`;
    }

    // Numbered section headers or list items (e.g. "1. What is Adaptability?")
    if (/^\s*(\d+[\.\)])\s+(.+)$/.test(l)) {
      const match = l.match(/^(\s*)(\d+[\.\)])\s+(.+)$/);
      if (match) {
        const indent = match[1] ? '&nbsp;&nbsp;' : '';
        const num = match[2];
        const rest = applyInlineMarkdown(match[3]);
        return `${indent}${num} ${rest}`;
      }
    }

    return applyInlineMarkdown(l);
  });

  return formattedLines.join('<br/>');
}

function formatText(event) {
  event.preventDefault();
  const htmlData = event.clipboardData.getData('text/html');
  const plainText = event.clipboardData.getData('text/plain');

  // If the plain text explicitly has Markdown syntax (#, **, * ), parse via Markdown parser;
  // otherwise if rich HTML is available (copied from ChatGPT/Notion/Docs), preserve its rich formatting!
  const hasExplicitMarkdown = /(^#{1,6}\s|\*\*.+?\*\*|^\s*[-*]\s+)/m.test(
    plainText
  );

  let finalHTML = '';
  if (htmlData && htmlData.trim().length > 0 && !hasExplicitMarkdown) {
    finalHTML = sanitizeRichHTMLToHandwriting(htmlData);
  }
  if (!finalHTML) {
    finalHTML = parsePlainMarkdownToHandwriting(plainText);
  }

  document.execCommand('insertHTML', false, finalHTML);
}

/**
 * Converts the current handwritten HTML in .paper-content into clean Markdown
 * when copying out of the sheet (Ctrl+C) so formatting is preserved as Markdown!
 */
function htmlToMarkdown(containerEl) {
  const clone = containerEl.cloneNode(true);

  function nodeToMd(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue.replace(/\u00a0/g, ' ');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '\n';

    const inner = Array.from(node.childNodes).map(nodeToMd).join('');
    if (!inner) return '';

    if (tag === 'b' || tag === 'strong') {
      return `**${inner.trim()}**`;
    }
    if (tag === 'i' || tag === 'em') {
      return `*${inner.trim()}*`;
    }
    if (tag === 'u') {
      return `__${inner.trim()}__`;
    }
    if (tag === 's' || tag === 'strike' || tag === 'del') {
      return `~~${inner.trim()}~~`;
    }
    if (tag === 'li') {
      return `- ${inner.trim()}\n`;
    }
    if (tag === 'div' || tag === 'p') {
      const align = node.style ? node.style.textAlign : '';
      if (align === 'center') {
        const stripped = inner
          .replace(/^\*\*__(.+?)__\*\*$/, '$1')
          .replace(/^__\*\*(.+?)\*\*__$/, '$1');
        return `# ${stripped.trim()}\n`;
      }
      return `${inner}\n`;
    }
    return inner;
  }

  return Array.from(clone.childNodes)
    .map(nodeToMd)
    .join('')
    .replace(/• /g, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function copyFormattedAsMarkdown(event) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  const tempDiv = document.createElement('div');
  tempDiv.appendChild(range.cloneContents());

  const mdText = htmlToMarkdown(tempDiv);
  const htmlSnippet = tempDiv.innerHTML;

  if (mdText && event.clipboardData) {
    event.preventDefault();
    event.clipboardData.setData('text/plain', mdText);
    event.clipboardData.setData('text/html', htmlSnippet);
  }
}

/**
 * Optimizes and applies uploaded paper background image:
 * - Converts to DataURL for high-res html2canvas rendering without CORS/blob issues
 * - Fits cleanly to page (100% 100%, no-repeat, centered)
 * - Automatically turns off built-in CSS lines & margins so there are no duplicate overlapping lines
 */
function addPaperFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    pageEl.classList.remove('stencil-ruled');
    pageEl.style.backgroundImage = `url("${dataUrl}")`;
    pageEl.style.backgroundSize = '100% 100%';
    pageEl.style.backgroundPosition = 'center center';
    pageEl.style.backgroundRepeat = 'no-repeat';
    pageEl.classList.add('custom-paper-bg');

    // Automatically turn off CSS lines & margin so uploaded ruled stencil isn't doubled
    setToggleState('#paper-line-toggle', false);
    setToggleState('#paper-margin-toggle', false);

    const clearBtn = document.querySelector('#clear-paper-file');
    if (clearBtn) {
      clearBtn.style.display = 'inline-block';
    }
  };
  reader.readAsDataURL(file);
}

function setToggleState(selector, checked) {
  const toggle = document.querySelector(selector);
  if (!toggle) return;
  toggle.checked = checked;
  toggle.setAttribute('aria-checked', checked ? 'true' : 'false');
  const labelStatus = document.querySelector(
    `label[for="${toggle.id}"] .status`
  );
  if (labelStatus) {
    labelStatus.textContent = checked ? 'on' : 'off';
  }
  if (selector === '#paper-margin-toggle') {
    pageEl.classList.toggle('margined', checked);
  } else if (selector === '#paper-line-toggle') {
    pageEl.classList.toggle('lines', checked);
  }
}

function syncLineGrid() {
  const paperContentEl = document.querySelector('.page-a .paper-content');
  const lineHeightInput = document.querySelector('#line-height');
  const topPaddingInput = document.querySelector('#top-padding');
  const leftPaddingInput = document.querySelector('#left-padding');

  const lhEm = lineHeightInput ? Number(lineHeightInput.value) || 1.2 : 1.2;
  const computedFontSize = parseFloat(getComputedStyle(pageEl).fontSize) || 14;

  // MUST be an exact integer pixel value (e.g. 17px, 21px) because Blink/Chrome truncates fractional CSS line-heights on text boxes while keeping fractional background-size, causing cumulative drift!
  const exactLineHeightPx = Math.max(12, Math.round(computedFontSize * lhEm));

  const topPadPx = topPaddingInput
    ? Math.round(Number(topPaddingInput.value))
    : 44;

  const leftPadPx = leftPaddingInput
    ? Math.round(Number(leftPaddingInput.value))
    : 66;

  pageEl.style.lineHeight = `${exactLineHeightPx}px`;
  document.body.style.setProperty('--line-height-val', `${exactLineHeightPx}px`);
  const lineStopPx = Math.max(1, +(exactLineHeightPx - 1.4).toFixed(2));
  document.body.style.setProperty('--line-stop-px', `${lineStopPx}px`);

  // Position ruled line gradient so the bottom of each background tile lands right under the text baseline (-2px for descender clearance)
  const bgOffset = Math.max(0, topPadPx - 2);
  document.body.style.setProperty('--line-bg-offset', `${bgOffset}px`);
  document.body.style.setProperty(
    '--left-margin-pos',
    `${Math.max(0, leftPadPx - 6)}px`
  );

  if (paperContentEl) {
    paperContentEl.style.paddingTop = `${topPadPx}px`;
    paperContentEl.style.paddingLeft = `${leftPadPx}px`;
  }
}

function applyStencilPreset(presetName) {
  const paperContentEl = document.querySelector('.page-a .paper-content');
  const lineHeightInput = document.querySelector('#line-height');
  const topPaddingInput = document.querySelector('#top-padding');
  const leftPaddingInput = document.querySelector('#left-padding');

  // Clear inline background image first
  pageEl.style.backgroundImage = '';
  pageEl.classList.remove('custom-paper-bg');

  if (presetName === 'blank') {
    setToggleState('#paper-line-toggle', false);
    setToggleState('#paper-margin-toggle', false);
    if (paperContentEl) {
      paperContentEl.style.margin = '0px';
    }
    if (lineHeightInput) lineHeightInput.value = '1.5';
    if (topPaddingInput) topPaddingInput.value = '28';
    if (leftPaddingInput) leftPaddingInput.value = '32';
    syncLineGrid();
  } else {
    // 'default' standard adjustable CSS notebook
    setToggleState('#paper-line-toggle', true);
    setToggleState('#paper-margin-toggle', true);
    if (paperContentEl) {
      paperContentEl.style.margin = '0px';
    }
    if (lineHeightInput) lineHeightInput.value = '1.5';
    if (topPaddingInput) topPaddingInput.value = '5';
    if (leftPaddingInput) leftPaddingInput.value = '55';
    syncLineGrid();
  }
}

function clearPaperBackground() {
  const paperInput = document.querySelector('#paper-file');
  if (paperInput) {
    paperInput.value = '';
  }
  const clearBtn = document.querySelector('#clear-paper-file');
  if (clearBtn) {
    clearBtn.style.display = 'none';
  }
  const presetSelect = document.querySelector('#paper-stencil-preset');
  const currentPreset = presetSelect ? presetSelect.value : 'default';
  applyStencilPreset(currentPreset);
}

export {
  isMobile,
  addFontFromFile,
  createPDF,
  formatText,
  copyFormattedAsMarkdown,
  addPaperFromFile,
  clearPaperBackground,
  applyStencilPreset,
  syncLineGrid
};
