import React, { useMemo } from 'react';
import {
  DEFAULT_SETTINGS,
  getThemeTokens,
  HANDWRITING_FONTS,
  INK_COLOR_PRESETS,
  PAGE_SIZE_OPTIONS,
  REALISM_PRESETS,
  RESOLUTION_OPTIONS,
  SHEET_GEOMETRY,
  SHEET_PRESET_OPTIONS,
  STENCIL_COLORS,
  SURFACE_OPTIONS
} from '../constants/studioTokens';
import { PageSurfaceEffect, SheetPreset, StudioSettings } from '../types/studio';
import CallChip, { CallChipStatus } from './reactbits/CallChip';
import { GlideSelectOption } from './reactbits/GlideSelect';
import ScrubField from './reactbits/ScrubField';
import WarmTooltip, { WarmTooltipGroup } from './reactbits/WarmTooltip';
import {
  CustomizerCard,
  PropFileActionField,
  PropSelectField,
  PropSwitchField
} from './ui/StudioPrimitives';

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
  const tokens = useMemo(
    () => getThemeTokens(settings.darkMode),
    [settings.darkMode]
  );

  const handleRerollSeed = () => {
    onUpdate({ realismSeed: Math.floor(Math.random() * 900000) + 10000 });
  };

  const handleResetAll = () => {
    onUpdate({
      ...DEFAULT_SETTINGS,
      darkMode: settings.darkMode
    });
  };

  const handleToggleLeftMargin = () => {
    const nextLeft = !settings.showLeftMargin;
    const nextLeftPad = nextLeft
      ? settings.leftPaddingPx < 36
        ? SHEET_GEOMETRY.DEFAULT_LEFT_PAD_WITH_MARGIN
        : settings.leftPaddingPx
      : settings.leftPaddingPx === SHEET_GEOMETRY.DEFAULT_LEFT_PAD_WITH_MARGIN
        ? SHEET_GEOMETRY.DEFAULT_LEFT_PAD_WITHOUT_MARGIN
        : settings.leftPaddingPx;
    onUpdate({
      showLeftMargin: nextLeft,
      leftPaddingPx: nextLeftPad
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
        tag: f.label.includes('(')
          ? f.label.split('(')[1].replace(')', '')
          : undefined
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

  return (
    <WarmTooltipGroup delay={300} warmWindow={400}>
      <div className="customization-col">
        {/* Card 1: Pen, Realism & Print Customize */}
        <CustomizerCard
          icon="ph-pen-nib"
          title="Customize Pen & Realism"
          headerActions={
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
          }
        >
          <div className="customizer-grid-3">
            <PropSelectField
              label="Font"
              value={settings.handwritingFont}
              options={fontOptions}
              tokens={tokens}
              menuWidth={240}
              ariaLabel="Select Handwriting Font"
              onChange={(val) =>
                onUpdate({ handwritingFont: val, customFontName: null })
              }
            />
            <PropSelectField
              label="Ink"
              value={settings.inkColor}
              options={inkOptions}
              tokens={tokens}
              menuWidth={210}
              ariaLabel="Select Ink Color"
              onChange={(val) => onUpdate({ inkColor: val })}
            />
            <PropSelectField
              label="Realism"
              value={String(settings.realismIntensity)}
              options={realismOptions}
              tokens={tokens}
              menuWidth={210}
              ariaLabel="Select Human Realism"
              onChange={(val) => onUpdate({ realismIntensity: Number(val) })}
            />
          </div>

          <div className="customizer-grid-3">
            <PropSelectField
              label="Surface"
              value={settings.pageEffect}
              options={SURFACE_OPTIONS}
              tokens={tokens}
              menuWidth={200}
              ariaLabel="Select Page Surface"
              onChange={(val) =>
                onUpdate({ pageEffect: val as PageSurfaceEffect })
              }
            />
            <PropSelectField
              label="Scale"
              value={String(settings.exportScale)}
              options={RESOLUTION_OPTIONS}
              tokens={tokens}
              menuWidth={210}
              ariaLabel="Select Export Resolution"
              onChange={(val) => onUpdate({ exportScale: Number(val) || 4 })}
            />
            <PropSelectField
              label="Format"
              value={settings.pageSize}
              options={PAGE_SIZE_OPTIONS}
              tokens={tokens}
              menuWidth={180}
              disabled
              ariaLabel="Page Size"
            />
          </div>
        </CustomizerCard>

        {/* Card 2: ScrubField Numeric Customizer */}
        <CustomizerCard
          icon="ph-sliders-horizontal"
          title="Typography & Spacing"
          badge="Drag to scrub · Click to type"
        >
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
              accent={tokens.accentChip}
              chipColor={tokens.surfaceChip}
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
              accent={tokens.accentChip}
              chipColor={tokens.surfaceChip}
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
              accent={tokens.accentChip}
              chipColor={tokens.surfaceChip}
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
              accent={tokens.accentChip}
              chipColor={tokens.surfaceChip}
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
              accent={tokens.accentChip}
              chipColor={tokens.surfaceChip}
              onChange={(v) => onUpdate({ leftPaddingPx: v })}
            />

            <PropFileActionField
              label="Custom Font"
              accept=".ttf, .otf"
              icon="ph-upload-simple"
              buttonText={settings.customFontName ? 'Loaded' : 'Upload .ttf'}
              onSelectFile={onUploadFont}
            />
          </div>
        </CustomizerCard>

        {/* Card 3: Sheet Stencil, Independent Margins & Lines Gap */}
        <CustomizerCard
          icon="ph-notebook"
          title="Sheet Stencil & Margins"
          badge="Independent Stencil Grid"
        >
          <div className="customizer-grid-3">
            <PropSelectField
              label="Template"
              value={settings.sheetPreset}
              options={SHEET_PRESET_OPTIONS}
              tokens={tokens}
              menuWidth={210}
              ariaLabel="Select Sheet Preset"
              onChange={(val) => onPresetChange(val as SheetPreset)}
            />

            <ScrubField
              label="Lines Gap"
              suffix="px"
              value={settings.lineGapPx}
              defaultValue={DEFAULT_SETTINGS.lineGapPx}
              min={SHEET_GEOMETRY.MIN_LINE_GAP_PX}
              max={SHEET_GEOMETRY.MAX_LINE_GAP_PX}
              step={1}
              sensitivity={3}
              size="md"
              fullWidth
              accent={tokens.accentChip}
              chipColor={tokens.surfaceChip}
              onChange={(v) => onUpdate({ lineGapPx: v })}
            />

            <PropFileActionField
              label="Custom Scan"
              accept=".jpg, .jpeg, .png"
              icon="ph-image"
              buttonText={settings.customPaperBgUrl ? 'Change' : 'Upload'}
              hasActiveValue={Boolean(settings.customPaperBgUrl)}
              onSelectFile={onUploadPaperBg}
              onClear={onClearPaperBg}
            />
          </div>

          <div className="customizer-grid-3">
            <PropSwitchField
              label="Top Margin"
              checked={settings.showTopMargin}
              onToggle={() =>
                onUpdate({ showTopMargin: !settings.showTopMargin })
              }
            />

            <PropSwitchField
              label="Left Margin"
              checked={settings.showLeftMargin}
              onToggle={handleToggleLeftMargin}
            />

            <PropSwitchField
              label="Ruled Lines"
              checked={settings.showRuledLines}
              onToggle={() =>
                onUpdate({ showRuledLines: !settings.showRuledLines })
              }
            />
          </div>
        </CustomizerCard>

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
              surfaceColor={tokens.surfaceElevated}
              color={tokens.textChip}
              progressColor={tokens.textChip}
              progressOpacity={0.12}
              doneColor={STENCIL_COLORS.DONE_GREEN}
              errorColor={STENCIL_COLORS.ERROR_RED}
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
