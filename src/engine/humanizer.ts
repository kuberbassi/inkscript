import { SeededRandom, clamp } from './prng';

const PUNCTUATION_SET = new Set(['.', ',', '!', '?', ';', ':', '-', "'", '"']);
const ROUND_BOWL_CHARS = /[aoecdgqpbumnswAOECDGPQUB]/;

function getAncestorTextDecoration(node: Node, rootEl: HTMLElement): string {
  const decorations = new Set<string>();
  let cur = node.parentNode as HTMLElement | null;
  while (cur && cur !== rootEl && cur.nodeType === Node.ELEMENT_NODE) {
    const tag = cur.tagName.toLowerCase();
    if (tag === 'u' || tag === 'ins') decorations.add('underline');
    if (tag === 's' || tag === 'strike' || tag === 'del') {
      decorations.add('line-through');
    }
    const inlineDec =
      (cur.style &&
        (cur.style.textDecoration || cur.style.textDecorationLine)) ||
      '';
    if (inlineDec.includes('underline')) decorations.add('underline');
    if (inlineDec.includes('line-through')) decorations.add('line-through');
    cur = cur.parentNode as HTMLElement | null;
  }
  return Array.from(decorations).join(' ');
}

/**
 * Splits a word into smooth 3-4 letter syllable chunks while always separating
 * consecutive twin letters ('ll', 'ss', 'ff', 'ee', 'oo') and trailing punctuation.
 */
export function splitIntoSmoothSyllables(word: string): string[] {
  if (word.length <= 3) {
    for (let i = 0; i < word.length - 1; i++) {
      if (word[i] === word[i + 1] && /[a-zA-Z]/.test(word[i])) {
        return [word.slice(0, i + 1), word.slice(i + 1)];
      }
    }
    return [word];
  }

  const chunks: string[] = [];
  let buf = '';

  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const nextCh = i + 1 < word.length ? word[i + 1] : '';

    buf += ch;

    if (nextCh && ch === nextCh && /[a-zA-Z]/.test(ch)) {
      chunks.push(buf);
      buf = '';
      continue;
    }

    if (nextCh && PUNCTUATION_SET.has(nextCh) && buf.length > 0) {
      chunks.push(buf);
      buf = '';
      continue;
    }

    const remaining = word.length - (i + 1);
    if (buf.length >= 4 && remaining >= 3 && !PUNCTUATION_SET.has(nextCh)) {
      chunks.push(buf);
      buf = '';
    }
  }

  if (buf) {
    chunks.push(buf);
  }
  return chunks;
}

/**
 * Transforms a container's DOM text nodes into humanized spans with seeded deterministic
 * variable slant, loose rounded bowls, organic word/letter spacing, and dynamic ballpoint
 * pen pressure while guaranteeing 0.0px cumulative vertical line-height drift.
 */
