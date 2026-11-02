import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { DrawModal } from './components/DrawModal';
import { OutputGallery } from './components/OutputGallery';
import { Toolbar } from './components/Toolbar';
import Aurora from './components/reactbits/Aurora';
import { CallChipStatus } from './components/reactbits/CallChip';
import ClickSpark from './components/reactbits/ClickSpark';
import WarmTooltip, { WarmTooltipGroup } from './components/reactbits/WarmTooltip';
import {
  DEFAULT_INITIAL_HTML,
  getAuroraStopsForInk,
  getThemeTokens,
  SHEET_GEOMETRY,
  STORAGE_KEYS
} from './constants/studioTokens';
import { generateHandwrittenPages } from './engine/canvasRenderer';
import {
  htmlToMarkdown,
  parsePlainMarkdownToHandwriting,
  sanitizeRichHTMLToHandwriting
} from './engine/markdownParser';
import { exportPagesToPDF } from './engine/pdfExporter';
import { useStudioState } from './hooks/useStudioState';
import { GeneratedPage } from './types/studio';

function stripInlineFontOverrides(el: HTMLElement): void {
  const styledEls = el.querySelectorAll<HTMLElement>('[style], font');
  styledEls.forEach((child) => {
    if (child.style) {
      child.style.fontSize = '';
      child.style.fontFamily = '';
      child.style.lineHeight = '';
      child.style.color = '';
    }
    if (child.tagName.toLowerCase() === 'font') {
      child.removeAttribute('size');
      child.removeAttribute('face');
      child.removeAttribute('color');
    }
  });
}

