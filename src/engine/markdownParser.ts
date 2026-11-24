function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converts leading spaces/tabs on a code line into non-breaking spaces
 * so indentation is faithfully preserved in both Live Preview and Canvas export.
 */
function formatCodeLineHTML(rawLine: string): string {
  const expanded = rawLine.replace(/\t/g, '  ');
  const match = expanded.match(/^(\s*)(.*)$/);
  const indent = match ? match[1].replace(/ /g, '&nbsp;') : '';
  const body = match ? escapeHTML(match[2]) : escapeHTML(expanded);
  return `<div class="hw-code-line">${indent}${body || '&nbsp;'}</div>`;
}

function buildCodeBlockHTML(codeLines: string[]): string {
  // Trim leading/trailing completely empty lines inside the code block
  let start = 0;
  let end = codeLines.length - 1;
  while (start <= end && codeLines[start].trim() === '') start++;
  while (end >= start && codeLines[end].trim() === '') end--;
  const trimmed = codeLines.slice(start, end + 1);
  if (trimmed.length === 0) return '';
  return `<div class="hw-code-block" data-hw-code="true">${trimmed
    .map(formatCodeLineHTML)
    .join('')}</div>`;
}

/**
 * Applies inline Markdown formatting with student-assignment emphasis control:
 * - Bold only short keywords/labels (<= 45 chars); long bolded sentences stay natural weight.
 * - Inline `code` stays normal weight (not heavy bold).
 */
export function applyInlineMarkdown(str: string): string {
  return str
    .replace(/\*\*\*(.+?)\*\*\*/g, (_, inner: string) =>
      inner.trim().length > 48 ? `<i>${inner}</i>` : `<b><i>${inner}</i></b>`
    )
    .replace(/\*\*(.+?)\*\*/g, (_, inner: string) =>
      inner.trim().length > 48 ? inner : `<b>${inner}</b>`
    )
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/\*(?!\s)(.+?)(?<!\s)\*/g, '<i>$1</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '$1');
}

/**
 * Collapses redundant blank lines so pasted Gemini/ChatGPT assignments have compact,
 * natural notebook spacing without awkward empty gaps.
 */
function compactBlockLines(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const isEmpty = cur.trim() === '';
    if (isEmpty) {
      // Never start with blank, never allow 2+ consecutive blanks
      if (out.length === 0 || out[out.length - 1].trim() === '') {
        continue;
      }
      // Don't leave a blank line immediately after a heading/question
      if (/data-hw-heading="true"/.test(out[out.length - 1])) {
        continue;
      }
      out.push('');
    } else {
      out.push(cur);
    }
  }
  while (out.length > 0 && out[out.length - 1].trim() === '') {
    out.pop();
  }
  return out;
}

/**
 * Joins block chunks cleanly without injecting double <br/> after block-level <div>/<table>.
 */
function joinPastedChunks(chunks: string[]): string {
  const compacted = compactBlockLines(chunks);
  return compacted
    .map((chunk) => {
      const trimmed = chunk.trim();
      if (trimmed === '') {
        return '<div style="margin:0; padding:0;">&nbsp;</div>';
      }
      if (/^<(div|table)\b/i.test(trimmed)) {
        return trimmed;
      }
      return `<div style="margin:0; padding:0;">${chunk}</div>`;
    })
    .join('');
}

/**
 * Sanitizes rich HTML clipboard data (from Gemini, ChatGPT, Notion, Google Docs, Word)
 * into clean, ruled-line-friendly handwritten notebook HTML.
 */
