import {
  FontOption,
  PageSurfaceEffect,
  SelectPresetOption,
  SheetPreset,
  StudioSettings
} from '../types/studio';

/**
 * Single Source of Truth for Sheet & Page Stencil Geometry
 * Shared between the Live DOM Preview (CSS variables) and the Direct Canvas 2D Vector Renderer.
 */
export const SHEET_GEOMETRY = {
  WIDTH_PX: 400,
  HEIGHT_PX: 564,
  TOP_MARGIN_HEIGHT_PX: 50,
  MAX_CONTENT_HEIGHT_WITH_TOP_MARGIN: 490,
  MAX_CONTENT_HEIGHT_WITHOUT_TOP_MARGIN: 534,
  LEFT_MARGIN_LINE_OFFSET_PX: 6,
  DEFAULT_LEFT_PAD_WITH_MARGIN: 55,
  DEFAULT_LEFT_PAD_WITHOUT_MARGIN: 22,
  MIN_LINE_GAP_PX: 14,
  MAX_LINE_GAP_PX: 42,
  DEFAULT_LINE_GAP_PX: 21,
  MODAL_CHROME_OFFSET_PX: 104,
  MODAL_VIEWPORT_RATIO: 0.94,
  MODAL_MIN_SCALE: 1.02,
  MODAL_MAX_SCALE: 1.38
} as const;

export const STENCIL_COLORS = {
  PAPER_BG: '#ffffff',
  RULED_LINE: '#999999',
  MARGIN_LINE: '#f472b6',
  DONE_GREEN: '#22c55e',
  ERROR_RED: '#ef4444'
} as const;

export const STORAGE_KEYS = {
  SETTINGS: 'hw_studio_v3_settings',
  CONTENT: 'hw_studio_v3_content'
} as const;

export interface StudioThemeTokens {
  surfaceChip: string;
  surfaceElevated: string;
  highlightChip: string;
  textChip: string;
  accentChip: string;
  sparkColors: [string, string];
  auroraOpacity: number;
}

export function getThemeTokens(darkMode: boolean): StudioThemeTokens {
  if (darkMode) {
    return {
      surfaceChip: '#27272a',
      surfaceElevated: '#18181b',
      highlightChip: '#3f3f46',
      textChip: '#f4f4f5',
      accentChip: '#f4f4f5',
      sparkColors: ['#ffffff', '#a1a1aa'],
      auroraOpacity: 0.34
    };
  }
  return {
    surfaceChip: '#e4e4e7',
    surfaceElevated: '#e4e4e7',
    highlightChip: '#d4d4d8',
    textChip: '#18181b',
    accentChip: '#18181b',
    sparkColors: ['#18181b', '#52525b'],
    auroraOpacity: 0.28
  };
}

export function getAuroraStopsForInk(inkColor: string): [string, string, string] {
  if (inkColor === '#1a1a1a') {
    return ['#4f46e5', '#0ea5e9', '#8b5cf6'];
  }
  if (inkColor === '#ba3807') {
    return ['#ef4444', '#f43f5e', '#f97316'];
  }
  return ['#3b82f6', '#6366f1', '#0ea5e9'];
}

export const HANDWRITING_FONTS: FontOption[] = [
  {
    label: 'Cedarville Cursive (Casual Loose)',
    shortLabel: 'Cedarville Cursive',
    value: "'Cedarville Cursive', cursive",
    previewFont: "'Cedarville Cursive', cursive"
  },
  {
    label: 'Patrick Hand (Student Print)',
    shortLabel: 'Patrick Hand',
    value: "'Patrick Hand', cursive",
    previewFont: "'Patrick Hand', cursive"
  },
  {
    label: 'Kalam (Pen Handwriting)',
    shortLabel: 'Kalam Pen',
    value: "'Kalam', cursive",
    previewFont: "'Kalam', cursive"
  },
  {
    label: 'Homemade Apple (Classic Cursive)',
    shortLabel: 'Homemade Apple',
    value: "'Homemade Apple', cursive",
    previewFont: "'Homemade Apple', cursive"
  },
  {
    label: 'Caveat (Casual Pen)',
    shortLabel: 'Caveat Pen',
    value: "'Caveat', cursive",
    previewFont: "'Caveat', cursive"
  },
  {
    label: 'Shadows Into Light (Clean Script)',
    shortLabel: 'Shadows Into Light',
    value: "'Shadows Into Light', cursive",
    previewFont: "'Shadows Into Light', cursive"
  },
  {
    label: 'Liu Jian Mao Cao (Brush Pen)',
    shortLabel: 'Liu Jian Mao Cao',
    value: "'Liu Jian Mao Cao', cursive",
    previewFont: "'Liu Jian Mao Cao', cursive"
  },
  {
    label: 'Kruti-dev (Hindi)',
    shortLabel: 'Kruti-dev Hindi',
    value: 'Hindi_Font',
    previewFont: 'Hindi_Font'
  }
];

