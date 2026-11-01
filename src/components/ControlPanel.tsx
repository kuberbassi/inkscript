import React, { useRef } from 'react';
import {
  HANDWRITING_FONTS,
  INK_COLOR_PRESETS,
  PageSurfaceEffect,
  REALISM_PRESETS,
  SheetPreset,
  StudioSettings
} from '../types/studio';

interface ControlPanelProps {
  settings: StudioSettings;
  isGenerating: boolean;
  onUpdate: (partial: Partial<StudioSettings>) => void;
  onPresetChange: (preset: SheetPreset) => void;
  onUploadFont: (file: File) => void;
  onUploadPaperBg: (file: File) => void;
  onClearPaperBg: () => void;
  onGenerate: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  isGenerating,
  onUpdate,
  onPresetChange,
  onUploadFont,
  onUploadPaperBg,
  onClearPaperBg,
  onGenerate
}) => {
  const paperFileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePaperFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadPaperBg(file);
    }
  };

  const handleClearPaper = () => {
    if (paperFileInputRef.current) {
      paperFileInputRef.current.value = '';
    }
    onClearPaperBg();
  };

  const handleRerollSeed = () => {
    onUpdate({ realismSeed: Math.floor(Math.random() * 900000) + 10000 });
  };

  return (
    <div className="customization-col">
      <div style={{ padding: '0px 0px 8px 0px' }}>
        <h2 style={{ margin: '0 0 4px 0' }}>
          <i className="ph-bold ph-sliders-horizontal"></i> Sheet &amp; Pen
          Settings
        </h2>
        <p style={{ fontSize: '0.78rem', margin: 0, opacity: 0.75 }}>
          Direct Canvas 2D vector engine &amp; human realism apply automatically
          with zero line-height drift.
        </p>
      </div>

      {/* 1. Handwriting Font */}
      <fieldset>
        <legend>
          <i className="ph-bold ph-pen"></i> Handwriting Style
        </legend>

        <div className="category-grid">
          <div>
            <label className="block" htmlFor="handwriting-font">
              Select Handwriting Font
            </label>
            <select
              id="handwriting-font"
              value={settings.handwritingFont}
              onChange={(e) =>
                onUpdate({
                  handwritingFont: e.target.value,
                  customFontName: null
                })
              }
            >
              {HANDWRITING_FONTS.map((f) => (
                <option
                  key={f.value}
                  value={f.value}
                  style={{ fontFamily: f.previewFont, fontSize: '13pt' }}
                >
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="upload-handwriting-container">
            <label className="block" htmlFor="font-file">
              Custom Font (.ttf / .otf)
            </label>
            <input
              accept=".ttf, .otf"
              type="file"
              id="font-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadFont(file);
              }}
            />
          </div>
        </div>
      </fieldset>

      {/* 2. Pen, Realism & Print Quality */}
      <fieldset>
        <legend>
          <i className="ph-bold ph-drop"></i> Pen, Realism &amp; Print Quality
        </legend>

        <div className="category-grid">
          <div className="postfix-input" data-postfix="pt">
            <label htmlFor="font-size">Font Size</label>
            <input
              id="font-size"
              min={6}
              max={30}
              step={0.5}
              value={settings.fontSizePt}
              type="number"
              onChange={(e) =>
                onUpdate({ fontSizePt: Number(e.target.value) || 11 })
              }
            />
          </div>
          <div>
            <label className="block" htmlFor="ink-color">
              Ink Color
            </label>
            <select
              id="ink-color"
              value={settings.inkColor}
              onChange={(e) => onUpdate({ inkColor: e.target.value })}
            >
              {INK_COLOR_PRESETS.map((ink) => (
                <option key={ink.value} value={ink.value}>
                  {ink.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '5px'
              }}
            >
              <label htmlFor="human-realism">Human Realism</label>
              <button
                type="button"
                className="seed-button"
                onClick={handleRerollSeed}
                title={`Re-roll handwriting variation seed (Current: #${settings.realismSeed})`}
              >
                <i className="ph-bold ph-dice-five"></i> Re-Roll
              </button>
            </div>
            <select
              id="human-realism"
              value={settings.realismIntensity}
              onChange={(e) =>
                onUpdate({ realismIntensity: Number(e.target.value) })
              }
            >
              {REALISM_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="category-grid" style={{ marginTop: '12px' }}>
          <div>
            <label className="block" htmlFor="page-size">
              Page Size
            </label>
            <select id="page-size" value={settings.pageSize} disabled>
              <option value="a4">A4 Sheet (210 × 297 mm)</option>
            </select>
          </div>
          <div>
            <label className="block" htmlFor="page-effects">
              Page Surface
            </label>
            <select
              id="page-effects"
              value={settings.pageEffect}
              onChange={(e) =>
                onUpdate({ pageEffect: e.target.value as PageSurfaceEffect })
              }
            >
              <option value="no-effect">Clean White Sheet (Print Ready)</option>
              <option value="shadows">Soft Vignette Shadow</option>
              <option value="scanner">High-Contrast Scanner</option>
            </select>
          </div>
          <div>
            <label className="block" htmlFor="resolution">
              Export Resolution
            </label>
            <select
              id="resolution"
              value={settings.exportScale}
              onChange={(e) =>
                onUpdate({ exportScale: Number(e.target.value) || 4 })
              }
            >
              <option value={2}>Standard (2x)</option>
              <option value={3}>High (3x)</option>
              <option value={4}>Very High (4x)</option>
              <option value={5}>Ultra High (300 DPI Print)</option>
              <option value={6}>Maximum Quality (6x)</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* 3. Alignment & Spacing */}
      <fieldset>
        <legend>
          <i className="ph-bold ph-arrows-out-line-vertical"></i> Alignment
          &amp; Spacing
        </legend>

        <div className="category-grid">
          <div className="postfix-input" data-postfix="em">
            <label htmlFor="line-height">Line Height</label>
            <input
              id="line-height"
              min={0.8}
              max={3.5}
              step={0.05}
              value={settings.lineHeightEm}
              type="number"
              onChange={(e) =>
                onUpdate({ lineHeightEm: Number(e.target.value) || 1.45 })
              }
            />
          </div>
          <div className="postfix-input" data-postfix="px">
            <label htmlFor="top-padding">Top Padding</label>
            <input
              id="top-padding"
              min={0}
              value={settings.topPaddingPx}
              type="number"
              onChange={(e) =>
                onUpdate({ topPaddingPx: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="postfix-input" data-postfix="px">
            <label htmlFor="left-padding">Left Offset</label>
            <input
              id="left-padding"
              min={0}
              value={settings.leftPaddingPx}
              type="number"
              onChange={(e) =>
                onUpdate({ leftPaddingPx: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="postfix-input" data-postfix="px">
            <label htmlFor="word-spacing">Word Spacing</label>
            <input
              id="word-spacing"
              min={-10}
              max={100}
              value={settings.wordSpacingPx}
              type="number"
              onChange={(e) =>
                onUpdate({ wordSpacingPx: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="postfix-input" data-postfix="pt">
            <label htmlFor="letter-spacing">Letter Spacing</label>
            <input
              id="letter-spacing"
              min={-5}
              max={40}
              step={0.5}
              value={settings.letterSpacingPt}
              type="number"
              onChange={(e) =>
                onUpdate({ letterSpacingPt: Number(e.target.value) || 0 })
              }
            />
          </div>
        </div>
      </fieldset>

      {/* 4. Paper Lines & Sheet Template */}
      <fieldset>
        <legend>
          <i className="ph-bold ph-files"></i> Paper Lines &amp; Sheet Template
        </legend>

        <div className="category-grid" style={{ marginBottom: '12px' }}>
          <div>
            <label className="block" htmlFor="paper-stencil-preset">
              Sheet Background Preset
            </label>
            <select
              id="paper-stencil-preset"
              value={settings.sheetPreset}
              onChange={(e) => onPresetChange(e.target.value as SheetPreset)}
            >
              <option value="default">
                Standard Notebook (Adjustable Lines)
              </option>
              <option value="blank">Plain Blank White Sheet</option>
            </select>
          </div>
          <div className="upload-paper-container">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <label className="block" htmlFor="paper-file">
                Or Upload Custom Sheet Image
              </label>
              {settings.customPaperBgUrl && (
                <button
                  type="button"
                  id="clear-paper-file"
                  className="reset-bg-button"
                  onClick={handleClearPaper}
                >
                  Reset BG
                </button>
              )}
            </div>
            <input
              ref={paperFileInputRef}
              accept=".jpg, .jpeg, .png"
              type="file"
              id="paper-file"
              onChange={handlePaperFileChange}
            />
          </div>
        </div>

        <div className="category-grid" style={{ alignItems: 'center' }}>
          <div>
            <label htmlFor="paper-margin-toggle">
              CSS Margin Line:{' '}
              <span aria-label="paper margin status" className="status">
                {settings.showMarginLine ? 'on' : 'off'}
              </span>
            </label>
            <label className="switch-toggle outer">
              <input
                aria-checked={settings.showMarginLine}
                checked={settings.showMarginLine}
                aria-label="Paper Margin Button"
                id="paper-margin-toggle"
                type="checkbox"
                onChange={(e) =>
                  onUpdate({ showMarginLine: e.target.checked })
                }
              />
              <div></div>
            </label>
          </div>

          <div>
            <label htmlFor="paper-line-toggle">
              CSS Ruled Lines:{' '}
              <span aria-label="paper line status" className="status">
                {settings.showRuledLines ? 'on' : 'off'}
              </span>
            </label>
            <label className="switch-toggle outer">
              <input
                aria-checked={settings.showRuledLines}
                checked={settings.showRuledLines}
                aria-label="Paper Line Button"
                id="paper-line-toggle"
                type="checkbox"
                onChange={(e) => onUpdate({ showRuledLines: e.target.checked })}
              />
              <div></div>
            </label>
          </div>
        </div>
      </fieldset>

      {/* 5. Generate Button */}
      <div style={{ textAlign: 'center', padding: '24px 0px 10px 0px' }}>
        <button
          type="button"
          data-testid="generate-image-button"
          className="button generate-image-button"
          onClick={onGenerate}
          disabled={isGenerating}
        >
          <i className="ph-bold ph-magic-wand"></i>{' '}
          {isGenerating
            ? 'Rendering Vector Pages...'
            : 'Generate High-Res Sheet'}
        </button>
      </div>
    </div>
  );
};
