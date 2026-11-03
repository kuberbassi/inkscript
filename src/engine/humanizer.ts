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
 * Splits a word into smooth syllable chunks while:
 * 1. Isolating leading capital letters (e.g. 'L' + 'orem', 'E' + 'xcepteur') so capitals
 *    can be styled naturally without Victorian computer-cursive flourishes.
 * 2. Separating consecutive twin letters ('ll', 'ss', 'ff', 'ee', 'oo', 'tt') so they don't look cloned.
 * 3. Separating trailing punctuation for realistic pen stops.
 * 4. Keeping 3-4 letter syllables connected for natural cursive flow.
 */
export function splitIntoSmoothSyllables(word: string): string[] {
  let leadCap = '';
  let rest = word;

  // Separate leading capital if followed by lowercase (e.g. 'Lorem' -> 'L' + 'orem')
  if (/^[A-Z][a-z]/.test(word)) {
    leadCap = word[0];
    rest = word.slice(1);
  }

  const chunks: string[] = leadCap ? [leadCap] : [];
  if (!rest) return chunks;

  if (rest.length <= 3) {
    for (let i = 0; i < rest.length - 1; i++) {
      if (rest[i] === rest[i + 1] && /[a-zA-Z]/.test(rest[i])) {
        chunks.push(rest.slice(0, i + 1), rest.slice(i + 1));
        return chunks;
      }
    }
    chunks.push(rest);
    return chunks;
  }

  let buf = '';
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    const nextCh = i + 1 < rest.length ? rest[i + 1] : '';

    buf += ch;

    // Separate consecutive twin letters so the second twin gets natural hand variation
    if (nextCh && ch === nextCh && /[a-zA-Z]/.test(ch)) {
      chunks.push(buf);
      buf = '';
      continue;
    }

    // Separate trailing punctuation so it gets its own ink stop
    if (nextCh && PUNCTUATION_SET.has(nextCh) && buf.length > 0) {
      chunks.push(buf);
      buf = '';
      continue;
    }

    // For longer words, split smoothly into 3-4 letter syllable chunks
    const remaining = rest.length - (i + 1);
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
 * Simulates organic, realistic human writing with balanced, subtle pen pressure:
 * 1. Natural wrist & forearm slant wave across lines.
 * 2. Subtle intra-word angle jitter & loop rounding.
 * 3. True-to-life pen pressure: normal writing remains crisp vector stroke;
 *    capitals & firm downstrokes receive subtle ink density (+0.12px–0.20px max);
 *    gliding strokes have delicate, slightly lighter ink.
 * 4. Zero vertical drift: baseline locked to notebook ruled lines.
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
    this.eff = clamp(intensity * 0.8, 0, 2.0);
    this.slantPhase = this.rng.uniform(0, Math.PI * 2);
    this.penPressure = this.rng.uniform(0.5, 0.78);
  }

  computeWordSyllables(
    word: string,
    isBold: boolean,
    isItalic: boolean
  ): SyllableRealismStyle[] {
    const boldBonus = isBold ? 0.55 : 0;

    // When Realism is Off (0), render pure uniform font
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
          shadowAlpha: isBold ? 0.4 : 0,
          shadowOffsetX: isBold ? 0.3 : 0,
          shadowOffsetY: isBold ? 0.08 : 0,
          letterSpacingOffset: 0
        }
      ];
    }

    // 1. Natural wrist slant wave across words (-2.5deg to +3.2deg * eff)
    this.slantPhase += this.rng.uniform(0.32, 0.62);
    const baseWordSlantDeg =
      (Math.sin(this.slantPhase) * 1.9 + this.rng.uniform(-1.6, 1.8)) *
      this.eff;

    // 2. Smooth baseline pen pressure drift
    this.penPressure = clamp(
      this.penPressure + this.rng.uniform(-0.12, 0.14) * this.eff,
      0.4,
      0.9
    );

    const syllables = splitIntoSmoothSyllables(word);
    const result: SyllableRealismStyle[] = [];

    for (let sIdx = 0; sIdx < syllables.length; sIdx++) {
      const syl = syllables[sIdx];
      const firstCh = syl[0];
      const isWordStart = sIdx === 0;
      const isSingleCap = /^[A-Z]$/.test(syl);
      const startsWithCap = isWordStart && /^[A-Z0-9]/.test(firstCh);
      const isPunct = /^[.,!?;:\-]$/.test(syl);
      const hasRoundBowl = ROUND_BOWL_CHARS.test(syl);
      const isSecondTwin =
        sIdx > 0 &&
        syllables[sIdx - 1].slice(-1) === firstCh &&
        /[a-zA-Z]/.test(firstCh);

      // A. Angle variation: Slant + Micro-Rotation
      let localSkewDeg =
        baseWordSlantDeg +
        this.rng.uniform(-1.3, 1.3) * this.eff +
        (isSecondTwin ? this.rng.uniform(1.8, 3.2) * this.eff : 0);
      if (isItalic) localSkewDeg += 12;

      const localRotateDeg = this.rng.uniform(-0.55, 0.55) * this.eff;
      const skewRad = (localSkewDeg * Math.PI) / 180;
      const rotateRad = (localRotateDeg * Math.PI) / 180;

      // B. Horizontal loop relaxation & natural letter height variation
      let scaleX = 1.0 + this.rng.uniform(0.006, 0.032) * this.eff;
      const scaleY = 1.0 + this.rng.uniform(-0.018, 0.018) * this.eff;
      if (hasRoundBowl) scaleX += 0.012 * this.eff;

      // C. True-to-life Pen Pressure & Realistic Thickness Variation
      let localPressure =
        this.penPressure + this.rng.uniform(-0.1, 0.12) * this.eff;
      if (isSingleCap || startsWithCap) localPressure += 0.18 * this.eff;
      if (isPunct) localPressure += 0.14 * this.eff;
      if (this.rng.chance(0.18 * this.eff)) localPressure += 0.16 * this.eff; // natural ink surge
      localPressure = clamp(localPressure, 0.35, 1.2);

      let strokeWidth = boldBonus;
      let shadowAlpha = 0;
      let shadowOffsetX = 0;
      let shadowOffsetY = 0;
      let opacity = 0.94;

      if (localPressure >= 0.82) {
        // Firm pen pressure (capitals, firm downstrokes): subtly richer & slightly thicker
        // Realistic ballpoint line spread: 0.10px - 0.20px max (never blotchy or heavy)
        strokeWidth =
          (0.11 + this.rng.uniform(0.02, 0.07)) * this.eff + boldBonus;
        shadowAlpha = 0.14 * Math.min(1, this.eff);
        shadowOffsetX = 0.22 * Math.min(1, this.eff);
        shadowOffsetY = 0.08 * Math.min(1, this.eff);
        opacity = clamp(0.97 + this.rng.uniform(0.0, 0.03), 0.95, 1.0);
      } else if (localPressure >= 0.52) {
        // Normal writing flow: crisp, sharp natural pen line
        strokeWidth = boldBonus;
        shadowAlpha = 0;
        shadowOffsetX = 0;
        shadowOffsetY = 0;
        opacity = clamp(0.91 + this.rng.uniform(0.0, 0.05), 0.89, 0.96);
      } else {
        // Lighter gliding pen stroke: delicate, slightly lighter in ink
        strokeWidth = boldBonus;
        shadowAlpha = 0;
        shadowOffsetX = 0;
        shadowOffsetY = 0;
        opacity = clamp(0.83 + this.rng.uniform(0.0, 0.06), 0.82, 0.9);
      }

      const letterSpacingOffset = this.rng.uniform(0.02, 0.16) * this.eff;

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