export const INK_COLOR_PRESETS = [
  { label: 'Ballpen / Gel Blue', shortLabel: 'Gel Blue', value: '#1a2f7d' },
  { label: 'Dark Royal Blue Ink', shortLabel: 'Royal Blue', value: '#091b4a' },
  { label: 'Jet Black Pen', shortLabel: 'Jet Black', value: '#1a1a1a' },
  { label: 'Crimson Red Pen', shortLabel: 'Crimson Red', value: '#ba3807' }
] as const;

export const REALISM_PRESETS = [
  { label: 'Off (Uniform Font)', shortLabel: 'Uniform (0%)', value: 0 },
  { label: 'Subtle Variation', shortLabel: 'Subtle (60%)', value: 0.6 },
  { label: 'Natural Human (Balanced)', shortLabel: 'Natural (100%)', value: 1.0 },
  { label: 'Casual Loose & Irregular', shortLabel: 'Casual Loose', value: 1.35 },
  { label: 'Messy / Fast Rush Notes', shortLabel: 'Fast Rush', value: 1.75 }
] as const;

export const SURFACE_OPTIONS: SelectPresetOption<PageSurfaceEffect>[] = [
  { value: 'no-effect', label: 'Clean White', tag: 'Print' },
  { value: 'shadows', label: 'Soft Shadow', tag: 'Depth' },
  { value: 'scanner', label: 'Scanner Effect', tag: 'Scan' }
];

export const RESOLUTION_OPTIONS: SelectPresetOption<string>[] = [
  { value: '2', label: 'Standard (2×)', tag: '150 DPI' },
  { value: '3', label: 'High (3×)', tag: '220 DPI' },
  { value: '4', label: 'Very High (4×)', tag: '300 DPI' },
  { value: '5', label: 'Ultra High (5×)', tag: '400 DPI' },
  { value: '6', label: 'Max Print (6×)', tag: '500 DPI' }
];

export const SHEET_PRESET_OPTIONS: SelectPresetOption<SheetPreset>[] = [
  { value: 'default', label: 'Ruled Notebook', tag: 'Ruled' },
  { value: 'blank', label: 'Blank White', tag: 'Plain' }
];

export const PAGE_SIZE_OPTIONS: SelectPresetOption<'a4'>[] = [
  { value: 'a4', label: 'A4 Standard', tag: '210×297' }
];

export const DEFAULT_SETTINGS: StudioSettings = {
  handwritingFont: "'Cedarville Cursive', cursive",
  customFontName: null,
  fontSizePt: 11,
  inkColor: '#1a2f7d',
  realismIntensity: 1.35,
  realismSeed: 42197,
  pageSize: 'a4',
  pageEffect: 'no-effect',
  exportScale: 4,
  lineGapPx: SHEET_GEOMETRY.DEFAULT_LINE_GAP_PX,
  topPaddingPx: 0,
  leftPaddingPx: SHEET_GEOMETRY.DEFAULT_LEFT_PAD_WITH_MARGIN,
  wordSpacingPx: 0,
  letterSpacingPt: 0,
  sheetPreset: 'default',
  customPaperBgUrl: null,
  showTopMargin: true,
  showLeftMargin: true,
  showRuledLines: true,
  darkMode: true
};

export const DEFAULT_INITIAL_HTML = `<div style="text-align: center;"><b><u>Skill 5 - Adaptability and Flexibility</u></b></div><br><div style="margin:0; padding:0;"><b><u>1. What is Adaptability?</u></b></div>Adaptability is the ability to adjust ourselves to changing environments, new situations or unfamiliar conditions.<br>It involves learning new things and changing our approach according to the situation.<br><br><div style="margin:0; padding:0;"><b><u>2. What is Flexibility?</u></b></div>Flexibility is the ability to make changes in our plans or actions according to the situation.<br>It helps us adjust quickly when sudden changes happen.<br><br><div style="margin:0; padding:0;"><b><u>3. Similarities</u></b></div><div style="margin:0; padding:0 0 0 18px; text-indent:-12px;">&bull; Both adaptability and flexibility help us deal with changes and new situations.</div><div style="margin:0; padding:0 0 0 18px; text-indent:-12px;">&bull; Both require an open mind and willingness to adjust.</div><div style="margin:0; padding:0 0 0 18px; text-indent:-12px;">&bull; Both help us work better with different people.</div>`;

