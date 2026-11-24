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
  /** Subtle vertical bobbing relative to the line baseline (px) */
  baselineOffsetY: number;
  /** Subtle horizontal micro-offset for natural word/syllable rhythm (px) */
  offsetX: number;
  strokeWidth: number;
  opacity: number;
  shadowAlpha: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  letterSpacingOffset: number;
  /** Tier 2 Bezier control-point perturbation amplitude in px */
  perturbAmpPx: number;
  /** Deterministic instance seed so each glyph occurrence has a unique shape */
  instanceSeed: number;
}

export interface LineRealismProfile {
  marginOffsetX: number;
  slopeRad: number;
  wavePhase: number;
  waveFreq: number;
  waveAmpPx: number;
  scaleDrift: number;
}

export interface WordContextOptions {
  isBold: boolean;
  isItalic: boolean;
  /** True when rendering inside a code block (preserves exact indentation) */
  isCode?: boolean;
  /** True when rendering inside a table cell (keeps tight cell fit) */
  isTableCell?: boolean;
  /** Word's horizontal coordinate on page (for line slope/wave computation) */
  x?: number;
  /** Word's visual line baseline Y (used to group words on the same line) */
  lineY?: number;
}

const PUNCTUATION_SET = new Set(['.', ',', '!', '?', ';', ':', '-', "'", '"', '(', ')']);
const ROUND_BOWL_CHARS = /[aoecdgqpbumnswAOECDGPQUB]/;

/**
 * Splits a word into smooth 2-3 letter syllable chunks while:
 * 1. Isolating leading capital letters so capitals can be styled naturally.
 * 2. Separating consecutive twin letters ('ll', 'ss', 'ff', 'ee', 'oo', 'tt') so they don't look cloned.
 * 3. Separating trailing punctuation for realistic pen stops.
 * 4. Keeping chunks small enough (2-3 chars) for natural intra-word variation without breaking cursive joins.
 */
