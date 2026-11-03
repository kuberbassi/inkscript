import { SeededRandom, clamp } from './prng';

export interface WordRealismStyle {
  skewRad: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  strokeWidth: number;
  shadowAlpha: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

export interface SyllableRealismStyle {
  syllable: string;
  skewRad: number;
  rotateRad: number;
  scaleX: number;
  scaleY: number;
  strokeWidth: number;
  opacity: number;
  shadowAlpha: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  letterSpacingOffset: number;
}

const PUNCTUATION_SET = new Set(['.', ',', '!', '?', ';', ':', '-', "'", '"']);
const ROUND_BOWL_CHARS = /[aoecdgqpbumnswAOECDGPQUB]/;

/**
 * Splits a word into smooth syllable chunks (3-4 chars) while always separating
 * consecutive twin letters (e.g. 'll', 'ss', 'ff', 'ee', 'oo', 'tt') and trailing punctuation,
 * preserving natural handwriting connections without chopping words into single disconnected letters.
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

    // 1. Separate consecutive twin letters so the second twin gets natural hand variation
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

    // 3. For longer words (5+ chars), split smoothly into 3-4 letter syllable chunks
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
 * Stateful Handwriting Realism Generator
 * Simulates organic human writing characteristics across sentences, words, and syllables:
 * 1. Line Slant Wave: Natural wrist oscillation causing gentle varying forward/upright slant.
 * 2. Intra-word Jitter: Subtle syllable slant, micro-rotation, and loop rounding.
 * 3. Dynamic Pen Pressure: Heavier stroke width on capitals, downstrokes, and ink surges; lighter glides.
 * 4. Zero Baseline Drift: All transforms pivot strictly on (glyphCenterX, baselineY) on ruled lines.
 */
export class HandwritingHumanizer {
  private rng: SeededRandom;
  private intensity: number;
  private eff: number;
  private slantPhase: number;
  private penPressure: number;

  constructor(seed: number, intensity: number) {
    this.rng = new SeededRandom(seed);
    this.intensity = intensity;
    this.eff = clamp(intensity * 0.85, 0, 2.2);
    this.slantPhase = this.rng.uniform(0, Math.PI * 2);
    this.penPressure = this.rng.uniform(0.55, 0.85);
  }