export function sanitizeRichHTMLToHandwriting(rawHTML: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHTML, 'text/html');
  const outLines: string[] = [];

  function processInlineNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const escaped = escapeHTML(node.nodeValue || '');
      return applyInlineMarkdown(escaped);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') return '<br/>';

    // Inline <code> stays crisp regular pen weight (never marker-bold)
    if (tag === 'code') {
      return escapeHTML(el.textContent || '');
    }

    const childrenHTML = Array.from(el.childNodes)
      .map(processInlineNode)
      .join('');

    const plainLen = (el.textContent || '').trim().length;
    const fontWeight = el.style ? el.style.fontWeight : '';
    const textDecoration = el.style ? el.style.textDecoration : '';
    const fontStyle = el.style ? el.style.fontStyle : '';

    let res = childrenHTML;
    // Emphasis control: bold only short keywords/labels, not entire long sentences
    if (
      (tag === 'b' ||
        tag === 'strong' ||
        fontWeight === 'bold' ||
        Number(fontWeight) >= 600) &&
      plainLen <= 48
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
          outLines.push(applyInlineMarkdown(escapeHTML(text)));
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // Skip Gemini/ChatGPT UI copy buttons or language badges inside code blocks
      if (
        tag === 'button' ||
        tag === 'svg' ||
        tag === 'style' ||
        tag === 'script'
      ) {
        return;
      }

      if (tag === 'pre') {
        const codeEl = el.querySelector('code') || el;
        const rawCode = (codeEl.textContent || '').replace(/\r\n/g, '\n');
        const blockHTML = buildCodeBlockHTML(rawCode.split('\n'));
        if (blockHTML) outLines.push(blockHTML);
        return;
      }

      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const rawPlain = (el.textContent || '').trim();
        const content = processInlineNode(el)
          .replace(/<\/?b>/gi, '')
          .trim();
        if (content) {
          if (outLines.length > 0 && outLines[outLines.length - 1] !== '') {
            outLines.push('');
          }
          if (tag === 'h1') {
            outLines.push(
              `<div style="text-align: center;" data-hw-heading="true"><b><u>${content}</u></b></div>`
            );
          } else if (tag === 'h2' && rawPlain.length < 48 && !/^Q\d+/i.test(rawPlain)) {
            outLines.push(
              `<div style="text-align: center;" data-hw-heading="true"><u>${content}</u></div>`
            );
          } else {
            // Natural student heading/question: normal size + subtle underline
            outLines.push(
              `<div style="margin:0; padding:0;" data-hw-heading="true"><u>${content}</u></div>`
            );
          }
        }
        return;
      }

      if (tag === 'ul') {
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
        return;
      }

      if (tag === 'ol') {
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
        return;
      }

      if (tag === 'table') {
        const rows: string[] = [];
        const trs = Array.from(el.querySelectorAll('tr'));
        trs.forEach((tr, rIdx) => {
          const cells: string[] = [];
          const thOrTds = Array.from(tr.children);
          thOrTds.forEach((cell) => {
            const isHeader = cell.tagName.toLowerCase() === 'th' || rIdx === 0;
            const cellContent = processInlineNode(cell)
              .replace(/<\/?b>/gi, '')
              .trim();
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
        return;
      }

      if (tag === 'hr') {
        outLines.push('');
        return;
      }

      if (tag === 'p' || tag === 'div' || tag === 'blockquote' || tag === 'section' || tag === 'article') {
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
            'pre',
            'table',
            'blockquote',
            'section',
            'article'
          ].includes(c.tagName.toLowerCase())
        );
        if (hasBlockChild) {
          walkBlocks(el);
        } else {
          const content = processInlineNode(el).trim();
          const align = el.style ? el.style.textAlign : '';
          if (content) {
            // Detect natural assignment questions (Q1. / Q2. / Question 1:)
            const plain = (el.textContent || '').trim();
            if (/^Q\d+[.):]\s+/i.test(plain) && plain.length < 95) {
              if (outLines.length > 0 && outLines[outLines.length - 1] !== '') {
                outLines.push('');
              }
              const cleanQ = content.replace(/<\/?b>/gi, '');
              outLines.push(
                `<div style="margin:0; padding:0;" data-hw-heading="true"><u>${cleanQ}</u></div>`
              );
            } else if (align === 'center' || align === 'right') {
              outLines.push(
                `<div style="text-align: ${align};">${content}</div>`
              );
            } else {
              outLines.push(content);
            }
          }
        }
        return;
      }

      if (tag === 'br') {
        outLines.push('');
        return;
      }

      const content = processInlineNode(el).trim();
      if (content) outLines.push(content);
    });
  }

  walkBlocks(doc.body);
  return joinPastedChunks(outLines);
}

