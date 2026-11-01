/**
 * Human Handwriting Realism Engine — Balanced Casual & Natural Cursive Edition
 *
 * Tuned for Cedarville Cursive & casual handwriting fonts:
 * 1. Smooth Cursive Syllable Flow: Keeps 3-5 letter cursive syllables connected (only splitting twin letters like 'll', 'ss', 'ff', 'ee' or long words into 2 smooth halves) so letters never collide or look chopped up.
 * 2. Subtle Variable Slant: Gentle per-word and per-syllable skewX (-3.2deg to +2.4deg) & micro-rotation (-0.55deg to +0.55deg) anchored at the 82% baseline origin.
 * 3. Loose, Rounded Letter Formation: Gentle horizontal loop relaxation (scaleX 1.01..1.05, scaleY 0.97..1.02) with positive-only letter-spacing (0.0px..0.32px) so letters never overlap.
 * 4. Natural Non-Overlapping Word Spacing: Word gaps vary organically from +0.0px to +1.7px (never negative, preventing words from running together).
 * 5. Crisp Pen Pressure Variations: Clean, subtle heavier strokes in places (0.22px ink pass) and lighter skimming glides without blotchiness.
 * 6. Nearly-Perfect Interrupted Underlines: Keeps underlined phrases unified on one shared baseline so html2canvas draws a nearly straight hand-drawn line with subtle micro-interruptions.
 */

function randomUniform(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

const PUNCTUATION_SET = new Set(['.', ',', '!', '?', ';', ':', '-', "'", '"']);
const ROUND_BOWL_CHARS = /[aoecdgqpbumnswAOECDGPQUB]/;

function getAncestorTextDecoration(node, rootEl) {
  const decorations = new Set();
  let cur = node.parentNode;
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
    cur = cur.parentNode;
  }
  return Array.from(decorations).join(' ');
}

/**
 * Splits a word into smooth syllable chunks (3-5 chars) while always separating
 * consecutive twin letters (e.g. 'll', 'ss', 'ff', 'ee') and trailing punctuation,
 * preserving natural cursive connections without chopping words into single letters.
 */
