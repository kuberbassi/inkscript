import { SeededRandom, clamp } from './prng';

export interface WordRealismStyle {
  skewRad: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  shadowAlpha: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

/**
 * Computes deterministic, baseline-locked human handwriting variation for a word token.
 * Because transforms are pivoted directly on the alphabetic baseline (baselineY) in Canvas 2D,
 * words never drift vertically off the ruled notebook lines.
 */
export function computeWordRealism(
  word: string,
  rng: SeededRandom,
  intensity: number,
  isBold: boolean
): WordRealismStyle {
  if (intensity <= 0) {
    return {
      skewRad: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 0.96,
      shadowAlpha: isBold ? 0.65 : 0,
      shadowOffsetX: isBold ? 0.32 : 0,
      shadowOffsetY: isBold ? 0.08 : 0
    };
  }

  const eff = clamp(intensity * 0.65, 0.2, 1.25);
  const skewDeg = rng.uniform(-1.6, 1.6) * eff;
  const skewRad = (skewDeg * Math.PI) / 180;

  const scaleX = 1 + rng.uniform(-0.012, 0.018) * eff;
  const scaleY = 1 + rng.uniform(-0.012, 0.015) * eff;

  const startsWithCap = /^[A-Z0-9]/.test(word);
  const baseOpacity = startsWithCap
    ? rng.uniform(0.94, 0.99)
    : rng.uniform(0.89, 0.97);
  const opacity = clamp(baseOpacity, 0.86, 1.0);

  const hasPressureShadow = isBold || startsWithCap || rng.chance(0.42 * eff);
  const shadowAlpha = hasPressureShadow
    ? opacity * (isBold ? 0.65 : 0.38)
    : 0;
  const shadowOffsetX = isBold ? 0.32 : 0.18;
  const shadowOffsetY = isBold ? 0.08 : 0.05;

  return {
    skewRad,
    scaleX,
    scaleY,
    opacity,
    shadowAlpha,
    shadowOffsetX,
    shadowOffsetY
  };
}