  computeWordSyllables(
    word: string,
    isBold: boolean,
    isItalic: boolean
  ): SyllableRealismStyle[] {
    const boldBonus = isBold ? 0.72 : 0;

    // When Realism is Off (0), render pure uniform font without artificial variation
    if (this.intensity <= 0) {
      return [
        {
          syllable: word,
          skewRad: isItalic ? (12 * Math.PI) / 180 : 0,
          rotateRad: 0,
          scaleX: 1,
          scaleY: 1,
          strokeWidth: boldBonus,
          opacity: 0.98,
          shadowAlpha: isBold ? 0.5 : 0,
          shadowOffsetX: isBold ? 0.35 : 0,
          shadowOffsetY: isBold ? 0.1 : 0,
          letterSpacingOffset: 0
        }
      ];
    }

    // 1. Natural wrist & forearm slant wave across words (-3.2deg to +3.8deg * eff)
    this.slantPhase += this.rng.uniform(0.35, 0.65);
    const baseWordSlantDeg =
      (Math.sin(this.slantPhase) * 2.2 + this.rng.uniform(-2.0, 2.2)) *
      this.eff;

    // 2. Smoothly drift baseline pen pressure from word to word
    this.penPressure = clamp(
      this.penPressure + this.rng.uniform(-0.16, 0.18) * this.eff,
      0.38,
      1.0
    );

    const syllables = splitIntoSmoothSyllables(word);
    const result: SyllableRealismStyle[] = [];

    for (let sIdx = 0; sIdx < syllables.length; sIdx++) {
      const syl = syllables[sIdx];
      const firstCh = syl[0];
      const isWordStart = sIdx === 0;
      const startsWithCap = isWordStart && /^[A-Z0-9]/.test(firstCh);
      const isPunct = /^[.,!?;:\-]$/.test(syl);
      const hasRoundBowl = ROUND_BOWL_CHARS.test(syl);
      const isSecondTwin =
        sIdx > 0 &&
        syllables[sIdx - 1].slice(-1) === firstCh &&
        /[a-zA-Z]/.test(firstCh);

      // A. Angle variation: Syllable Slant + Micro-Rotation
      let localSkewDeg =
        baseWordSlantDeg +
        this.rng.uniform(-1.6, 1.6) * this.eff +
        (isSecondTwin ? this.rng.uniform(2.0, 3.6) * this.eff : 0);
      if (isItalic) localSkewDeg += 12;

      const localRotateDeg = this.rng.uniform(-0.65, 0.65) * this.eff;
      const skewRad = (localSkewDeg * Math.PI) / 180;
      const rotateRad = (localRotateDeg * Math.PI) / 180;

      // B. Horizontal loop relaxation & natural letter height variation
      let scaleX = 1.0 + this.rng.uniform(0.008, 0.038) * this.eff;
      const scaleY = 1.0 + this.rng.uniform(-0.02, 0.02) * this.eff;
      if (hasRoundBowl) scaleX += 0.016 * this.eff;

      // C. Dynamic Pen Stroke Pressure & Thickness Inconsistency
      let localPressure =
        this.penPressure + this.rng.uniform(-0.12, 0.14) * this.eff;
      if (startsWithCap) localPressure += 0.24 * this.eff;
      if (isPunct) localPressure += 0.2 * this.eff;
      if (this.rng.chance(0.24 * this.eff)) localPressure += 0.28 * this.eff; // natural ink surge
      localPressure = clamp(localPressure, 0.35, 1.25);

      let strokeWidth = 0;
      let shadowAlpha = 0;
      let shadowOffsetX = 0;
      let shadowOffsetY = 0;
      let opacity = 0.94;

      if (localPressure >= 0.8) {
        // Heavy pen pressure: rich, thick ballpoint stroke
        strokeWidth =
          (0.38 + this.rng.uniform(0.1, 0.34)) * this.eff + boldBonus;
        shadowAlpha = (0.38 + this.rng.uniform(0.05, 0.15)) * Math.min(1, this.eff);
        shadowOffsetX =
          (0.45 + this.rng.uniform(0.08, 0.22)) * Math.min(1.2, this.eff);
        shadowOffsetY =
          (0.16 + this.rng.uniform(0.04, 0.1)) * Math.min(1.2, this.eff);
        opacity = clamp(0.96 + this.rng.uniform(0.0, 0.04), 0.94, 1.0);
      } else if (localPressure >= 0.56) {
        // Normal casual pen stroke
        strokeWidth =
          (0.18 + this.rng.uniform(0.04, 0.16)) * this.eff + boldBonus;
        shadowAlpha =
          (0.22 + this.rng.uniform(0.0, 0.1)) * Math.min(1, this.eff);
        shadowOffsetX =
          (0.34 + this.rng.uniform(0.04, 0.14)) * Math.min(1.2, this.eff);
        shadowOffsetY =
          (0.12 + this.rng.uniform(0.02, 0.07)) * Math.min(1.2, this.eff);
        opacity = clamp(0.9 + this.rng.uniform(0.0, 0.06), 0.88, 0.96);
      } else {
        // Light gliding pen stroke: thin, delicate line
        strokeWidth =
          (0.05 + this.rng.uniform(0.0, 0.07)) * this.eff + boldBonus;
        shadowAlpha = 0;
        shadowOffsetX = 0;
        shadowOffsetY = 0;
        opacity = clamp(0.82 + this.rng.uniform(0.0, 0.07), 0.8, 0.9);
      }

      const letterSpacingOffset = this.rng.uniform(0.02, 0.22) * this.eff;

      result.push({
        syllable: syl,
        skewRad,
        rotateRad,
        scaleX,
        scaleY,
        strokeWidth,
        opacity,
        shadowAlpha,
        shadowOffsetX,
        shadowOffsetY,
        letterSpacingOffset
      });
    }

    return result;
  }
}

/**
 * Backward-compatible single word realism style helper.
 */
export function computeWordRealism(
  word: string,
  rng: SeededRandom,
  intensity: number,
  isBold: boolean
): WordRealismStyle {
  const humanizer = new HandwritingHumanizer(rng.next(), intensity);
  const syllables = humanizer.computeWordSyllables(word, isBold, false);
  const primary = syllables[0];
  return {
    skewRad: primary.skewRad,
    scaleX: primary.scaleX,
    scaleY: primary.scaleY,
    opacity: primary.opacity,
    strokeWidth: primary.strokeWidth,
    shadowAlpha: primary.shadowAlpha,
    shadowOffsetX: primary.shadowOffsetX,
    shadowOffsetY: primary.shadowOffsetY
  };
}
