import React, { useState } from 'react';
import { GeneratedPage } from '../types/studio';

interface OutputGalleryProps {
  pages: GeneratedPage[];
  onRemovePage: (index: number) => void;
  onMoveLeft: (index: number) => void;
  onMoveRight: (index: number) => void;
  onClearAll: () => void;
  onDownloadPDF: () => void;
}

export const OutputGallery: React.FC<OutputGalleryProps> = ({
  pages,
  onRemovePage,
  onMoveLeft,
  onMoveRight,
  onClearAll,
  onDownloadPDF
}) => {
  const [zoomedPage, setZoomedPage] = useState<GeneratedPage | null>(null);

  return (
    <section className="output-section">
      <div className="output-header-bar">
        <h2 id="output-header" style={{ margin: 0 }}>
          Output {pages.length > 0 ? `( ${pages.length} )` : ''}
        </h2>
        {pages.length > 0 && (
          <div className="output-actions">
            <button
              type="button"
              className="button imp-button"
              onClick={onDownloadPDF}
            >
              <i className="ph-bold ph-file-pdf"></i> Download PDF
            </button>
            <button
              type="button"
              className="button delete-button"
              onClick={onClearAll}
            >
              <i className="ph-bold ph-trash"></i> Clear All
            </button>
          </div>
        )}
      </div>

      <div id="output" className="output">
        {pages.length === 0 ? (
          <span>
            Click &quot;Generate High-Res Sheet&quot; to render your handwritten
            pages.
          </span>
        ) : (
          pages.map((page, index) => (
            <div
              key={page.id}
              className="output-image-container"
              style={{
                position: 'relative',
                display: 'inline-block',
                verticalAlign: 'top'
              }}
            >
              <button
                type="button"
                className="close-button"
                onClick={() => onRemovePage(index)}
                title="Remove Page"
              >
                &times;
              </button>
              <img
                className="shadow"
                alt={`Output page ${index + 1}`}
                src={page.dataUrl}
                style={{ cursor: 'zoom-in' }}
                onClick={() => setZoomedPage(page)}
                title="Click to inspect full resolution"
              />
              <div style={{ textAlign: 'center' }}>
                <a
                  className="button download-image-button"
                  download={`handwritten-page-${index + 1}.png`}
                  href={page.dataUrl}
                >
                  <i className="ph-bold ph-download-simple"></i> Download Image
                </a>
                <br />
                <br />
                <button
                  type="button"
                  className="button"
                  onClick={() => onMoveLeft(index)}
                  disabled={index === 0}
                  style={{ marginRight: '6px' }}
                >
                  Move Left
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => onMoveRight(index)}
                  disabled={index === pages.length - 1}
                >
                  Move Right
                </button>
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
            &times;
          </button>
          <img
            src={zoomedPage.dataUrl}
            alt="Zoomed handwritten page"
            style={{
              maxHeight: '92vh',
              maxWidth: '92vw',
              border: '1px solid #fff',
              boxShadow: '0 16px 48px rgba(0,0,0,0.85)'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
};
