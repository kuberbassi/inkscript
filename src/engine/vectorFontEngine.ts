import { parse as parseOpenType, type Font, type PathCommand } from 'opentype.js';

/**
 * Tier 2 Vector Font Engine (opentype.js)
 * Loads raw TrueType/OpenType font outlines and applies smooth, spatially coherent
 * 2D noise perturbation to Bezier control points so every instance of a letter
 * ('a', 'e', 'o', 's', 'm', etc.) has a genuinely unique hand-drawn outline at
 * full vector sharpness (300-500 DPI).
 */

const DIRECT_TTF_URLS: Record<string, string> = {
  'Cedarville Cursive':
    'https://fonts.gstatic.com/s/cedarvillecursive/v18/yYL00g_a2veiudhUmxjo5VKkoqA-B_neJQ.ttf',
  'Cedarville Classic':
    'https://fonts.gstatic.com/s/cedarvillecursive/v18/yYL00g_a2veiudhUmxjo5VKkoqA-B_neJQ.ttf',
  Caveat:
    'https://fonts.gstatic.com/s/caveat/v23/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9SII.ttf',
  'Patrick Hand':
    'https://fonts.gstatic.com/s/patrickhand/v23/LDI1apSQOAYtSuYWp8ZhfYe8XsLLubg58w.ttf',
  Kalam:
    'https://fonts.gstatic.com/s/kalam/v17/YA9dr0Wd4kDdMthROCc.ttf',
  'Homemade Apple':
    'https://fonts.gstatic.com/s/homemadeapple/v22/Qw3EZQFXECDrI2q789EKQZJob0x6XHg.ttf',
  'Shadows Into Light':
    'https://fonts.gstatic.com/s/shadowsintolight/v19/UqyNK9UOIntux_czAvDQx_ZcHqZXBNQDcsr4.ttf'
};

const fontCache = new Map<string, Font | null>();
const pendingLoads = new Map<string, Promise<Font | null>>();

