import React, { useMemo, useRef } from 'react';
import {
  DEFAULT_SETTINGS,
  HANDWRITING_FONTS,
  INK_COLOR_PRESETS,
  PageSurfaceEffect,
  REALISM_PRESETS,
  SheetPreset,
  StudioSettings
} from '../types/studio';
import CallChip, { CallChipStatus } from './reactbits/CallChip';
import GlideSelect, { GlideSelectOption } from './reactbits/GlideSelect';
import ScrubField from './reactbits/ScrubField';
import WarmTooltip, { WarmTooltipGroup } from './reactbits/WarmTooltip';

interface ControlPanelProps {
  settings: StudioSettings;
  isGenerating: boolean;
  chipStatus: CallChipStatus;
  pageCount: number;
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
  chipStatus,
  pageCount,
  onUpdate,
  onPresetChange,
  onUploadFont,
  onUploadPaperBg,
  onClearPaperBg,
  onGenerate
}) => {
  const paperFileInputRef = useRef<HTMLInputElement | null>(null);
  const fontFileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleResetAll = () => {
    onUpdate({
      ...DEFAULT_SETTINGS,
      darkMode: settings.darkMode
    });
  };

  const fontOptions: GlideSelectOption[] = useMemo(
    () =>
      HANDWRITING_FONTS.map((f) => ({
        value: f.value,
        label: (
          <span style={{ fontFamily: f.previewFont, fontSize: '13.5px' }}>
            {f.shortLabel}
          </span>
        ),
        tag: f.label.includes('(') ? f.label.split('(')[1].replace(')', '') : undefined
      })),
    []
  );

  const inkOptions: GlideSelectOption[] = useMemo(
    () =>
      INK_COLOR_PRESETS.map((ink) => ({
        value: ink.value,
        label: (
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px] border border-white/25"
              style={{ backgroundColor: ink.value }}
            />
            <span>{ink.shortLabel}</span>
          </span>
        ),
        tag: ink.value
      })),
    []
  );

  const realismOptions: GlideSelectOption[] = useMemo(
    () =>
      REALISM_PRESETS.map((p) => ({
        value: String(p.value),
        label: p.shortLabel,
        tag: p.value === 0 ? '0%' : `${Math.round(p.value * 100)}%`
      })),
    []
  );

  const surfaceOptions: GlideSelectOption[] = useMemo(
    () => [
      {
        value: 'no-effect',
        label: 'Clean White',
        tag: 'Print'
      },
      {
        value: 'shadows',
        label: 'Soft Shadow',
        tag: 'Depth'
      },
      {
        value: 'scanner',
        label: 'Scanner Effect',
        tag: 'Scan'
      }
    ],
    []
  );

  const resolutionOptions: GlideSelectOption[] = useMemo(
    () => [
      { value: '2', label: 'Standard (2×)', tag: '150 DPI' },
      { value: '3', label: 'High (3×)', tag: '220 DPI' },
      { value: '4', label: 'Very High (4×)', tag: '300 DPI' },
      { value: '5', label: 'Ultra High (5×)', tag: '400 DPI' },
      { value: '6', label: 'Max Print (6×)', tag: '500 DPI' }
    ],
    []
  );

  const presetOptions: GlideSelectOption[] = useMemo(
    () => [
      {
        value: 'default',
        label: 'Ruled Notebook',
        tag: 'Ruled'
      },
      {
        value: 'blank',
        label: 'Blank White',
        tag: 'Plain'
      }
    ],
    []
  );

  const pageSizeOptions: GlideSelectOption[] = useMemo(
    () => [
      {
        value: 'a4',
        label: 'A4 Standard',
        tag: '210×297'
      }
    ],
    []
  );

  const surfaceChip = settings.darkMode ? '#27272a' : '#e4e4e7';
  const highlightChip = settings.darkMode ? '#3f3f46' : '#d4d4d8';
  const textChip = settings.darkMode ? '#f4f4f5' : '#18181b';
  const accentChip = settings.darkMode ? '#f4f4f5' : '#18181b';

  return (
    <WarmTooltipGroup delay={300} warmWindow={400}>
      <div className="customization-col">
        {/* Card 1: Pen, Realism & Print Customize */}
        <div className="customizer-card">
          <div className="customizer-card-header">
            <div className="customizer-card-title">
              <i className="ph ph-pen-nib"></i>
              <span>Customize Pen &amp; Realism</span>
            </div>
            <div className="flex items-center gap-1.5">
              <WarmTooltip
                content={`Re-roll variation seed (#${settings.realismSeed})`}
                shortcut="Seed"
                side="top"
              >
                <button
                  type="button"
                  className="customizer-reset-btn"
                  onClick={handleRerollSeed}
                >
                  <i className="ph ph-dice-five"></i>
                  <span>Re-Roll</span>
                </button>
              </WarmTooltip>
              <WarmTooltip content="Reset all parameters to defaults" side="top">
                <button
                  type="button"
                  className="customizer-reset-btn"
                  onClick={handleResetAll}
                >
                  <i className="ph ph-arrow-counter-clockwise"></i>
                  <span>Reset</span>
                </button>
              </WarmTooltip>
            </div>
          </div>

          <div className="customizer-card-body">
            {/* Row 1: Font & Ink & Realism */}
            <div className="customizer-grid-3">
              <div className="prop-cell">
                <span className="prop-label">Font</span>
                <div className="prop-control">
                  <GlideSelect
                    options={fontOptions}
                    value={settings.handwritingFont}
                    onChange={(val) =>
                      onUpdate({ handwritingFont: val, customFontName: null })
                    }
                    surfaceColor={surfaceChip}
                    highlightColor={highlightChip}
                    textColor={textChip}
                    accentColor={accentChip}
                    size="sm"
                    radius={8}
                    menuWidth={240}
                    align="right"
                    ariaLabel="Select Handwriting Font"
                  />
                </div>
              </div>

              <div className="prop-cell">
                <span className="prop-label">Ink</span>
                <div className="prop-control">
                  <GlideSelect
                    options={inkOptions}
                    value={settings.inkColor}
                    onChange={(val) => onUpdate({ inkColor: val })}
                    surfaceColor={surfaceChip}
                    highlightColor={highlightChip}
                    textColor={textChip}
                    accentColor={accentChip}
                    size="sm"
                    radius={8}
                    menuWidth={210}
                    align="right"
                    ariaLabel="Select Ink Color"
                  />
                </div>
              </div>

              <div className="prop-cell">
                <span className="prop-label">Realism</span>
                <div className="prop-control">
                  <GlideSelect
                    options={realismOptions}
                    value={String(settings.realismIntensity)}
                    onChange={(val) =>
                      onUpdate({ realismIntensity: Number(val) })
                    }
                    surfaceColor={surfaceChip}
                    highlightColor={highlightChip}
                    textColor={textChip}
                    accentColor={accentChip}
                    size="sm"
                    radius={8}
                    menuWidth={210}
                    align="right"
                    ariaLabel="Select Human Realism"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Surface, Resolution, Page Size */}
            <div className="customizer-grid-3">
              <div className="prop-cell">
                <span className="prop-label">Surface</span>
                <div className="prop-control">
                  <GlideSelect
                    options={surfaceOptions}
                    value={settings.pageEffect}
                    onChange={(val) =>
                      onUpdate({ pageEffect: val as PageSurfaceEffect })
                    }
                    surfaceColor={surfaceChip}
                    highlightColor={highlightChip}
                    textColor={textChip}
                    accentColor={accentChip}
                    size="sm"
                    radius={8}
                    menuWidth={200}
                    align="right"
                    ariaLabel="Select Page Surface"
                  />
                </div>
              </div>

              <div className="prop-cell">
                <span className="prop-label">Scale</span>
                <div className="prop-control">
                  <GlideSelect
                    options={resolutionOptions}
                    value={String(settings.exportScale)}
                    onChange={(val) =>
                      onUpdate({ exportScale: Number(val) || 4 })
                    }
                    surfaceColor={surfaceChip}
                    highlightColor={highlightChip}
                    textColor={textChip}
                    accentColor={accentChip}
                    size="sm"
                    radius={8}
                    menuWidth={210}
                    align="right"
                    ariaLabel="Select Export Resolution"
                  />
                </div>
              </div>

              <div className="prop-cell">
                <span className="prop-label">Format</span>
                <div className="prop-control">
                  <GlideSelect
                    options={pageSizeOptions}
                    value={settings.pageSize}
                    disabled
                    surfaceColor={surfaceChip}
                    highlightColor={highlightChip}
                    textColor={textChip}
                    accentColor={accentChip}
                    size="sm"
                    radius={8}
                    menuWidth={180}
                    align="right"
                    ariaLabel="Page Size"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: ScrubField Numeric Customizer (Drag to Scrub / Click to Type) */}
        <div className="customizer-card">
          <div className="customizer-card-header">
            <div className="customizer-card-title">
              <i className="ph ph-sliders-horizontal"></i>
              <span>Typography &amp; Spacing</span>
            </div>
            <span className="customizer-badge">Drag to scrub · Click to type</span>
          </div>

          <div className="customizer-card-body">
            <div className="customizer-grid-3">
              <ScrubField
                label="Font Size"
                suffix="pt"
                value={settings.fontSizePt}
                defaultValue={DEFAULT_SETTINGS.fontSizePt}
                min={6}
                max={26}
                step={0.5}
                sensitivity={3}
                size="md"
                fullWidth
                accent={accentChip}
                chipColor={surfaceChip}
                onChange={(v) => onUpdate({ fontSizePt: v })}
              />

              <ScrubField
                label="Word Gap"
                suffix="px"
                value={settings.wordSpacingPx}
                defaultValue={DEFAULT_SETTINGS.wordSpacingPx}
                min={-6}
                max={40}
                step={0.5}
                sensitivity={3}
                size="md"
                fullWidth
                accent={accentChip}
                chipColor={surfaceChip}
                onChange={(v) => onUpdate({ wordSpacingPx: v })}
              />

              <ScrubField
                label="Letter Gap"
                suffix="pt"
                value={settings.letterSpacingPt}
                defaultValue={DEFAULT_SETTINGS.letterSpacingPt}
                min={-3}
                max={20}
                step={0.25}
                sensitivity={4}
                size="md"
                fullWidth
                accent={accentChip}
                chipColor={surfaceChip}
                onChange={(v) => onUpdate({ letterSpacingPt: v })}
              />
            </div>

            <div className="customizer-grid-3">
              <ScrubField
                label="Top Pad"
                suffix="px"
                value={settings.topPaddingPx}
                defaultValue={DEFAULT_SETTINGS.topPaddingPx}
                min={0}
                max={120}
                step={1}
                sensitivity={2}
                size="md"
                fullWidth
                accent={accentChip}
                chipColor={surfaceChip}
                onChange={(v) => onUpdate({ topPaddingPx: v })}
              />

              <ScrubField
                label="Left Offset"
                suffix="px"
                value={settings.leftPaddingPx}
                defaultValue={DEFAULT_SETTINGS.leftPaddingPx}
                min={0}
                max={140}
                step={1}
                sensitivity={2}
                size="md"
                fullWidth
                accent={accentChip}
                chipColor={surfaceChip}
                onChange={(v) => onUpdate({ leftPaddingPx: v })}
              />

              <div className="prop-cell">
                <span className="prop-label">Custom Font</span>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={fontFileInputRef}
                    accept=".ttf, .otf"
                    type="file"
                    id="font-file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadFont(file);
                    }}
                  />
                  <button
                    type="button"
                    className="notion-chip-btn"
                    onClick={() => fontFileInputRef.current?.click()}
                  >
                    <i className="ph ph-upload-simple"></i>
                    <span>
                      {settings.customFontName ? 'Loaded' : 'Upload .ttf'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Sheet Stencil, Lines Gap & Custom Background */}
        <div className="customizer-card">
          <div className="customizer-card-header">
            <div className="customizer-card-title">
              <i className="ph ph-notebook"></i>
              <span>Sheet Stencil &amp; Margins</span>
            </div>
            <span className="customizer-badge">Independent Stencil Grid</span>
          </div>

          <div className="customizer-card-body">
            <div className="customizer-grid-3">
              <div className="prop-cell">
                <span className="prop-label">Template</span>
                <div className="prop-control">
                  <GlideSelect
                    options={presetOptions}
                    value={settings.sheetPreset}
                    onChange={(val) => onPresetChange(val as SheetPreset)}
                    surfaceColor={surfaceChip}
                    highlightColor={highlightChip}
                    textColor={textChip}
                    accentColor={accentChip}
                    size="sm"
                    radius={8}
                    menuWidth={210}
                    align="right"
                    ariaLabel="Select Sheet Preset"
                  />
                </div>
              </div>

              <ScrubField
                label="Lines Gap"
                suffix="px"
                value={settings.lineGapPx}
                defaultValue={DEFAULT_SETTINGS.lineGapPx}
                min={14}
                max={42}
                step={1}
                sensitivity={3}
                size="md"
                fullWidth
                accent={accentChip}
                chipColor={surfaceChip}
                onChange={(v) => onUpdate({ lineGapPx: v })}
              />

              <div className="prop-cell">
                <span className="prop-label">Custom Scan</span>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={paperFileInputRef}
                    accept=".jpg, .jpeg, .png"
                    type="file"
                    id="paper-file"
                    className="hidden"
                    onChange={handlePaperFileChange}
                  />
                  {settings.customPaperBgUrl && (
                    <button
                      type="button"
                      className="notion-chip-btn danger"
                      onClick={handleClearPaper}
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    className="notion-chip-btn"
                    onClick={() => paperFileInputRef.current?.click()}
                  >
                    <i className="ph ph-image"></i>
                    <span>
                      {settings.customPaperBgUrl ? 'Change' : 'Upload'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="customizer-grid-3">
              <div className="prop-cell">
                <span className="prop-label">Top Margin</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showTopMargin}
                  className="notion-switch"
                  data-checked={settings.showTopMargin ? 'true' : 'false'}
                  onClick={() =>
                    onUpdate({ showTopMargin: !settings.showTopMargin })
                  }
                >
                  <span className="notion-switch-thumb" />
                </button>
              </div>

              <div className="prop-cell">
                <span className="prop-label">Left Margin</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showLeftMargin}
                  className="notion-switch"
                  data-checked={settings.showLeftMargin ? 'true' : 'false'}
                  onClick={() => {
                    const nextLeft = !settings.showLeftMargin;
                    const nextLeftPad = nextLeft
                      ? settings.leftPaddingPx < 36
                        ? 55
                        : settings.leftPaddingPx
                      : settings.leftPaddingPx === 55
                        ? 22
                        : settings.leftPaddingPx;
                    onUpdate({
                      showLeftMargin: nextLeft,
                      leftPaddingPx: nextLeftPad
                    });
                  }}
                >
                  <span className="notion-switch-thumb" />
                </button>
              </div>

              <div className="prop-cell">
                <span className="prop-label">Ruled Lines</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showRuledLines}
                  className="notion-switch"
                  data-checked={settings.showRuledLines ? 'true' : 'false'}
                  onClick={() =>
                    onUpdate({ showRuledLines: !settings.showRuledLines })
                  }
                >
                  <span className="notion-switch-thumb" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Row: Generate High-Res Sheet + Live CallChip */}
        <div className="generate-action-bar">
          <button
            type="button"
            data-testid="generate-image-button"
            className="button generate-image-button"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            <i className="ph ph-printer"></i>
            <span>
              {isGenerating
                ? 'Rendering Vector Pages…'
                : 'Generate High-Res Sheet'}
            </span>
          </button>

          {chipStatus !== 'idle' && (
            <CallChip
              icon="edit"
              name="canvas2d"
              argument={
                chipStatus === 'running'
                  ? `rendering @ ${settings.exportScale}×`
                  : `${pageCount} ${pageCount === 1 ? 'sheet' : 'sheets'} @ ${settings.exportScale}×`
              }
              status={chipStatus}
              expectedMs={420}
              size={40}
              radius={10}
              surfaceColor={settings.darkMode ? '#18181b' : '#e4e4e7'}
              color={settings.darkMode ? '#f4f4f5' : '#18181b'}
              progressColor={settings.darkMode ? '#f4f4f5' : '#18181b'}
              progressOpacity={0.12}
              doneColor="#22c55e"
              errorColor="#ef4444"
              washOpacity={0.16}
              showTimer
              onRetry={onGenerate}
            />
          )}
        </div>
      </div>
    </WarmTooltipGroup>
  );
};