export function applyHumanRealismToDOM(
  paperContentEl: HTMLElement,
  intensity = 1.35,
  seed = 42197
): () => void {
  const originalHTML = paperContentEl.innerHTML;
  if (intensity <= 0) {
    return () => {};
  }

  const rng = new SeededRandom(seed);
  const eff = clamp(intensity * 0.75, 0.3, 1.35);

  let wavePhase = rng.uniform(0, Math.PI * 2);
  let slantPhase = rng.uniform(0, Math.PI * 2);
  let penPressure = rng.uniform(0.55, 0.85);

  const walker = document.createTreeWalker(
    paperContentEl,
    NodeFilter.SHOW_TEXT,
    null
  );

  const textNodes: Text[] = [];
  let currentNode = walker.nextNode() as Text | null;
  while (currentNode) {
    if (currentNode.nodeValue && currentNode.nodeValue.trim().length > 0) {
      textNodes.push(currentNode);
    }
    currentNode = walker.nextNode() as Text | null;
  }

  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue || '';
    const ancestorDecoration = getAncestorTextDecoration(
      textNode,
      paperContentEl
    );

    if (ancestorDecoration) {
      const decSpan = document.createElement('span');
      decSpan.textContent = text;
      decSpan.style.position = 'relative';
      decSpan.style.transformOrigin = '50% 82%';
      decSpan.style.textDecoration = ancestorDecoration;
      decSpan.style.textDecorationLine = ancestorDecoration;
      const uSkew = rng.uniform(-1.8, 1.4) * eff;
      decSpan.style.transform = `skewX(${uSkew.toFixed(2)}deg) scale(1.02, 0.99)`;
      decSpan.style.letterSpacing = `${(rng.uniform(0.08, 0.25) * eff).toFixed(2)}px`;
      decSpan.style.opacity = rng.uniform(0.93, 0.99).toFixed(2);
      decSpan.style.textShadow = '0.18px 0.06px 0px currentColor';
      textNode.parentNode?.replaceChild(decSpan, textNode);
      return;
    }

    const fragment = document.createDocumentFragment();
    const tokens = text.split(/(\s+)/);

    for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
      const token = tokens[tIdx];
      if (!token) continue;

      if (/^\s+$/.test(token)) {
        fragment.appendChild(document.createTextNode(token));
        continue;
      }

      wavePhase += rng.uniform(0.45, 0.75);
      slantPhase += rng.uniform(0.35, 0.65);

      const organicWave =
        Math.sin(wavePhase) * 0.32 + Math.cos(wavePhase * 1.618) * 0.18;
      const wordDy = clamp(
        (organicWave + rng.uniform(-0.22, 0.24)) * eff,
        -0.65,
        0.65
      );
      const wordDx = rng.uniform(-0.15, 0.35) * eff;

      const wordSlantDeg =
        (Math.sin(slantPhase) * 1.8 + rng.uniform(-1.6, 1.4)) * eff;

      const endsWithPunct = /[.,!?;:\-]$/.test(token);
      let wordGapPx = rng.uniform(0.0, 0.95) * eff;
      if (endsWithPunct) {
        wordGapPx = rng.uniform(0.6, 1.75) * eff;
      }

      const wordSpan = document.createElement('span');
      wordSpan.className = 'hw-word';
      wordSpan.style.position = 'relative';
      wordSpan.style.top = `${wordDy.toFixed(2)}px`;
      wordSpan.style.left = `${wordDx.toFixed(2)}px`;
      wordSpan.style.marginRight = `${wordGapPx.toFixed(2)}px`;

      penPressure = clamp(
        penPressure + rng.uniform(-0.18, 0.22),
        0.42,
        1.0
      );

      const syllables = splitIntoSmoothSyllables(token);

      syllables.forEach((syl, sIdx) => {
        const sylSpan = document.createElement('span');
        sylSpan.textContent = syl;
        sylSpan.style.position = 'relative';
        sylSpan.style.transformOrigin = '50% 82%';

        const firstCh = syl[0];
        const isPunct = PUNCTUATION_SET.has(firstCh) && syl.length === 1;
        const hasRoundBowl = ROUND_BOWL_CHARS.test(syl);
        const isWordStart = sIdx === 0;
        const isSecondTwin =
          sIdx > 0 &&
          syllables[sIdx - 1].slice(-1) === firstCh &&
          /[a-zA-Z]/.test(firstCh);

        let sylDy = rng.uniform(-0.16, 0.16) * eff;
        if (isSecondTwin) {
          sylDy += (sylDy >= 0 ? 0.24 : -0.24) * eff;
        }
        sylSpan.style.top = `${sylDy.toFixed(2)}px`;

        const localSkew =
          wordSlantDeg +
          rng.uniform(-1.2, 1.2) * eff +
          (isSecondTwin ? rng.uniform(1.5, 2.8) : 0);
        const localRotate = rng.uniform(-0.48, 0.48) * eff;

        let scaleX = 1.0 + rng.uniform(0.008, 0.038) * eff;
        let scaleY = 1.0 + rng.uniform(-0.025, 0.02) * eff;
        if (hasRoundBowl) {
          scaleX += 0.012 * eff;
        }

        sylSpan.style.transform = `skewX(${localSkew.toFixed(
          2
        )}deg) rotate(${localRotate.toFixed(2)}deg) scale(${scaleX.toFixed(
          3
        )}, ${scaleY.toFixed(3)})`;

        const letterSpacePx = rng.uniform(0.04, 0.28) * eff;
        sylSpan.style.letterSpacing = `${letterSpacePx.toFixed(2)}px`;

        let localPressure = penPressure + rng.uniform(-0.14, 0.16);
        if (isWordStart || /[A-Z0-9]/.test(firstCh)) {
          localPressure += 0.15;
        }
        if (rng.chance(0.18 * eff)) {
          localPressure += 0.2;
        }

        if (isPunct) {
          sylSpan.style.opacity = '0.98';
          sylSpan.style.textShadow = '0.26px 0.12px 0.15px currentColor';
        } else if (localPressure >= 0.8) {
          const alpha = clamp(rng.uniform(0.95, 1.0), 0.94, 1.0);
          sylSpan.style.opacity = alpha.toFixed(2);
          sylSpan.style.textShadow = '0.22px 0.08px 0px currentColor';
        } else if (localPressure >= 0.58) {
          const alpha = clamp(rng.uniform(0.89, 0.95), 0.88, 0.96);
          sylSpan.style.opacity = alpha.toFixed(2);
          if (rng.chance(0.35)) {
            sylSpan.style.textShadow = '0.14px 0.05px 0px currentColor';
          }
        } else {
          const alpha = clamp(rng.uniform(0.81, 0.88), 0.8, 0.89);
          sylSpan.style.opacity = alpha.toFixed(2);
        }

        penPressure = clamp(penPressure - rng.uniform(0.02, 0.06), 0.42, 1.0);
        wordSpan.appendChild(sylSpan);
      });

      fragment.appendChild(wordSpan);
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  });

  return () => {
    paperContentEl.innerHTML = originalHTML;
  };
}