export const App: React.FC = () => {
  const {
    settings,
    expandedScale,
    exactLineHeightPx,
    smartBaselineOffsetPx,
    updateSettings,
    handlePresetChange,
    handleUploadFont,
    handleUploadPaperBg,
    handleClearPaperBg
  } = useStudioState();

  const [pages, setPages] = useState<GeneratedPage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chipStatus, setChipStatus] = useState<CallChipStatus>('idle');
  const [isDrawOpen, setIsDrawOpen] = useState(false);
  const [isExpandedEditor, setIsExpandedEditor] = useState(false);

  const pageElRef = useRef<HTMLDivElement | null>(null);
  const paperContentRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const tokens = useMemo(
    () => getThemeTokens(settings.darkMode),
    [settings.darkMode]
  );

  const auroraStops = useMemo(
    () => getAuroraStopsForInk(settings.inkColor),
    [settings.inkColor]
  );

  // Load initial editor content once
  useEffect(() => {
    if (paperContentRef.current) {
      const savedContent = localStorage.getItem(STORAGE_KEYS.CONTENT);
      const isLegacySkill = savedContent && savedContent.includes('Skill ');
      if (isLegacySkill) {
        try {
          localStorage.setItem(STORAGE_KEYS.CONTENT, DEFAULT_INITIAL_HTML);
        } catch {
          // Ignore quota error
        }
      }
      paperContentRef.current.innerHTML =
        (isLegacySkill ? null : savedContent) || DEFAULT_INITIAL_HTML;
      stripInlineFontOverrides(paperContentRef.current);
    }
  }, []);

  // Close expanded editor on Escape key
  useEffect(() => {
    if (!isExpandedEditor) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpandedEditor(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isExpandedEditor]);

  const saveEditorContent = useCallback(() => {
    if (paperContentRef.current) {
      try {
        localStorage.setItem(
          STORAGE_KEYS.CONTENT,
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
      if (paperContentRef.current) {
        stripInlineFontOverrides(paperContentRef.current);
      }
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
    if (isExpandedEditor) {
      setIsExpandedEditor(false);
      await new Promise((r) => setTimeout(r, 60));
    }

    setIsGenerating(true);
    setChipStatus('running');

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
  }, [settings, exactLineHeightPx, isExpandedEditor]);

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

  const pageClassNames = [
    'page-a',
    settings.showTopMargin ? 'top-margined' : '',
    settings.showLeftMargin ? 'left-margined' : '',
    settings.showRuledLines ? 'lines' : '',
    settings.customPaperBgUrl ? 'custom-paper-bg' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const modalZoomWidth = Math.round(SHEET_GEOMETRY.WIDTH_PX * expandedScale);
  const modalZoomHeight = Math.round(SHEET_GEOMETRY.HEIGHT_PX * expandedScale);

  return (
    <ClickSpark
      sparkColor={tokens.sparkColors}
      sparkSize={10}
      sparkRadius={22}
      sparkCount={8}
      sparkWidth={1.6}
      duration={420}
      easing="ease-out"
    >
      {/* Top Margin Colorful Aurora Effect Synced & Optimized */}
      <div className="aurora-top-banner" aria-hidden="true">
        <Aurora
          colorStops={auroraStops}
          amplitude={0.85}
          blend={0.55}
          speed={0.75}
          height={0.55}
          opacity={tokens.auroraOpacity}
          lightMode={!settings.darkMode}
          mouseInteraction
        />
      </div>

      <main className="studio-main">
        <WarmTooltipGroup delay={300} warmWindow={400}>
          <header className="app-header">
            <div className="header-brand">
              <div className="brand-badge">
                <i className="ph-fill ph-pen-nib"></i>
                <span>InkScript Studio</span>
              </div>
              <h1>InkScript</h1>
              <p className="subtitle">
                Transform digital notes &amp; Markdown into realistic, print-ready A4 handwritten notebook sheets
              </p>
            </div>

            <div className="header-actions">
              <WarmTooltip
                content={
                  settings.darkMode
                    ? 'Switch to Light Mode'
                    : 'Switch to Dark Mode'
                }
                shortcut="Theme"
                side="bottom"
              >
                <button
                  type="button"
                  className="dark-mode-toggle"
                  aria-label="Toggle Theme"
                  onClick={() =>
                    updateSettings({ darkMode: !settings.darkMode })
                  }
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
              {isExpandedEditor && (
                <div
                  className="sheet-modal-backdrop"
                  onClick={() => setIsExpandedEditor(false)}
                />
              )}

              <div
                className={`flex-1 page-container-super ${
                  isExpandedEditor ? 'expanded-modal-mode' : ''
                }`}
                style={
                  isExpandedEditor
                    ? ({
                        '--modal-sheet-scale': expandedScale,
                        '--modal-stage-w': `${modalZoomWidth}px`,
                        '--modal-stage-h': `${modalZoomHeight}px`
                      } as React.CSSProperties)
                    : undefined
                }
              >
                <div className="section-header-row">
                  <div className="section-header-title-group">
                    <h2 style={{ margin: 0 }}>
                      {isExpandedEditor
                        ? 'Expanded Sheet Editor'
                        : 'Sheet Canvas'}
                    </h2>
                    <span className="sheet-live-pill">Live</span>
                  </div>

                  <div className="section-header-actions">
                    <WarmTooltip
                      content="Insert diagram image or open freehand sketch pad"
                      shortcut="Diagram"
                      side="top"
                    >
                      <button
                        type="button"
                        id="draw-diagram-button"
                        className="draw-button"
                        onClick={() => setIsDrawOpen(true)}
                      >
                        <i className="ph ph-image-square"></i>
                        <span>Diagram</span>
                      </button>
                    </WarmTooltip>

                    <WarmTooltip
                      content={
                        isExpandedEditor
                          ? 'Exit Pop-Up View (Esc)'
                          : 'Expand Sheet in Pop-Up View for Large Editing'
                      }
                      shortcut={isExpandedEditor ? 'Esc' : 'Zoom'}
                      side="top"
                    >
                      <button
                        type="button"
                        className="draw-button expand-sheet-btn"
                        onClick={() => setIsExpandedEditor((v) => !v)}
                      >
                        <i
                          className={
                            isExpandedEditor
                              ? 'ph ph-arrows-in-simple'
                              : 'ph ph-arrows-out-simple'
                          }
                        ></i>
                        <span>{isExpandedEditor ? 'Minimize' : 'Pop-Up'}</span>
                      </button>
                    </WarmTooltip>
                  </div>
                </div>

                <Toolbar
                  onCommand={handleToolbarCommand}
                  onInsert={handleToolbarInsert}
                  onHeading1={handleToolbarHeading1}
                />

                <div className="flex-1 page-container">
                  <div className="sheet-zoom-stage">
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
                            paddingTop: `${smartBaselineOffsetPx}px`,
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

      <footer className="site-footer">
        <div className="site-footer-inner">
          <a
            className="footer-signature"
            href="https://kuberbassi.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Kuber Bassi website"
          >
            <span className="footer-mark" aria-hidden="true">
              KB
            </span>
            <span className="footer-credit">
              <span>Crafted by</span>
              <strong>Kuber Bassi</strong>
            </span>
          </a>

          <p className="footer-copyright">
            <span>© {new Date().getFullYear()} Kuber Bassi</span>
            <span className="footer-separator" aria-hidden="true">
              /
            </span>
            <span>InkScript</span>
          </p>

          <nav className="footer-links" aria-label="Footer links">
            <a href="https://kuberbassi.com" target="_blank" rel="noreferrer">
              kuberbassi.com
              <i className="ph ph-arrow-up-right" aria-hidden="true"></i>
            </a>
            <a
              href="https://github.com/kuberbassi/inkscript"
              target="_blank"
              rel="noreferrer"
            >
              <i className="ph ph-github-logo" aria-hidden="true"></i>
              Repository
              <i className="ph ph-arrow-up-right" aria-hidden="true"></i>
            </a>
          </nav>
        </div>
      </footer>
    </ClickSpark>
  );
};
