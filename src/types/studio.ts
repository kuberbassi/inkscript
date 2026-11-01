export type SheetPreset = 'default' | 'blank';

export type PageSurfaceEffect = 'no-effect' | 'shadows' | 'scanner';

export type TextAlignMode = 'left' | 'center' | 'right' | 'justify';

export interface StudioSettings {
  handwritingFont: string;
  customFontName: string | null;
  fontSizePt: number;
  inkColor: string;
  realismIntensity: number;
  realismSeed: number;
  pageSize: 'a4';
  pageEffect: PageSurfaceEffect;
  exportScale: number;
  lineHeightEm: number;
  topPaddingPx: number;
  leftPaddingPx: number;
  wordSpacingPx: number;
  letterSpacingPt: number;
  sheetPreset: SheetPreset;
  customPaperBgUrl: string | null;
  showMarginLine: boolean;
  showRuledLines: boolean;
  darkMode: boolean;
}

export interface LogicalBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'bullet' | 'numbered' | 'blank';
  html: string;
  align: TextAlignMode;
  indentPx: number;
  hangingIndentPx: number;
  listMarker?: string;
}

export interface GeneratedPage {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  pageNumber: number;
}

export interface FontOption {
  label: string;
  value: string;
  previewFont: string;
}

export const HANDWRITING_FONTS: FontOption[] = [
  {
    label: 'Cedarville Cursive (Casual Loose & Irregular)',
    value: "'Cedarville Cursive', cursive",
    previewFont: "'Cedarville Cursive', cursive"
  },
  {
    label: 'Patrick Hand (Student Print)',
    value: "'Patrick Hand', cursive",
    previewFont: "'Patrick Hand', cursive"
  },
  {
    label: 'Kalam (Pen Handwriting)',
    value: "'Kalam', cursive",
    previewFont: "'Kalam', cursive"
  },
  {
    label: 'Homemade Apple (Classic Cursive)',
    value: "'Homemade Apple', cursive",
    previewFont: "'Homemade Apple', cursive"
  },
  {
    label: 'Caveat (Casual Pen)',
    value: "'Caveat', cursive",
    previewFont: "'Caveat', cursive"
  },
  {
    label: 'Shadows Into Light (Clean Script)',
    value: "'Shadows Into Light', cursive",
    previewFont: "'Shadows Into Light', cursive"
  },
  {
    label: 'Liu Jian Mao Cao (Brush Pen)',
    value: "'Liu Jian Mao Cao', cursive",
    previewFont: "'Liu Jian Mao Cao', cursive"
  },
  {
    label: 'Kruti-dev (Hindi)',
    value: 'Hindi_Font',
    previewFont: 'Hindi_Font'
  }
];

export const INK_COLOR_PRESETS = [
  { label: 'Ballpen / Gel Blue', value: '#1a2f7d' },
  { label: 'Dark Royal Blue Ink', value: '#091b4a' },
  { label: 'Jet Black Pen', value: '#1a1a1a' },
  { label: 'Crimson Red Pen', value: '#ba3807' }
];

export const REALISM_PRESETS = [
  { label: 'Off (Uniform Font)', value: 0 },
  { label: 'Subtle Variation', value: 0.6 },
  { label: 'Natural Human (Balanced)', value: 1.0 },
  {
    label: 'Casual Loose & Irregular (Variable Slant & Ink)',
    value: 1.35
  },
  {
    label: 'Messy / Fast Rush Notes (High Slant & Pressure)',
    value: 1.75
  }
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
  lineHeightEm: 1.45,
  topPaddingPx: 5,
  leftPaddingPx: 55,
  wordSpacingPx: 0,
  letterSpacingPt: 0,
  sheetPreset: 'default',
  customPaperBgUrl: null,
  showMarginLine: true,
  showRuledLines: true,
  darkMode: true
};

export const DEFAULT_INITIAL_HTML = `<div style="text-align: center;"><b><u>Skill 5 - Adaptability and Flexibility</u></b></div><br><b><u>1. What is Adaptability?</u></b><br>Adaptability is the ability to adjust ourselves to changing environments, new situations or unfamiliar conditions.<br>It involves learning new things and changing our approach according to the situation.<br><br><b><u>2. What is Flexibility?</u></b><br>Flexibility is the ability to make changes in our plans or actions according to the situation.<br>It helps us adjust quickly when sudden changes happen.<br><br><b><u>3. Similarities</u></b><br><div style="margin:0; padding:0 0 0 18px; text-indent:-12px;">&bull; Both adaptability and flexibility help us deal with changes and new situations.</div><div style="margin:0; padding:0 0 0 18px; text-indent:-12px;">&bull; Both require an open mind and willingness to adjust.</div><div style="margin:0; padding:0 0 0 18px; text-indent:-12px;">&bull; Both help us work better with different people.</div>`;
