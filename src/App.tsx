import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { DrawModal } from './components/DrawModal';
import { OutputGallery } from './components/OutputGallery';
import { Toolbar } from './components/Toolbar';
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
    try {
      const rendered = await generateHandwrittenPages(
        pageElRef.current,
        paperContentRef.current,
        containerRef.current,
        settings,
        exactLineHeightPx
      );
      setPages(rendered);
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
  }, []);

  const handleDownloadPDF = useCallback(() => {
    exportPagesToPDF(pages);
  }, [pages]);

  const pageClassNames = [
    'page-a',
    settings.showMarginLine ? 'margined' : '',
    settings.showRuledLines ? 'lines' : '',
    settings.customPaperBgUrl ? 'custom-paper-bg' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <main>
      <header className="app-header">
        <div>
          <h1>Handwriting Studio</h1>
          <p className="subtitle">
            High-Resolution Humanized Notebook &amp; Sheet Generator (Canvas 2D
            Vector Engine)
          </p>
        </div>
        <button
          type="button"
          className="dark-mode-toggle"
          aria-label="Toggle Theme"
          title="Toggle AMOLED / Light Mode"
          onClick={() => updateSettings({ darkMode: !settings.darkMode })}
        >
          {settings.darkMode ? (
            <span className="moon" aria-hidden="true">
              <i className="ph-bold ph-sun" style={{ fontSize: '18px' }}></i>
            </span>
          ) : (
            <span className="sun" aria-hidden="true">
              <i className="ph-bold ph-moon" style={{ fontSize: '18px' }}></i>
            </span>
          )}
        </button>
      </header>

      <section className="generate-image-section">
        <div className="display-flex output-grid responsive-flex">
          <div className="flex-1 page-container-super">
            <div className="section-header-row">
              <h2 style={{ margin: 0 }}>Live Sheet Preview</h2>
              <button
                type="button"
                id="draw-diagram-button"
                className="draw-button"
                onClick={() => setIsDrawOpen(true)}
              >
                <i className="ph-bold ph-pencil-line"></i> Draw Diagram
              </button>
            </div>
            <p
              style={{
                fontSize: '0.76rem',
                margin: '4px 0 10px 0',
                opacity: 0.7
              }}
            >
              Type, paste, or format directly on the sheet (supports Markdown{' '}
              <code># Heading</code>, <code>* bullets</code>,{' '}
              <code>**bold**</code>, and rich paste/copy)
            </p>

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
                <div contentEditable suppressContentEditableWarning className="top-margin" />
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
            onUpdate={updateSettings}
            onPresetChange={handlePresetChange}
            onUploadFont={handleUploadFont}
            onUploadPaperBg={handleUploadPaperBg}
            onClearPaperBg={handleClearPaperBg}
            onGenerate={handleGenerate}
          />
        </div>
      </section>

      <OutputGallery
        pages={pages}
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
  );
};
