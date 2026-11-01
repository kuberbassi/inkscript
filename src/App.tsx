import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { DrawModal } from './components/DrawModal';
import { OutputGallery } from './components/OutputGallery';
import { Toolbar } from './components/Toolbar';
import Aurora from './components/reactbits/Aurora';
import { CallChipStatus } from './components/reactbits/CallChip';
import ClickSpark from './components/reactbits/ClickSpark';
import WarmTooltip, { WarmTooltipGroup } from './components/reactbits/WarmTooltip';
import { generateHandwrittenPages } from './engine/canvasRenderer';
import {
  htmlToMarkdown,
  parsePlainMarkdownToHandwriting,
  sanitizeRichHTMLToHandwriting
} from './engine/markdownParser';
import { exportPagesToPDF } from './engine/pdfExporter';
import {
  DEFAULT_INITIAL_HTML,
  DEFAULT_SETTINGS,
  GeneratedPage,
  SheetPreset,
  StudioSettings
} from './types/studio';

const STORAGE_KEY_SETTINGS = 'hw_studio_v3_settings';
const STORAGE_KEY_CONTENT = 'hw_studio_v3_content';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<StudioSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore storage error
    }
    return DEFAULT_SETTINGS;
  });

  const [pages, setPages] = useState<GeneratedPage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chipStatus, setChipStatus] = useState<CallChipStatus>('idle');
  const [isDrawOpen, setIsDrawOpen] = useState(false);

  const pageElRef = useRef<HTMLDivElement | null>(null);
  const paperContentRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load initial editor content once
  useEffect(() => {
    if (paperContentRef.current) {
      const savedContent = localStorage.getItem(STORAGE_KEY_CONTENT);
      paperContentRef.current.innerHTML = savedContent || DEFAULT_INITIAL_HTML;
    }
  }, []);

  // Save settings to localStorage and sync body theme class
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch {
      // Ignore storage quota error
    }
    document.body.classList.toggle('dark', settings.darkMode);
  }, [settings]);

  // Compute exact integer pixel line-height so CSS text lines and ruled lines never drift
  const exactLineHeightPx = useMemo(() => {
    const fontSizePx = (settings.fontSizePt * 4) / 3;
    return Math.max(12, Math.round(fontSizePx * settings.lineHeightEm));
  }, [settings.fontSizePt, settings.lineHeightEm]);

  // Sync CSS custom variables for the Live Sheet Preview
  useEffect(() => {
    const lineStopPx = Math.max(1, +(exactLineHeightPx - 1.4).toFixed(2));
    const bgOffset = Math.max(0, Math.round(settings.topPaddingPx) - 2);
    const leftMarginPos = Math.max(0, Math.round(settings.leftPaddingPx) - 6);

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
    document.body.style.setProperty('--line-bg-offset', `${bgOffset}px`);
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
        showMarginLine: false,
        lineHeightEm: 1.5,
        topPaddingPx: 28,
        leftPaddingPx: 32
      }));
    } else {
      setSettings((prev) => ({
        ...prev,
        sheetPreset: 'default',
        customPaperBgUrl: null,
        showRuledLines: true,
        showMarginLine: true,
        lineHeightEm: 1.45,
        topPaddingPx: 5,
        leftPaddingPx: 55
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
        showMarginLine: false
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  const handleClearPaperBg = useCallback(() => {
    handlePresetChange(settings.sheetPreset);
  }, [handlePresetChange, settings.sheetPreset]);

  const saveEditorContent = useCallback(() => {
    if (paperContentRef.current) {
      try {
        localStorage.setItem(
          STORAGE_KEY_CONTENT,
          paperContentRef.current.innerHTML
        );
      } catch {
        // Ignore quota error
      }
    }
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const htmlData = e.clipboardData.getData('text/html');
      const plainText = e.clipboardData.getData('text/plain');

      const hasExplicitMarkdown = /(^#{1,6}\s|\*\*.+?\*\*|^\s*[-*]\s+)/m.test(
        plainText
      );

      let finalHTML = '';
      if (htmlData && htmlData.trim().length > 0 && !hasExplicitMarkdown) {
        finalHTML = sanitizeRichHTMLToHandwriting(htmlData);
      }
      if (!finalHTML) {
        finalHTML = parsePlainMarkdownToHandwriting(plainText);
      }

      document.execCommand('insertHTML', false, finalHTML);
      saveEditorContent();
    },
    [saveEditorContent]
  );

  const handleCopy = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(range.cloneContents());

    const mdText = htmlToMarkdown(tempDiv);
    const htmlSnippet = tempDiv.innerHTML;

    if (mdText && e.clipboardData) {
      e.preventDefault();
      e.clipboardData.setData('text/plain', mdText);
      e.clipboardData.setData('text/html', htmlSnippet);
    }
  }, []);

  const handleToolbarCommand = useCallback(
    (cmd: string) => {
      paperContentRef.current?.focus();
      document.execCommand(cmd, false, undefined);
      saveEditorContent();
    },
    [saveEditorContent]
  );

  const handleToolbarInsert = useCallback(
    (text: string) => {
      paperContentRef.current?.focus();
      document.execCommand('insertText', false, text);
      saveEditorContent();
    },
    [saveEditorContent]
  );

  const handleToolbarHeading1 = useCallback(() => {
    paperContentRef.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      document.execCommand('bold', false, undefined);
      document.execCommand('underline', false, undefined);
      document.execCommand('justifyCenter', false, undefined);
    } else {
      document.execCommand(
        'insertHTML',
        false,
        '<div style="text-align: center;"><b><u>Heading Title</u></b></div><br/>'
      );
    }
    saveEditorContent();
  }, [saveEditorContent]);

  const handleAddSketchToPaper = useCallback(
    (dataUrl: string) => {
      if (!paperContentRef.current) return;
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.maxWidth = '100%';
      paperContentRef.current.appendChild(img);
      saveEditorContent();
    },
    [saveEditorContent]
  );

  const handleGenerate = useCallback(async () => {
    if (!pageElRef.current || !paperContentRef.current) return;
    setIsGenerating(true);
    setChipStatus('running');

    // Allow React to paint the CallChip running state and start its live timer smoothly
    await new Promise((r) => setTimeout(r, 120));

    try {
      const rendered = await generateHandwrittenPages(
        pageElRef.current,
        paperContentRef.current,
        containerRef.current,
        settings,
        exactLineHeightPx
      );
      setPages(rendered);
      setChipStatus('done');
    } catch {
      setChipStatus('error');
    } finally {
      setIsGenerating(false);
    }
  }, [settings, exactLineHeightPx]);

  const handleRemovePage = useCallback((index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveLeft = useCallback((index: number) => {
    if (index === 0) return;
    setPages((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index - 1, 0, item);
      return next;
    });
  }, []);

  const handleMoveRight = useCallback((index: number) => {
    setPages((prev) => {
      if (index + 1 >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + 1, 0, item);
      return next;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setPages([]);
    setChipStatus('idle');
  }, []);

  const handleDownloadPDF = useCallback(() => {
    exportPagesToPDF(pages);
  }, [pages]);

  // Dynamic Aurora color stops synced with active Ink Color & Studio theme
  const auroraStops = useMemo(() => {
    const ink = settings.inkColor || '#1a2f7d';
    if (ink === '#141824') {
      return ['#3f3f46', '#71717a', '#52525b'];
    }
    if (ink === '#991b1b') {
      return ['#dc2626', '#f43f5e', '#991b1b'];
    }
    return [ink, '#6366f1', '#38bdf8'];
  }, [settings.inkColor]);

  const pageClassNames = [
    'page-a',
    settings.showMarginLine ? 'margined' : '',
    settings.showRuledLines ? 'lines' : '',
    settings.customPaperBgUrl ? 'custom-paper-bg' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ClickSpark
      sparkColor={settings.darkMode ? ['#ffffff', '#a1a1aa'] : ['#18181b', '#52525b']}
      sparkSize={10}
      sparkRadius={22}
      sparkCount={8}
      sparkWidth={1.6}
      duration={420}
      easing="ease-out"
    >
      {/* Top Margin Aurora Effect Synced & Optimized */}
      <div className="aurora-top-banner" aria-hidden="true">
        <Aurora
          colorStops={auroraStops}
          amplitude={0.85}
          blend={0.55}
          speed={0.75}
          height={0.55}
          glow={0.65}
          brightness={settings.darkMode ? 0.85 : 0.65}
          opacity={settings.darkMode ? 0.52 : 0.35}
          lightMode={!settings.darkMode}
          direction="top"
          mouseInteraction
        />
      </div>

      <main className="studio-main">
        <WarmTooltipGroup delay={300} warmWindow={400}>
          <header className="app-header">
            <div className="header-brand">
              <div className="brand-badge">
                <i className="ph-fill ph-notebook"></i>
                <span>Studio v3.0</span>
              </div>
              <h1>Handwriting Studio</h1>
              <p className="subtitle">
                Humanized Notebook &amp; Sheet Generator · Direct Canvas 2D Vector Engine
              </p>
            </div>

            <div className="header-actions">
              <WarmTooltip
                content={settings.darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                shortcut="Theme"
                side="bottom"
              >
                <button
                  type="button"
                  className="dark-mode-toggle"
                  aria-label="Toggle Theme"
                  onClick={() => updateSettings({ darkMode: !settings.darkMode })}
                >
                  {settings.darkMode ? (
                    <i className="ph ph-sun" style={{ fontSize: '17px' }}></i>
                  ) : (
                    <i className="ph ph-moon" style={{ fontSize: '17px' }}></i>
                  )}
                </button>
              </WarmTooltip>
            </div>
          </header>

          <section className="generate-image-section">
            <div className="display-flex output-grid responsive-flex">
              <div className="flex-1 page-container-super">
                <div className="section-header-row">
                  <div className="flex items-center gap-2">
                    <h2 style={{ margin: 0 }}>Sheet Canvas</h2>
                    <span className="sheet-live-pill">Live</span>
                  </div>
                  <WarmTooltip
                    content="Open freehand sketch & diagram tool"
                    shortcut="Draw"
                    side="top"
                  >
                    <button
                      type="button"
                      id="draw-diagram-button"
                      className="draw-button"
                      onClick={() => setIsDrawOpen(true)}
                    >
                      <i className="ph ph-pencil-line"></i>
                      <span>Draw Diagram</span>
                    </button>
                  </WarmTooltip>
                </div>

                <Toolbar
                  onCommand={handleToolbarCommand}
                  onInsert={handleToolbarInsert}
                  onHeading1={handleToolbarHeading1}
                />

                <div className="flex-1 page-container">
                  <div
                    ref={pageElRef}
                    className={pageClassNames}
                    style={{
                      fontSize: `${settings.fontSizePt}pt`,
                      lineHeight: `${exactLineHeightPx}px`,
                      wordSpacing: `${settings.wordSpacingPx}px`,
                      letterSpacing: `${settings.letterSpacingPt}pt`,
                      backgroundImage: settings.customPaperBgUrl
                        ? `url("${settings.customPaperBgUrl}")`
                        : undefined
                    }}
                  >
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="top-margin"
                    />
                    <div
                      ref={containerRef}
                      className="display-flex left-margin-and-content"
                    >
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        className="left-margin"
                      />
                      <div
                        ref={paperContentRef}
                        id="note"
                        className="paper-content"
                        contentEditable
                        suppressContentEditableWarning
                        style={{
                          paddingTop: `${settings.topPaddingPx}px`,
                          paddingLeft: `${settings.leftPaddingPx}px`
                        }}
                        onInput={saveEditorContent}
                        onPaste={handlePaste}
                        onCopy={handleCopy}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <ControlPanel
                settings={settings}
                isGenerating={isGenerating}
                chipStatus={chipStatus}
                pageCount={pages.length}
                onUpdate={updateSettings}
                onPresetChange={handlePresetChange}
                onUploadFont={handleUploadFont}
                onUploadPaperBg={handleUploadPaperBg}
                onClearPaperBg={handleClearPaperBg}
                onGenerate={handleGenerate}
              />
            </div>
          </section>
        </WarmTooltipGroup>

        <OutputGallery
          pages={pages}
          darkMode={settings.darkMode}
          onRemovePage={handleRemovePage}
          onMoveLeft={handleMoveLeft}
          onMoveRight={handleMoveRight}
          onClearAll={handleClearAll}
          onDownloadPDF={handleDownloadPDF}
        />

        <DrawModal
          isOpen={isDrawOpen}
          inkColor={settings.inkColor}
          onClose={() => setIsDrawOpen(false)}
          onAddImageToPaper={handleAddSketchToPaper}
        />
      </main>
    </ClickSpark>
  );
};
