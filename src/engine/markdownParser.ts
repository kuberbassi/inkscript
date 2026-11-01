export function applyInlineMarkdown(str: string): string {
  return str
    .replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/\*(?!\s)(.+?)(?<!\s)\*/g, '<i>$1</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<b>$1</b>');
}

/**
 * Sanitizes rich HTML clipboard data (from ChatGPT, Notion, Google Docs, Word, Webpages)
 * into clean, ruled-line-friendly handwritten HTML.
 */
export function sanitizeRichHTMLToHandwriting(rawHTML: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHTML, 'text/html');
  const outLines: string[] = [];

  function processInlineNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const escaped = (node.nodeValue || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return applyInlineMarkdown(escaped);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') return '<br/>';

    const childrenHTML = Array.from(el.childNodes)
      .map(processInlineNode)
      .join('');

    const fontWeight = el.style ? el.style.fontWeight : '';
    const textDecoration = el.style ? el.style.textDecoration : '';
    const fontStyle = el.style ? el.style.fontStyle : '';

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

  function walkBlocks(parent: Node): void {
    Array.from(parent.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.nodeValue || '').trim();
        if (text) {
          outLines.push(applyInlineMarkdown(text));
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const content = processInlineNode(el).trim();
        if (content) {
          if (tag === 'h1' || tag === 'h2') {
            outLines.push(
              `<div style="text-align: center;"><b><u>${content}</u></b></div>`
            );
          } else {
            outLines.push(`<div style="margin:0; padding:0;"><b><u>${content}</u></b></div>`);
          }
        }
      } else if (tag === 'ul') {
        Array.from(el.children).forEach((li) => {
          if (li.tagName && li.tagName.toLowerCase() === 'li') {
            const itemHTML = processInlineNode(li).trim();
            if (itemHTML) {
              outLines.push(
                `<div style="margin:0; padding:0 0 0 18px; text-indent:-12px;">&bull; ${itemHTML}</div>`
              );
            }
          }
        });
      } else if (tag === 'ol') {
        let idx = 1;
        Array.from(el.children).forEach((li) => {
          if (li.tagName && li.tagName.toLowerCase() === 'li') {
            const itemHTML = processInlineNode(li).trim();
            if (itemHTML) {
              outLines.push(
                `<div style="margin:0; padding:0 0 0 18px; text-indent:-14px;">${idx}. ${itemHTML}</div>`
              );
            }
            idx++;
          }
        });
      } else if (tag === 'p' || tag === 'div' || tag === 'blockquote') {
        const hasBlockChild = Array.from(el.children).some((c) =>
          [
            'p',
            'div',
            'ul',
            'ol',
            'h1',
            'h2',
            'h3',
            'h4',
            'blockquote'
          ].includes(c.tagName.toLowerCase())
        );
        if (hasBlockChild) {
          walkBlocks(el);
        } else {
          const content = processInlineNode(el).trim();
          const align = el.style ? el.style.textAlign : '';
          if (content) {
            if (align === 'center' || align === 'right') {
              outLines.push(
                `<div style="text-align: ${align};">${content}</div>`
              );
            } else {
              outLines.push(content);
            }
          }
        }
      } else if (tag === 'br') {
        outLines.push('');
      } else if (tag === 'table') {
        const rows: string[] = [];
        const trs = Array.from(el.querySelectorAll('tr'));
        trs.forEach((tr, rIdx) => {
          const cells: string[] = [];
          const thOrTds = Array.from(tr.children);
          thOrTds.forEach((cell) => {
            const isHeader = cell.tagName.toLowerCase() === 'th' || rIdx === 0;
            const cellContent = processInlineNode(cell).trim();
            const cellTag = isHeader ? 'th' : 'td';
            cells.push(
              `<${cellTag}>${isHeader ? `<b>${cellContent}</b>` : cellContent}</${cellTag}>`
            );
          });
          if (cells.length > 0) {
            rows.push(`<tr>${cells.join('')}</tr>`);
          }
        });
        if (rows.length > 0) {
          outLines.push(`<table class="hw-table">${rows.join('')}</table>`);
        }
      } else {
        const content = processInlineNode(el).trim();
        if (content) outLines.push(content);
      }
    });
  }

  walkBlocks(doc.body);
  return outLines.join('<br/>');
}

