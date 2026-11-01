import React, { useState } from 'react';
import { GeneratedPage } from '../types/studio';
import HoldButton from './reactbits/HoldButton';
import WarmTooltip, { WarmTooltipGroup } from './reactbits/WarmTooltip';

interface OutputGalleryProps {
  pages: GeneratedPage[];
  darkMode?: boolean;
  onRemovePage: (index: number) => void;
  onMoveLeft: (index: number) => void;
  onMoveRight: (index: number) => void;
  onClearAll: () => void;
  onDownloadPDF: () => void;
}

export const OutputGallery: React.FC<OutputGalleryProps> = ({
  pages,
  darkMode = true,
  onRemovePage,
  onMoveLeft,
  onMoveRight,
  onClearAll,
  onDownloadPDF
}) => {
  const [zoomedPage, setZoomedPage] = useState<GeneratedPage | null>(null);

  return (
    <WarmTooltipGroup delay={300} warmWindow={400}>
      <section className="output-section">
        <div className="output-header-bar">
          <div className="flex items-center gap-2.5">
            <h2 id="output-header" style={{ margin: 0 }}>
              Output Gallery
            </h2>
            {pages.length > 0 && (
              <span className="output-count-pill">
                {pages.length} {pages.length === 1 ? 'Sheet' : 'Sheets'}
              </span>
            )}
          </div>
          {pages.length > 0 && (
            <div className="output-actions">
              <WarmTooltip content="Export full-bleed A4 PDF" shortcut="PDF" side="top">
                <button
                  type="button"
                  className="button imp-button"
                  onClick={onDownloadPDF}
                >
                  <i className="ph ph-file-pdf"></i>
                  <span>Download PDF</span>
                </button>
              </WarmTooltip>

              <WarmTooltip
                content="Press and hold to clear all generated sheets"
                shortcut="Hold"
                side="top"
              >
                <span>
                  <HoldButton
                    size="sm"
                    radius={10}
                    holdTime={1100}
                    backgroundColor={darkMode ? '#18181b' : '#e4e4e7'}
                    fillColor="#ef4444"
                    textColor={darkMode ? '#f4f4f5' : '#18181b'}
                    fillTextColor="#ffffff"
                    icon={<i className="ph ph-trash" style={{ fontSize: '14px' }}></i>}
                    doneIcon={<i className="ph ph-check" style={{ fontSize: '14px' }}></i>}
                    doneLabel="Cleared"
                    onHold={onClearAll}
                  >
                    Hold to Clear
                  </HoldButton>
                </span>
              </WarmTooltip>
            </div>
          )}
        </div>

        <div id="output" className="output">
          {pages.length === 0 ? (
            <div className="output-empty-state">
              <div className="output-empty-badge">
                <i className="ph ph-stack"></i>
              </div>
              <div className="output-empty-text">
                <span className="output-empty-title">No sheets rendered yet</span>
                <span className="output-empty-sub">
                  Configure your pen &amp; stencil settings above, then click{' '}
                  <strong>Generate High-Res Sheet</strong> to render print-ready
                  A4 pages.
                </span>
              </div>
            </div>
          ) : (
            pages.map((page, index) => (
              <div key={page.id} className="output-image-container">
                <div className="output-card-preview">
                  <WarmTooltip content="Remove sheet" side="top">
                    <button
                      type="button"
                      className="close-button"
                      onClick={() => onRemovePage(index)}
                      aria-label="Remove Page"
                    >
                      <i className="ph ph-x"></i>
                    </button>
                  </WarmTooltip>
                  <img
                    className="shadow"
                    alt={`Output page ${index + 1}`}
                    src={page.dataUrl}
                    style={{ cursor: 'zoom-in' }}
                    onClick={() => setZoomedPage(page)}
                  />
                </div>
                <div className="output-card-footer">
                  <a
                    className="button download-image-button"
                    download={`handwritten-page-${index + 1}.png`}
                    href={page.dataUrl}
                  >
                    <i className="ph ph-download-simple"></i>
                    <span>Download PNG</span>
                  </a>
                  <div className="output-reorder-row">
                    <WarmTooltip content="Move sheet left" side="bottom">
                      <button
                        type="button"
                        className="notion-icon-btn"
                        onClick={() => onMoveLeft(index)}
                        disabled={index === 0}
                        aria-label="Move Left"
                      >
                        <i className="ph ph-caret-left"></i>
                      </button>
                    </WarmTooltip>
                    <span className="output-page-num">Page {index + 1}</span>
                    <WarmTooltip content="Move sheet right" side="bottom">
                      <button
                        type="button"
                        className="notion-icon-btn"
                        onClick={() => onMoveRight(index)}
                        disabled={index === pages.length - 1}
                        aria-label="Move Right"
                      >
                        <i className="ph ph-caret-right"></i>
                      </button>
                    </WarmTooltip>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {zoomedPage && (
          <div
            className="popup-container show"
            onClick={() => setZoomedPage(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
          >
            <button
              type="button"
              className="close-button"
              onClick={() => setZoomedPage(null)}
            >
              <i className="ph ph-x"></i>
            </button>
            <img
              src={zoomedPage.dataUrl}
              alt="Zoomed handwritten page"
              style={{
                maxHeight: '92vh',
                maxWidth: '92vw',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.85)'
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </section>
    </WarmTooltipGroup>
  );
};
