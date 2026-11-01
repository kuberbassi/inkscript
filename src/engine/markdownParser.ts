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
            outLines.push(`<b><u>${content}</u></b>`);
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
      } else {
        const content = processInlineNode(el).trim();
        if (content) outLines.push(content);
      }
    });
  }

  walkBlocks(doc.body);
  return outLines.join('<br/>');
}

export function parsePlainMarkdownToHandwriting(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  const formattedLines = lines.map((line) => {
    const l = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (/^#{1,2}\s+(.+)$/.test(l)) {
      const headingText = applyInlineMarkdown(l.replace(/^#{1,2}\s+/, ''));
      return `<div style="text-align: center;"><b><u>${headingText}</u></b></div>`;
    }

    if (/^#{3,6}\s+(.+)$/.test(l)) {
      const headingText = applyInlineMarkdown(l.replace(/^#{3,6}\s+/, ''));
      return `<b><u>${headingText}</u></b>`;
    }

    if (/^\s*[-*•]\s+(.+)$/.test(l)) {
      const bulletText = applyInlineMarkdown(l.replace(/^\s*[-*•]\s+/, ''));
      return `<div style="margin:0; padding:0 0 0 18px; text-indent:-12px;">&bull; ${bulletText}</div>`;
    }

    if (/^\s*(\d+[.)])\s+(.+)$/.test(l)) {
      const match = l.match(/^(\s*)(\d+[.)])\s+(.+)$/);
      if (match) {
        const isIndented = match[1].length > 0;
        const num = match[2];
        const rest = applyInlineMarkdown(match[3]);
        if (isIndented) {
          return `<div style="margin:0; padding:0 0 0 18px; text-indent:-14px;">${num} ${rest}</div>`;
        }
        return `${num} ${rest}`;
      }
    }

    return applyInlineMarkdown(l);
  });

  return formattedLines.join('<br/>');
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

  function flushInline(): void {
    if (inlineBuffer.trim() !== '') {
      units.push(inlineBuffer);
    }
    inlineBuffer = '';
  }

  function walkNodes(parentEl: Node, inheritedAlign = ''): void {
    Array.from(parentEl.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const escaped = (node.nodeValue || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        inlineBuffer += escaped;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

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
        Array.from(el.children).forEach((li) => {
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
        Array.from(el.children).forEach((li) => {
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
          (el.style && el.style.textAlign) ||
          el.getAttribute('align') ||
          inheritedAlign;
        const padLeft = el.style ? el.style.paddingLeft : '';
        const textIndent = el.style ? el.style.textIndent : '';

        if ((el.textContent || '').trim() === '' && !el.querySelector('img')) {
          units.push('');
          return;
        }

        const hasNestedBlocks = Array.from(el.children).some((c) =>
          ['div', 'p', 'ul', 'ol', 'br'].includes(c.tagName.toLowerCase())
        );

        let styleStr = 'margin:0; padding:0;';
        if (padLeft) styleStr = `margin:0; padding:0 0 0 ${padLeft};`;
        if (textIndent) styleStr += ` text-indent:${textIndent};`;
        if (align) styleStr += ` text-align:${align};`;

        if (!hasNestedBlocks) {
          units.push(`<div style="${styleStr}">${el.innerHTML}</div>`);
        } else {
          const prevLen = units.length;
          walkNodes(el, align);
          flushInline();
          if (align) {
            for (let k = prevLen; k < units.length; k++) {
              if (units[k].trim() !== '' && !/^<div\b/i.test(units[k])) {
                units[k] = `<div style="margin:0; padding:0; text-align:${align};">${units[k]}</div>`;
              }
            }
          }
        }
        return;
      }

      inlineBuffer += el.outerHTML;
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