function parseMarkdownTable(tableLines: string[]): string {
  const delimIdx = tableLines.findIndex((line) =>
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)
  );
  if (delimIdx < 1) {
    return tableLines.map(applyInlineMarkdown).join('<br/>');
  }

  const parseRow = (line: string): string[] => {
    let clean = line.trim();
    if (clean.startsWith('|')) clean = clean.slice(1);
    if (clean.endsWith('|')) clean = clean.slice(0, -1);
    return clean.split('|').map((c) => applyInlineMarkdown(c.trim()));
  };

  const headerRows = tableLines.slice(0, delimIdx);
  const bodyRows = tableLines.slice(delimIdx + 1);

  const theadHTML = headerRows
    .map((row) => {
      const cells = parseRow(row);
      return `<tr>${cells.map((c) => `<th><b>${c}</b></th>`).join('')}</tr>`;
    })
    .join('');

  const tbodyHTML = bodyRows
    .map((row) => {
      const cells = parseRow(row);
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    })
    .join('');

  return `<table class="hw-table">${theadHTML ? `<thead>${theadHTML}</thead>` : ''}${tbodyHTML ? `<tbody>${tbodyHTML}</tbody>` : ''}</table>`;
}

export function parsePlainMarkdownToHandwriting(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  const outChunks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const isTableLine = line.includes('|');
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
    const isDelimNext = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(nextLine);

    if (isTableLine && isDelimNext) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i].includes('|') ||
          /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(lines[i]))
      ) {
        tableLines.push(lines[i]);
        i++;
      }
      outChunks.push(parseMarkdownTable(tableLines));
      continue;
    }

    const l = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (/^#{1,2}\s+(.+)$/.test(l)) {
      const headingText = applyInlineMarkdown(l.replace(/^#{1,2}\s+/, ''));
      outChunks.push(`<div style="text-align: center;"><b><u>${headingText}</u></b></div>`);
      i++;
      continue;
    }

    if (/^#{3,6}\s+(.+)$/.test(l)) {
      const headingText = applyInlineMarkdown(l.replace(/^#{3,6}\s+/, ''));
      outChunks.push(`<div style="margin:0; padding:0;"><b><u>${headingText}</u></b></div>`);
      i++;
      continue;
    }

    if (/^\s*[-*•]\s+(.+)$/.test(l)) {
      const bulletText = applyInlineMarkdown(l.replace(/^\s*[-*•]\s+/, ''));
      outChunks.push(`<div style="margin:0; padding:0 0 0 18px; text-indent:-12px;">&bull; ${bulletText}</div>`);
      i++;
      continue;
    }

    if (/^\s*(\d+[.)])\s+(.+)$/.test(l)) {
      const match = l.match(/^(\s*)(\d+[.)])\s+(.+)$/);
      if (match) {
        const isIndented = match[1].length > 0;
        const num = match[2];
        const rest = applyInlineMarkdown(match[3]);
        if (isIndented) {
          outChunks.push(`<div style="margin:0; padding:0 0 0 18px; text-indent:-14px;">${num} ${rest}</div>`);
        } else {
          outChunks.push(`${num} ${rest}`);
        }
        i++;
        continue;
      }
    }

    outChunks.push(applyInlineMarkdown(l));
    i++;
  }

  return outChunks.join('<br/>');
}

