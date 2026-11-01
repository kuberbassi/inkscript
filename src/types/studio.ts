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
  lineGapPx: number;
  topPaddingPx: number;
  leftPaddingPx: number;
  wordSpacingPx: number;
  letterSpacingPt: number;
  sheetPreset: SheetPreset;
  customPaperBgUrl: string | null;
  showTopMargin: boolean;
  showLeftMargin: boolean;
  showRuledLines: boolean;
  darkMode: boolean;
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
  shortLabel: string;
  value: string;
  previewFont: string;
}

export interface SelectPresetOption<T = string> {
  value: T;
  label: string;
  shortLabel?: string;
  tag: string;
}