export function splitIntoSmoothSyllables(word: string): string[] {
  let leadCap = '';
  let rest = word;

  if (/^[A-Z][a-z]/.test(word)) {
    leadCap = word[0];
    rest = word.slice(1);
  }

  const chunks: string[] = leadCap ? [leadCap] : [];
  if (!rest) return chunks;

  if (rest.length <= 2) {
    if (rest.length === 2 && rest[0] === rest[1] && /[a-zA-Z]/.test(rest[0])) {
      chunks.push(rest[0], rest[1]);
      return chunks;
    }
    chunks.push(rest);
    return chunks;
  }

  let buf = '';
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    const nextCh = i + 1 < rest.length ? rest[i + 1] : '';

    buf += ch;

    // Separate consecutive twin letters so the second twin gets distinct hand variation
    if (nextCh && ch === nextCh && /[a-zA-Z]/.test(ch)) {
      chunks.push(buf);
      buf = '';
      continue;
    }

    // Separate punctuation so it gets its own pen stop
    if (nextCh && PUNCTUATION_SET.has(nextCh) && buf.length > 0) {
      chunks.push(buf);
      buf = '';
      continue;
    }

    // Split longer words into organic 2-3 letter chunks
    const remaining = rest.length - (i + 1);
    if (buf.length >= 3 && remaining >= 2 && !PUNCTUATION_SET.has(nextCh)) {
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
 * Stateful Handwriting Realism Generator (Tier 1 + Tier 2)
 * Simulates natural student notebook handwriting:
 * 1. Lighter, crisp ballpoint/gel pen strokes (no marker-thick bolding).
 * 2. Ruled-line-aware baseline: anchored cleanly to notebook lines when ruled,
 *    with subtle organic micro-bobbing; gentle macro line tilt & wave on blank paper.
 * 3. Smooth left-margin wander & organic word-spacing rhythm.
 * 4. Natural wrist slant wave + per-syllable micro-rotation & size drift.
 * 5. Deterministic Tier 2 Bezier glyph perturbation seeds for unique letter shapes.
 */
export class HandwritingHumanizer {
  private rng: SeededRandom;
  private intensity: number;
  private eff: number;
  private isRuled: boolean;
  private slantPhase: number;
  private penPressure: number;
  private marginWanderState: number;
  private lineProfiles: Map<number, LineRealismProfile>;
  private glyphCounter: number;

  constructor(seed: number, intensity: number, isRuled = true) {
    this.rng = new SeededRandom(seed);
    this.intensity = intensity;
    this.eff = clamp(intensity * 0.82, 0, 2.0);
    this.isRuled = isRuled;
    this.slantPhase = this.rng.uniform(0, Math.PI * 2);
    this.penPressure = this.rng.uniform(0.46, 0.72);
    this.marginWanderState = 0;
    this.lineProfiles = new Map();
    this.glyphCounter = (seed & 0xffff) + 1;
  }

  /**
   * Returns (or lazily generates) the organic line-level profile for a visual row.
   */
  getLineProfile(lineY: number): LineRealismProfile {
    const bucket = Math.round(lineY / 8);
    const existing = this.lineProfiles.get(bucket);
    if (existing) return existing;

    if (this.intensity <= 0) {
      const flat: LineRealismProfile = {
        marginOffsetX: 0,
        slopeRad: 0,
        wavePhase: 0,
        waveFreq: 0.02,
        waveAmpPx: 0,
        scaleDrift: 1
      };
      this.lineProfiles.set(bucket, flat);
      return flat;
    }

    // Correlated left-margin wander (real hands drift smoothly line-to-line)
    const maxMargin = this.isRuled ? 1.6 * this.eff : 2.8 * this.eff;
    this.marginWanderState = clamp(
      this.marginWanderState * 0.55 + this.rng.uniform(-1.15, 1.15) * this.eff,
      -maxMargin,
      maxMargin
    );

    // Subtle line slope: nearly flat on ruled lines, gently organic on blank sheets
    const slopeDeg = this.isRuled
      ? this.rng.uniform(-0.07, 0.07) * this.eff
      : this.rng.uniform(-0.34, 0.42) * this.eff;

    // Gentle low-frequency wave across the line width
    const waveAmpPx = this.isRuled
      ? this.rng.uniform(0.18, 0.42) * this.eff
      : this.rng.uniform(0.55, 1.15) * this.eff;

    const profile: LineRealismProfile = {
      marginOffsetX: this.marginWanderState,
      slopeRad: (slopeDeg * Math.PI) / 180,
      wavePhase: this.rng.uniform(0, Math.PI * 2),
      waveFreq: this.rng.uniform(0.014, 0.026),
      waveAmpPx,
      scaleDrift: 1 + this.rng.uniform(-0.016, 0.016) * this.eff
    };

    this.lineProfiles.set(bucket, profile);
    return profile;
  }

  /**
   * Evaluates the line's organic vertical baseline offset at horizontal position x.
   */
  getLineBaselineOffsetY(lineY: number, x: number, isTableCell = false): number {
    if (this.intensity <= 0 || isTableCell) return 0;
    const prof = this.getLineProfile(lineY);
    const slopeDy = Math.tan(prof.slopeRad) * (x - 40);
    const waveDy = Math.sin(x * prof.waveFreq + prof.wavePhase) * prof.waveAmpPx;
    return slopeDy + waveDy;
  }

  computeWordSyllables(
    word: string,
    isBoldOrOpts: boolean | WordContextOptions,
    isItalicArg = false
  ): SyllableRealismStyle[] {
    const opts: WordContextOptions =
      typeof isBoldOrOpts === 'boolean'
        ? { isBold: isBoldOrOpts, isItalic: isItalicArg }
        : isBoldOrOpts;

    const { isBold, isItalic, isCode = false, isTableCell = false } = opts;
    const lineY = opts.lineY ?? 0;
    const wordX = opts.x ?? 40;

    // Reduced, natural bold stroke (firm pen press rather than thick marker)
    const boldBonus = isBold ? 0.16 : 0;

    if (this.intensity <= 0) {
      return [
        {
          syllable: word,
          skewRad: isItalic ? (11 * Math.PI) / 180 : 0,
          rotateRad: 0,
          scaleX: 1,
          scaleY: 1,
          baselineOffsetY: 0,
          offsetX: 0,
          strokeWidth: boldBonus,
          opacity: 0.94,
          shadowAlpha: 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          letterSpacingOffset: 0,
          perturbAmpPx: 0,
          instanceSeed: this.glyphCounter++
        }
      ];
    }

    const lineProfile = this.getLineProfile(lineY);
    const lineDy = this.getLineBaselineOffsetY(lineY, wordX, isTableCell);

    // 1. Natural wrist slant wave across words
    this.slantPhase += this.rng.uniform(0.32, 0.64);
    const baseWordSlantDeg =
      (Math.sin(this.slantPhase) * 1.85 + this.rng.uniform(-1.5, 1.7)) *
      this.eff;

    // 2. Smooth pen pressure drift (kept lighter for realistic ballpoint/gel flow)
    this.penPressure = clamp(
      this.penPressure + this.rng.uniform(-0.12, 0.12) * this.eff,
      0.34,
      0.86
    );

    // 3. Word-level horizontal & vertical micro-placement
    // Preserve exact alignment in code blocks and tight table cells
    const wordOffsetX =
      isCode || isTableCell
        ? 0
        : lineProfile.marginOffsetX + this.rng.uniform(-1.1, 1.2) * this.eff;

    const wordBaseBobY = isTableCell
      ? this.rng.uniform(-0.25, 0.25) * this.eff
      : this.isRuled
        ? this.rng.uniform(-0.38, 0.38) * this.eff
        : this.rng.uniform(-0.65, 0.65) * this.eff;

    const syllables = splitIntoSmoothSyllables(word);
    const result: SyllableRealismStyle[] = [];

    for (let sIdx = 0; sIdx < syllables.length; sIdx++) {
      const syl = syllables[sIdx];
      const firstCh = syl[0];
      const isWordStart = sIdx === 0;
      const isSingleCap = /^[A-Z]$/.test(syl);
      const startsWithCap = isWordStart && /^[A-Z0-9]/.test(firstCh);
      const isPunct = /^[.,!?;:\-()]$/.test(syl);
      const hasRoundBowl = ROUND_BOWL_CHARS.test(syl);
      const isSecondTwin =
        sIdx > 0 &&
        syllables[sIdx - 1].slice(-1) === firstCh &&
        /[a-zA-Z]/.test(firstCh);

      // A. Angle variation: Slant + Micro-Rotation
      let localSkewDeg =
        baseWordSlantDeg +
        this.rng.uniform(-1.45, 1.45) * this.eff +
        (isSecondTwin ? this.rng.uniform(1.8, 3.4) * this.eff : 0);
      if (isItalic) localSkewDeg += 11;

      const localRotateDeg = this.rng.uniform(-0.75, 0.75) * this.eff;
      const skewRad = (localSkewDeg * Math.PI) / 180;
      const rotateRad = (localRotateDeg * Math.PI) / 180;

      // B. Natural letter width/height variation + subtle line fatigue drift
      let scaleX =
        lineProfile.scaleDrift * (1.0 + this.rng.uniform(-0.02, 0.032) * this.eff);
      const scaleY =
        lineProfile.scaleDrift * (1.0 + this.rng.uniform(-0.028, 0.028) * this.eff);
      if (hasRoundBowl) scaleX += 0.01 * this.eff;

      // C. Intra-word baseline micro-bobbing (keeps ruled lines aligned while breaking grid perfection)
      const sylBobY = isTableCell
        ? this.rng.uniform(-0.18, 0.18) * this.eff
        : this.isRuled
          ? this.rng.uniform(-0.32, 0.32) * this.eff
          : this.rng.uniform(-0.5, 0.5) * this.eff;
      const baselineOffsetY = lineDy + wordBaseBobY + sylBobY;

      // D. Lighter, true-to-life ballpoint/gel pen pressure
      let localPressure =
        this.penPressure + this.rng.uniform(-0.1, 0.11) * this.eff;
      if (isSingleCap || startsWithCap) localPressure += 0.11 * this.eff;
      if (isPunct) localPressure += 0.1 * this.eff;
      if (this.rng.chance(0.14 * this.eff)) localPressure += 0.12 * this.eff;
      localPressure = clamp(localPressure, 0.3, 1.05);

      let strokeWidth = boldBonus;
      let shadowAlpha = 0;
      let shadowOffsetX = 0;
      let shadowOffsetY = 0;
      let opacity = 0.89;

      if (localPressure >= 0.8) {
        // Firm pen pressure: subtly richer without looking marker-thick
        strokeWidth =
          (0.05 + this.rng.uniform(0.01, 0.05)) * Math.min(1.2, this.eff) +
          boldBonus;
        shadowAlpha = 0.07 * Math.min(1, this.eff);
        shadowOffsetX = 0.16 * Math.min(1, this.eff);
        shadowOffsetY = 0.06 * Math.min(1, this.eff);
        opacity = clamp(0.92 + this.rng.uniform(0.0, 0.05), 0.9, 0.97);
      } else if (localPressure >= 0.48) {
        // Normal writing flow: crisp fine ballpoint/gel stroke
        strokeWidth = boldBonus;
        opacity = clamp(0.84 + this.rng.uniform(0.0, 0.07), 0.82, 0.92);
      } else {
        // Lighter gliding pen stroke: delicate, slightly faded ink
        strokeWidth = boldBonus * 0.75;
        opacity = clamp(0.75 + this.rng.uniform(0.0, 0.08), 0.73, 0.84);
      }

      const letterSpacingOffset = isCode
        ? 0
        : this.rng.uniform(-0.08, 0.22) * this.eff;

      // E. Tier 2 Bezier outline perturbation amplitude (keeps curves organic & unique per glyph)
      const perturbAmpPx = clamp(
        (0.22 + this.rng.uniform(0.0, 0.18)) * this.eff,
        0,
        0.52
      );

      result.push({
        syllable: syl,
        skewRad,
        rotateRad,
        scaleX,
        scaleY,
        baselineOffsetY,
        offsetX: sIdx === 0 ? wordOffsetX : 0,
        strokeWidth,
        opacity,
        shadowAlpha,
        shadowOffsetX,
        shadowOffsetY,
        letterSpacingOffset,
        perturbAmpPx,
        instanceSeed: this.glyphCounter++
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
  const humanizer = new HandwritingHumanizer(rng.next(), intensity, true);
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
