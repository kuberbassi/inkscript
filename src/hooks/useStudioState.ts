import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  SHEET_GEOMETRY,
  STORAGE_KEYS
} from '../constants/studioTokens';
import { SheetPreset, StudioSettings } from '../types/studio';

export function useStudioState() {
  const [settings, setSettings] = useState<StudioSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        const fallbackMargin = parsed.showMarginLine ?? true;
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          showTopMargin: parsed.showTopMargin ?? fallbackMargin,
          showLeftMargin: parsed.showLeftMargin ?? fallbackMargin,
          lineGapPx: parsed.lineGapPx ?? DEFAULT_SETTINGS.lineGapPx,
          topPaddingPx:
            parsed.topPaddingPx === 5 ? 0 : (parsed.topPaddingPx ?? 0)
        };
      }
    } catch {
      // Ignore storage read failure
    }
    return DEFAULT_SETTINGS;
  });

  const [expandedScale, setExpandedScale] = useState<number>(1.24);

  // Dynamically calculate Pop-Up View modal scale so it fits 100% vertically without a scrollbar
  useEffect(() => {
    const updateModalScale = () => {
      const vh = window.innerHeight || 900;
      const availableSheetHeight =
        vh * SHEET_GEOMETRY.MODAL_VIEWPORT_RATIO -
        SHEET_GEOMETRY.MODAL_CHROME_OFFSET_PX;
      const fitScale = Math.min(
        SHEET_GEOMETRY.MODAL_MAX_SCALE,
        Math.max(
          SHEET_GEOMETRY.MODAL_MIN_SCALE,
          availableSheetHeight / SHEET_GEOMETRY.HEIGHT_PX
        )
      );
      setExpandedScale(Number(fitScale.toFixed(3)));
    };
    updateModalScale();
    window.addEventListener('resize', updateModalScale);
    return () => window.removeEventListener('resize', updateModalScale);
  }, []);

  // Persist settings and synchronize body theme class
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      // Ignore storage quota error
    }
    document.body.classList.toggle('dark', settings.darkMode);
  }, [settings]);

  // Fixed Page Lines Gap (decoupled from font size)
  const exactLineHeightPx = useMemo(() => {
    return Math.max(
      SHEET_GEOMETRY.MIN_LINE_GAP_PX,
      Math.round(settings.lineGapPx || SHEET_GEOMETRY.DEFAULT_LINE_GAP_PX)
    );
  }, [settings.lineGapPx]);

  // Smart baseline compensation so glyphs sit squarely on ruled lines at any font size
  const smartBaselineOffsetPx = useMemo(() => {
    const fontSizePx = (settings.fontSizePt * 4) / 3;
    const naturalGap = fontSizePx * 1.43;
    const diff = exactLineHeightPx - naturalGap;
    return Math.max(0, Math.round(settings.topPaddingPx + diff * 0.18));
  }, [settings.fontSizePt, exactLineHeightPx, settings.topPaddingPx]);

  // Synchronize CSS custom properties for the Live Sheet Preview
  useEffect(() => {
    const lineStopPx = Math.max(1, +(exactLineHeightPx - 1.2).toFixed(2));
    const leftMarginPos = Math.max(
      0,
      Math.round(settings.leftPaddingPx) -
        SHEET_GEOMETRY.LEFT_MARGIN_LINE_OFFSET_PX
    );

    const fontToUse = settings.customFontName
      ? `'${settings.customFontName}', cursive`
      : settings.handwritingFont;

    document.body.style.setProperty('--handwriting-font', fontToUse);
    document.body.style.setProperty('--ink-color', settings.inkColor);
    document.body.style.setProperty(
      '--line-height-val',
      `${exactLineHeightPx}px`
    );
    document.body.style.setProperty('--line-stop-px', `${lineStopPx}px`);
    document.body.style.setProperty('--line-bg-offset', '0px');
    document.body.style.setProperty('--left-margin-pos', `${leftMarginPos}px`);
  }, [settings, exactLineHeightPx]);

  const updateSettings = useCallback((partial: Partial<StudioSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const handlePresetChange = useCallback((preset: SheetPreset) => {
    if (preset === 'blank') {
      setSettings((prev) => ({
        ...prev,
        sheetPreset: 'blank',
        customPaperBgUrl: null,
        showRuledLines: false,
        showTopMargin: false,
        showLeftMargin: false,
        lineGapPx: 22,
        topPaddingPx: 24,
        leftPaddingPx: 28
      }));
    } else {
      setSettings((prev) => ({
        ...prev,
        sheetPreset: 'default',
        customPaperBgUrl: null,
        showRuledLines: true,
        showTopMargin: true,
        showLeftMargin: true,
        lineGapPx: SHEET_GEOMETRY.DEFAULT_LINE_GAP_PX,
        topPaddingPx: 0,
        leftPaddingPx: SHEET_GEOMETRY.DEFAULT_LEFT_PAD_WITH_MARGIN
      }));
    }
  }, []);

  const handleUploadFont = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) return;
      const fontName = `custom-hw-${Date.now()}`;
      const face = new FontFace(fontName, buffer);
      const loadedFace = await face.load();
      document.fonts.add(loadedFace);
      setSettings((prev) => ({
        ...prev,
        customFontName: fontName
      }));
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleUploadPaperBg = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;
      setSettings((prev) => ({
        ...prev,
        customPaperBgUrl: dataUrl,
        showRuledLines: false,
        showTopMargin: false,
        showLeftMargin: false
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  const handleClearPaperBg = useCallback(() => {
    handlePresetChange(settings.sheetPreset);
  }, [handlePresetChange, settings.sheetPreset]);

  return {
    settings,
    expandedScale,
    exactLineHeightPx,
    smartBaselineOffsetPx,
    updateSettings,
    handlePresetChange,
    handleUploadFont,
    handleUploadPaperBg,
    handleClearPaperBg
  };
}