function parseMarkdownTable(tableLines: string[]): string {
  const delimIdx = tableLines.findIndex((line) =>
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)
  );
  if (delimIdx < 1) {
    return tableLines.map((l) => applyInlineMarkdown(escapeHTML(l))).join('<br/>');
  }

  const parseRow = (line: string): string[] => {
    let clean = line.trim();
    if (clean.startsWith('|')) clean = clean.slice(1);
    if (clean.endsWith('|')) clean = clean.slice(0, -1);
    return clean
      .split('|')
      .map((c) => applyInlineMarkdown(escapeHTML(c.trim())));
  };

  const headerRows = tableLines.slice(0, delimIdx);
  const bodyRows = tableLines.slice(delimIdx + 1);

  const theadHTML = headerRows
    .map((row) => {
      const cells = parseRow(row).map((c) => c.replace(/<\/?b>/gi, ''));
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

    // 1. Fenced code blocks (```cpp ... ```) — preserves exact indentation & symbols
    if (/^\s*```/.test(line)) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      const blockHTML = buildCodeBlockHTML(codeLines);
      if (blockHTML) outChunks.push(blockHTML);
      continue;
    }

    // 2. Markdown tables
    const isTableLine = line.includes('|');
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
    const isDelimNext =
      /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(nextLine);

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

    // 3. Horizontal rules -> single compact section break
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      outChunks.push('');
      i++;
      continue;
    }

    const l = escapeHTML(line);

    // 4. Headings (# Title -> centered underlined; ##/### -> natural underlined heading)
    if (/^#\s+(.+)$/.test(l)) {
      const headingText = applyInlineMarkdown(l.replace(/^#\s+/, '')).replace(
        /<\/?b>/gi,
        ''
      );
      outChunks.push(
        `<div style="text-align: center;" data-hw-heading="true"><b><u>${headingText}</u></b></div>`
      );
      i++;
      continue;
    }

    if (/^#{2,6}\s+(.+)$/.test(l)) {
      const headingText = applyInlineMarkdown(l.replace(/^#{2,6}\s+/, '')).replace(
        /<\/?b>/gi,
        ''
      );
      if (outChunks.length > 0 && outChunks[outChunks.length - 1] !== '') {
        outChunks.push('');
      }
      outChunks.push(
        `<div style="margin:0; padding:0;" data-hw-heading="true"><u>${headingText}</u></div>`
      );
      i++;
      continue;
    }

    // 5. Question lines (Q1. / Q2.)
    const plainTrim = line.trim();
    if (/^(\*\*)?Q\d+[.):]\s+/i.test(plainTrim) && plainTrim.length < 105) {
      const cleanQ = applyInlineMarkdown(l).replace(/<\/?b>/gi, '');
      if (outChunks.length > 0 && outChunks[outChunks.length - 1] !== '') {
        outChunks.push('');
      }
      outChunks.push(
        `<div style="margin:0; padding:0;" data-hw-heading="true"><u>${cleanQ}</u></div>`
      );
      i++;
      continue;
    }

    // 6. Bullet lists
    if (/^\s*[-*•]\s+(.+)$/.test(l)) {
      const bulletText = applyInlineMarkdown(l.replace(/^\s*[-*•]\s+/, ''));
      outChunks.push(
        `<div style="margin:0; padding:0 0 0 18px; text-indent:-12px;">&bull; ${bulletText}</div>`
      );
      i++;
      continue;
    }

    // 7. Numbered lists
    if (/^\s*(\d+[.)])\s+(.+)$/.test(l)) {
      const match = l.match(/^(\s*)(\d+[.)])\s+(.+)$/);
      if (match) {
        const isIndented = match[1].length > 0;
        const num = match[2];
        const rest = applyInlineMarkdown(match[3]);
        if (isIndented) {
          outChunks.push(
            `<div style="margin:0; padding:0 0 0 18px; text-indent:-14px;">${num} ${rest}</div>`
          );
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

  return joinPastedChunks(outChunks);
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

    if (el.classList.contains('hw-code-block') || el.dataset.hwCode === 'true') {
      const codeLines = Array.from(el.querySelectorAll('.hw-code-line')).map(
        (ln) => (ln.textContent || '').replace(/\u00a0/g, ' ')
      );
      const body =
        codeLines.length > 0
          ? codeLines.join('\n')
          : (el.textContent || '').replace(/\u00a0/g, ' ');
      return `\n\`\`\`\n${body}\n\`\`\`\n`;
    }

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
          .replace(/^__\*\*(.+?)\*\*__$/, '$1')
          .replace(/^__(.+?)__$/, '$1');
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

  function flushInline(
    align = '',
    padLeft = '',
    textIndent = '',
    isHeading = false
  ): void {
    if (inlineBuffer.trim() !== '') {
      let styleStr = 'margin:0; padding:0;';
      if (padLeft) styleStr = `margin:0; padding:0 0 0 ${padLeft};`;
      if (textIndent) styleStr += ` text-indent:${textIndent};`;
      if (align) styleStr += ` text-align:${align};`;
      const headingAttr = isHeading ? ' data-hw-heading="true"' : '';
      units.push(`<div style="${styleStr}"${headingAttr}>${inlineBuffer}</div>`);
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
        const escaped = escapeHTML(node.nodeValue || '');
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

      // Preserve code blocks as atomic keep-together units for pagination
      if (
        el.classList.contains('hw-code-block') ||
        el.dataset.hwCode === 'true' ||
        tag === 'pre'
      ) {
        flushInline(inheritedAlign, inheritedPadLeft, inheritedTextIndent);
        units.push(el.outerHTML);
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
        const isHeading =
          el.dataset.hwHeading === 'true' ||
          tag === 'h1' ||
          tag === 'h2' ||
          tag === 'h3' ||
          tag === 'h4';

        if ((el.textContent || '').trim() === '' && !el.querySelector('img')) {
          units.push('');
          return;
        }

        walkNodes(el, align, nextFmt, padLeft, textIndent);
        flushInline(align, padLeft, textIndent, isHeading);
        return;
      }

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

  // Collapse 2+ consecutive blank units for compact student notebook spacing
  const compacted: string[] = [];
  for (const u of units) {
    if (u.trim() === '') {
      if (compacted.length > 0 && compacted[compacted.length - 1].trim() !== '') {
        compacted.push('');
      }
    } else {
      compacted.push(u);
    }
  }
  while (compacted.length > 0 && compacted[compacted.length - 1].trim() === '') {
    compacted.pop();
  }
  return compacted;
}