export function htmlToMarkdown(containerEl: HTMLElement): string {
  const clone = containerEl.cloneNode(true) as HTMLElement;

  function nodeToMd(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.nodeValue || '').replace(/\u00a0/g, ' ');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') return '\n';

    const inner = Array.from(el.childNodes).map(nodeToMd).join('');
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
    if (tag === 'table') {
      const trs = Array.from(el.querySelectorAll('tr'));
      const mdRows = trs.map((tr) => {
        const cells = Array.from(tr.querySelectorAll('th, td')).map((c) =>
          nodeToMd(c).trim()
        );
        return `| ${cells.join(' | ')} |`;
      });
      if (mdRows.length > 0) {
        const colCount = (trs[0]?.querySelectorAll('th, td') || []).length;
        const delim = `| ${Array(Math.max(1, colCount)).fill('---').join(' | ')} |`;
        const res = [mdRows[0], delim, ...mdRows.slice(1)].join('\n');
        return `\n${res}\n`;
      }
    }
    if (tag === 'div' || tag === 'p') {
      const align = el.style ? el.style.textAlign : '';
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

export function joinLogicalLines(lines: string[]): string {
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

export function extractLogicalUnits(paperContentEl: HTMLElement): string[] {
  const units: string[] = [];
  let inlineBuffer = '';

  interface InlineFormatState {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
  }

  function wrapWithFormats(text: string, fmt: InlineFormatState): string {
    if (!text) return '';
    let out = text;
    if (fmt.strike) out = `<s>${out}</s>`;
    if (fmt.underline) out = `<u>${out}</u>`;
    if (fmt.italic) out = `<i>${out}</i>`;
    if (fmt.bold) out = `<b>${out}</b>`;
    return out;
  }

  function flushInline(align = '', padLeft = '', textIndent = ''): void {
    if (inlineBuffer.trim() !== '') {
      let styleStr = 'margin:0; padding:0;';
      if (padLeft) styleStr = `margin:0; padding:0 0 0 ${padLeft};`;
      if (textIndent) styleStr += ` text-indent:${textIndent};`;
      if (align) styleStr += ` text-align:${align};`;
      units.push(`<div style="${styleStr}">${inlineBuffer}</div>`);
    }
    inlineBuffer = '';
  }

  function walkNodes(
    parentEl: Node,
    inheritedAlign = '',
    inheritedFmt: InlineFormatState = {},
    inheritedPadLeft = '',
    inheritedTextIndent = ''
  ): void {
    Array.from(parentEl.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const escaped = (node.nodeValue || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        if (escaped) {
          inlineBuffer += wrapWithFormats(escaped, inheritedFmt);
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'img') {
        inlineBuffer += el.outerHTML;
        return;
      }

      if (tag === 'br') {
        if (inlineBuffer.trim() !== '') {
          flushInline(inheritedAlign, inheritedPadLeft, inheritedTextIndent);
        } else {
          units.push('');
        }
        return;
      }

      // Compute updated inline formatting state from this element
      const styleDec =
        (el.style &&
          (el.style.textDecoration || el.style.textDecorationLine)) ||
        '';
      const styleWeight = (el.style && el.style.fontWeight) || '';
      const styleItalic = (el.style && el.style.fontStyle) || '';

      const nextFmt: InlineFormatState = {
        bold:
          inheritedFmt.bold ||
          tag === 'b' ||
          tag === 'strong' ||
          tag === 'h1' ||
          tag === 'h2' ||
          tag === 'h3' ||
          tag === 'h4' ||
          styleWeight === 'bold' ||
          Number(styleWeight) >= 600,
        italic:
          inheritedFmt.italic ||
          tag === 'i' ||
          tag === 'em' ||
          styleItalic === 'italic',
        underline:
          inheritedFmt.underline ||
          tag === 'u' ||
          tag === 'ins' ||
          styleDec.includes('underline'),
        strike:
          inheritedFmt.strike ||
          tag === 's' ||
          tag === 'strike' ||
          tag === 'del' ||
          styleDec.includes('line-through')
      };

      if (tag === 'ul') {
        flushInline(inheritedAlign, inheritedPadLeft, inheritedTextIndent);
        Array.from(el.children).forEach((li) => {
          if (li.tagName && li.tagName.toLowerCase() === 'li') {
            inlineBuffer = '&bull; ';
            walkNodes(li, '', nextFmt, '18px', '-12px');
            flushInline('', '18px', '-12px');
          }
        });
        return;
      }

      if (tag === 'ol') {
        flushInline(inheritedAlign, inheritedPadLeft, inheritedTextIndent);
        let idx = 1;
        Array.from(el.children).forEach((li) => {
          if (li.tagName && li.tagName.toLowerCase() === 'li') {
            inlineBuffer = `${idx}. `;
            walkNodes(li, '', nextFmt, '18px', '-14px');
            flushInline('', '18px', '-14px');
            idx++;
          }
        });
        return;
      }

      if (tag === 'table') {
        flushInline(inheritedAlign, inheritedPadLeft, inheritedTextIndent);
        units.push(`<div style="margin:0; padding:0;">${el.outerHTML}</div>`);
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
        flushInline(inheritedAlign, inheritedPadLeft, inheritedTextIndent);
        const align =
          (el.style && el.style.textAlign) ||
          el.getAttribute('align') ||
          inheritedAlign;
        const padLeft = (el.style && el.style.paddingLeft) || inheritedPadLeft;
        const textIndent =
          (el.style && el.style.textIndent) || inheritedTextIndent;

        if ((el.textContent || '').trim() === '' && !el.querySelector('img')) {
          units.push('');
          return;
        }

        walkNodes(el, align, nextFmt, padLeft, textIndent);
        flushInline(align, padLeft, textIndent);
        return;
      }

      // Inline wrapper element (b, u, i, s, span, font, etc.) — recurse so nested divs/brs are flattened cleanly
      walkNodes(
        el,
        inheritedAlign,
        nextFmt,
        inheritedPadLeft,
        inheritedTextIndent
      );
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