function normalizeFamilyKey(fontFamilyCss: string): string {
  const first = fontFamilyCss.split(',')[0]?.trim() || '';
  return first.replace(/^['"]|['"]$/g, '');
}

/**
 * Registers a user-uploaded .ttf / .otf font ArrayBuffer for Tier 2 vector perturbation.
 */
export function registerCustomFontBuffer(
  fontName: string,
  buffer: ArrayBuffer
): void {
  try {
    const parsed = parseOpenType(buffer);
    fontCache.set(fontName, parsed);
  } catch {
    fontCache.set(fontName, null);
  }
}

/**
 * Synchronously retrieves a cached opentype.Font if already loaded.
 */
export function getCachedVectorFont(fontFamilyCss: string): Font | null {
  const key = normalizeFamilyKey(fontFamilyCss);
  return fontCache.get(key) ?? null;
}

/**
 * Preloads the opentype.Font for a CSS font-family string (and Caveat capitals if needed).
 */
export async function ensureVectorFontLoaded(
  fontFamilyCss: string
): Promise<Font | null> {
  const key = normalizeFamilyKey(fontFamilyCss);
  if (fontCache.has(key)) {
    return fontCache.get(key) ?? null;
  }

  const url = DIRECT_TTF_URLS[key];
  if (!url) {
    fontCache.set(key, null);
    return null;
  }

  if (pendingLoads.has(key)) {
    return pendingLoads.get(key)!;
  }

  const loadPromise = (async (): Promise<Font | null> => {
    try {
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) {
        fontCache.set(key, null);
        return null;
      }
      const buffer = await resp.arrayBuffer();
      const font = parseOpenType(buffer);
      fontCache.set(key, font);
      return font;
    } catch {
      fontCache.set(key, null);
      return null;
    } finally {
      pendingLoads.delete(key);
    }
  })();

  pendingLoads.set(key, loadPromise);
  return loadPromise;
}

// Fast deterministic 2D value noise in [-1, 1] for smooth organic curve deformation
function hash2D(ix: number, iy: number, seed: number): number {
  let h =
    Math.imul(ix, 374761393) ^
    Math.imul(iy, 668265263) ^
    Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return ((h >>> 0) / 2147483648) - 1;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise2D(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);

  const v00 = hash2D(ix, iy, seed);
  const v10 = hash2D(ix + 1, iy, seed);
  const v01 = hash2D(ix, iy + 1, seed);
  const v11 = hash2D(ix + 1, iy + 1, seed);

  const i1 = v00 + (v10 - v00) * fx;
  const i2 = v01 + (v11 - v01) * fx;
  return i1 + (i2 - i1) * fy;
}

export interface VectorPerturbOptions {
  /** Amplitude of Bezier control point perturbation in px (typical: 0.18 - 0.55) */
  amplitudePx: number;
  /** Deterministic instance seed so each occurrence of the same letter is unique */
  instanceSeed: number;
  /** Optional target width from DOM/Canvas measurement for exact horizontal fit */
  targetWidth?: number;
}

/**
 * Builds a smoothly perturbed Canvas 2D path for a text run using its raw TrueType outlines.
 * Returns true if the vector path was successfully constructed, false if caller should fall back to fillText.
 */
export function buildPerturbedGlyphPath(
  ctx: CanvasRenderingContext2D,
  font: Font,
  text: string,
  x: number,
  baselineY: number,
  fontSizePx: number,
  options: VectorPerturbOptions
): boolean {
  // Skip complex non-Latin scripts where OpenType shaping (ligatures/GSUB) is required
  if (/[\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF]/.test(text)) {
    return false;
  }

  // Verify every character has a real glyph in this font (not .notdef)
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ') continue;
    const glyph = font.charToGlyph(ch);
    if (!glyph || glyph.index === 0) {
      return false;
    }
  }

  const rawPath = font.getPath(text, 0, 0, fontSizePx);
  const commands: PathCommand[] = rawPath.commands;
  if (!commands || commands.length === 0) {
    return false;
  }

  // Compute gentle horizontal fit ratio if DOM width is known
  let fitScaleX = 1;
  if (options.targetWidth && options.targetWidth > 1) {
    const advWidth = font.getAdvanceWidth(text, fontSizePx);
    if (advWidth > 1) {
      const ratio = options.targetWidth / advWidth;
      // Only apply subtle fit correction; if wildly different, keep natural advance
      if (ratio > 0.78 && ratio < 1.28) {
        fitScaleX = ratio;
      }
    }
  }

  const amp = options.amplitudePx;
  const freq = 0.16; // Smooth spatial frequency (~6px wavelength keeps curves organic, never jagged)
  const seedX = options.instanceSeed * 17 + 31;
  const seedY = options.instanceSeed * 29 + 97;

  const px = (vx: number, vy: number): number => {
    const wx = x + vx * fitScaleX;
    if (amp <= 0.001) return wx;
    return wx + valueNoise2D(vx * freq, vy * freq, seedX) * amp;
  };

  const py = (vx: number, vy: number): number => {
    const wy = baselineY + vy;
    if (amp <= 0.001) return wy;
    return wy + valueNoise2D(vx * freq + 11.3, vy * freq - 7.1, seedY) * amp;
  };

  ctx.beginPath();
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd.type) {
      case 'M':
        ctx.moveTo(px(cmd.x, cmd.y), py(cmd.x, cmd.y));
        break;
      case 'L':
        ctx.lineTo(px(cmd.x, cmd.y), py(cmd.x, cmd.y));
        break;
      case 'Q':
        ctx.quadraticCurveTo(
          px(cmd.x1, cmd.y1),
          py(cmd.x1, cmd.y1),
          px(cmd.x, cmd.y),
          py(cmd.x, cmd.y)
        );
        break;
      case 'C':
        ctx.bezierCurveTo(
          px(cmd.x1, cmd.y1),
          py(cmd.x1, cmd.y1),
          px(cmd.x2, cmd.y2),
          py(cmd.x2, cmd.y2),
          px(cmd.x, cmd.y),
          py(cmd.x, cmd.y)
        );
        break;
      case 'Z':
        ctx.closePath();
        break;
    }
  }

  return true;
}