function splitIntoSmoothSyllables(word) {
  if (word.length <= 3) {
    // Only split if there is a twin letter pair like "ll" or "ss"
    for (let i = 0; i < word.length - 1; i++) {
      if (word[i] === word[i + 1] && /[a-zA-Z]/.test(word[i])) {
        return [word.slice(0, i + 1), word.slice(i + 1)];
      }
    }
    return [word];
  }

  const chunks = [];
  let buf = '';

  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const nextCh = i + 1 < word.length ? word[i + 1] : '';

    buf += ch;

    // 1. Always split right between consecutive identical letters (e.g. 'dif' + 'ferent', 'stres' + 's')
    if (nextCh && ch === nextCh && /[a-zA-Z]/.test(ch)) {
      chunks.push(buf);
      buf = '';
      continue;
    }

    // 2. Separate trailing punctuation so it gets its own ink stop
    if (nextCh && PUNCTUATION_SET.has(nextCh) && buf.length > 0) {
      chunks.push(buf);
      buf = '';
      continue;
    }

    // 3. For longer words (6+ chars), split smoothly into 3-4 letter syllable chunks
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
 * Transforms a container's DOM text nodes into humanized spans with subtle variable slant,
 * loose rounded letter formation, organic spacing, and natural pen pressure variations
 * while guaranteeing 0.0px cumulative vertical line-height drift.
 */
export function applyHumanRealismToDOM(paperContentEl, intensity = 1.0) {
  const originalHTML = paperContentEl.innerHTML;
  if (intensity <= 0) {
    return () => {};
  }

  // Scale intensity gently so default (1.0 - 1.35) is natural and never extreme
  const eff = clamp(intensity * 0.75, 0.3, 1.35);

  let wavePhase = randomUniform(0, Math.PI * 2);
  let slantPhase = randomUniform(0, Math.PI * 2);
  let penPressure = randomUniform(0.55, 0.85);

  const walker = document.createTreeWalker(
    paperContentEl,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const textNodes = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    if (currentNode.nodeValue && currentNode.nodeValue.trim().length > 0) {
      textNodes.push(currentNode);
    }
    currentNode = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue;
    const ancestorDecoration = getAncestorTextDecoration(
      textNode,
      paperContentEl
    );

    // For underlined headings/labels (<u>), keep the text node on one unified span
    // so html2canvas draws a nearly-perfect level underline with subtle micro-interruptions
    if (ancestorDecoration) {
      const decSpan = document.createElement('span');
      decSpan.textContent = text;
      decSpan.style.position = 'relative';
      decSpan.style.transformOrigin = '50% 82%';
      decSpan.style.textDecoration = ancestorDecoration;
      decSpan.style.textDecorationLine = ancestorDecoration;
      const uSkew = randomUniform(-1.8, 1.4) * eff;
      decSpan.style.transform = `skewX(${uSkew.toFixed(2)}deg) scale(1.02, 0.99)`;
      decSpan.style.letterSpacing = `${(randomUniform(0.08, 0.25) * eff).toFixed(2)}px`;
      decSpan.style.opacity = randomUniform(0.93, 0.99).toFixed(2);
      decSpan.style.textShadow = '0.18px 0.06px 0px currentColor';
      textNode.parentNode.replaceChild(decSpan, textNode);
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

      wavePhase += randomUniform(0.45, 0.75);
      slantPhase += randomUniform(0.35, 0.65);

      // 1. Gentle Baseline Wave (kept tight to the ruled line: +-0.48px max)
      const organicWave =
        Math.sin(wavePhase) * 0.32 + Math.cos(wavePhase * 1.618) * 0.18;
      const wordDy = clamp(
        (organicWave + randomUniform(-0.22, 0.24)) * eff,
        -0.65,
        0.65
      );
      const wordDx = randomUniform(-0.15, 0.35) * eff;

      // 2. Subtle Variable Word Slant (-3.2deg to +2.2deg)
      const wordSlantDeg =
        (Math.sin(slantPhase) * 1.8 + randomUniform(-1.6, 1.4)) * eff;

      // 3. Positive-Only Irregular Inter-Word Spacing (0.0px to +1.7px so words never collide)
      const endsWithPunct = /[.,!?;:\-]$/.test(token);
      let wordGapPx = randomUniform(0.0, 0.95) * eff;
      if (endsWithPunct) {
        wordGapPx = randomUniform(0.6, 1.75) * eff;
      }

      const wordSpan = document.createElement('span');
      wordSpan.className = 'hw-word';
      wordSpan.style.position = 'relative';
      wordSpan.style.top = `${wordDy.toFixed(2)}px`;
      wordSpan.style.left = `${wordDx.toFixed(2)}px`;
      wordSpan.style.marginRight = `${wordGapPx.toFixed(2)}px`;

      // Update pen pressure smoothly from word to word
      penPressure = clamp(
        penPressure + randomUniform(-0.18, 0.22),
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

        // A. Smooth intra-word vertical offset (tiny +-0.18px so cursive strokes stay connected)
        let sylDy = randomUniform(-0.16, 0.16) * eff;
        if (isSecondTwin) {
          sylDy += (sylDy >= 0 ? 0.24 : -0.24) * eff;
        }
        sylSpan.style.top = `${sylDy.toFixed(2)}px`;

        // B. Subtle Variable Slant + Loose Rounded Letter Formation
        const localSkew =
          wordSlantDeg +
          randomUniform(-1.2, 1.2) * eff +
          (isSecondTwin ? randomUniform(1.5, 2.8) : 0);
        const localRotate = randomUniform(-0.48, 0.48) * eff;

        // Gentle horizontal rounding (1.01..1.045) so letters look looser & rounder without colliding
        let scaleX = 1.0 + randomUniform(0.008, 0.038) * eff;
        let scaleY = 1.0 + randomUniform(-0.025, 0.02) * eff;
        if (hasRoundBowl) {
          scaleX += 0.012 * eff;
        }

        sylSpan.style.transform = `skewX(${localSkew.toFixed(
          2
        )}deg) rotate(${localRotate.toFixed(2)}deg) scale(${scaleX.toFixed(
          3
        )}, ${scaleY.toFixed(3)})`;

        // C. Positive-only intra-word letter spacing (0.04px..0.32px) so scaled/skewed letters never overlap
        const letterSpacePx = randomUniform(0.04, 0.28) * eff;
        sylSpan.style.letterSpacing = `${letterSpacePx.toFixed(2)}px`;

        // D. Refined Pen Stroke Pressure (Crisp heavier places & lighter glides, never blotchy)
        let localPressure = penPressure + randomUniform(-0.14, 0.16);
        if (isWordStart || /[A-Z0-9]/.test(firstCh)) {
          localPressure += 0.15;
        }
        if (Math.random() < 0.18 * eff) {
          localPressure += 0.2;
        }

        if (isPunct) {
          sylSpan.style.opacity = '0.98';
          sylSpan.style.textShadow = '0.26px 0.12px 0.15px currentColor';
        } else if (localPressure >= 0.8) {
          // Heavier Pen Stroke (crisp 0.22px ink weight)
          const alpha = clamp(randomUniform(0.95, 1.0), 0.94, 1.0);
          sylSpan.style.opacity = alpha.toFixed(2);
          sylSpan.style.textShadow = '0.22px 0.08px 0px currentColor';
        } else if (localPressure >= 0.58) {
          // Normal Casual Stroke
          const alpha = clamp(randomUniform(0.89, 0.95), 0.88, 0.96);
          sylSpan.style.opacity = alpha.toFixed(2);
          if (Math.random() < 0.35) {
            sylSpan.style.textShadow = '0.14px 0.05px 0px currentColor';
          }
        } else {
          // Lighter Gliding Pen Stroke
          const alpha = clamp(randomUniform(0.81, 0.88), 0.8, 0.89);
          sylSpan.style.opacity = alpha.toFixed(2);
        }

        penPressure = clamp(penPressure - randomUniform(0.02, 0.06), 0.42, 1.0);

        wordSpan.appendChild(sylSpan);
      });

      fragment.appendChild(wordSpan);
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  });

  return () => {
    paperContentEl.innerHTML = originalHTML;
  };
}

export function postProcessHandwritingCanvas(canvas) {
  return canvas;
}
