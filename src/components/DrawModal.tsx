import React, { useEffect, useRef, useState } from 'react';

interface DrawModalProps {
  isOpen: boolean;
  inkColor: string;
  onClose: () => void;
  onAddImageToPaper: (dataUrl: string) => void;
}

type ModalTab = 'upload' | 'draw';

export const DrawModal: React.FC<DrawModalProps> = ({
  isOpen,
  inkColor,
  onClose,
  onAddImageToPaper
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('upload');
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string>('');
  const [invertMatchInk, setInvertMatchInk] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [strokeWidth, setStrokeWidth] = useState<number>(2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setUploadedDataUrl(result);
        setUploadedName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFileUpload(file);
    }
  };

  const handleInsertUploaded = () => {
    if (!uploadedDataUrl) return;
    if (!invertMatchInk) {
      onAddImageToPaper(uploadedDataUrl);
      onClose();
      return;
    }

    // Optional: Convert dark strokes on white diagram into pen-ink-colored transparent PNG
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      // Parse inkColor hex
      const hex = inkColor.replace('#', '');
      const rInk = parseInt(hex.substring(0, 2), 16) || 26;
      const gInk = parseInt(hex.substring(2, 4), 16) || 47;
      const bInk = parseInt(hex.substring(4, 6), 16) || 125;

      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum > 235) {
          d[i + 3] = 0; // Make white background transparent
        } else {
          const darkness = Math.min(1, (255 - lum) / 180);
          d[i] = rInk;
          d[i + 1] = gInk;
          d[i + 2] = bInk;
          d[i + 3] = Math.round(darkness * d[i + 3]);
        }
      }
      ctx.putImageData(imgData, 0, 0);
      onAddImageToPaper(c.toDataURL('image/png'));
      onClose();
    };
    img.src = uploadedDataUrl;
  };

  const getCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDraw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    isDrawingRef.current = true;
    lastPosRef.current = getCoords(e);
  };

  const moveDraw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingRef.current || !lastPosRef.current || !canvasRef.current) {
      return;
    }
    const ctx = canvasRef.current.getContext('2d')!;
    const pos = getCoords(e);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  };

  const endDraw = () => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleAddSketchToPaper = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onAddImageToPaper(canvas.toDataURL('image/png'));
    onClose();
  };

  const handleDownloadSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d')!;
    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tCtx.drawImage(canvas, 0, 0);

    const a = document.createElement('a');
    a.href = tempCanvas.toDataURL('image/png');
    a.download = 'diagram-sketch.png';
    a.click();
  };

  return (
    <div className="diagram-modal-backdrop" onClick={onClose}>
      <div
        className="diagram-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="diagram-modal-header">
          <div className="diagram-modal-tabs">
            <button
              type="button"
              className={`diagram-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <i className="ph ph-image-square"></i>
              <span>Upload Diagram / Image</span>
            </button>
            <button
              type="button"
              className={`diagram-tab-btn ${activeTab === 'draw' ? 'active' : ''}`}
              onClick={() => setActiveTab('draw')}
            >
              <i className="ph ph-pencil-line"></i>
              <span>Freehand Sketch Pad</span>
            </button>
          </div>

          <button
            type="button"
            className="diagram-close-btn"
            onClick={onClose}
            aria-label="Close Modal"
          >
            <i className="ph ph-x"></i>
          </button>
        </div>

        {activeTab === 'upload' ? (
          <div className="diagram-modal-body">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />

            {!uploadedDataUrl ? (
              <div
                className="diagram-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="diagram-dropzone-icon">
                  <i className="ph ph-upload-simple"></i>
                </div>
                <div className="diagram-dropzone-title">
                  Click to choose a diagram or drag &amp; drop here
                </div>
                <div className="diagram-dropzone-sub">
                  Supports PNG, JPG, SVG, flowcharts, circuit diagrams, or screenshots
                </div>
              </div>
            ) : (
              <div className="diagram-preview-area">
                <img
                  src={uploadedDataUrl}
                  alt="Uploaded diagram preview"
                  className="diagram-preview-img"
                />
                <div className="diagram-preview-meta">
                  <span className="truncate">{uploadedName}</span>
                  <button
                    type="button"
                    className="notion-chip-btn danger"
                    onClick={() => {
                      setUploadedDataUrl(null);
                      setUploadedName('');
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            <div className="diagram-modal-footer">
              <label className="diagram-ink-blend-toggle">
                <input
                  type="checkbox"
                  checked={invertMatchInk}
                  onChange={(e) => setInvertMatchInk(e.target.checked)}
                />
                <span>Tint diagram lines to match active Pen Ink color</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="notion-chip-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <i className="ph ph-folder-open"></i>
                  <span>Browse File</span>
                </button>
                <button
                  type="button"
                  className="button imp-button"
                  disabled={!uploadedDataUrl}
                  onClick={handleInsertUploaded}
                >
                  <i className="ph ph-plus"></i>
                  <span>Insert into Sheet</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="diagram-modal-body">
            <div className="diagram-canvas-wrap">
              <canvas
                id="diagram-canvas"
                ref={canvasRef}
                width={560}
                height={300}
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={moveDraw}
                onTouchEnd={endDraw}
              />
            </div>

            <div className="diagram-modal-footer">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="notion-chip-btn"
                  onClick={() => setStrokeWidth((w) => (w === 2 ? 3.5 : 2))}
                >
                  <i className="ph ph-pen-nib"></i>
                  <span>Stroke: {strokeWidth === 2 ? 'Fine' : 'Bold'}</span>
                </button>
                <button
                  type="button"
                  className="notion-chip-btn danger"
                  onClick={clearCanvas}
                >
                  <i className="ph ph-trash"></i>
                  <span>Clear</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="notion-chip-btn"
                  onClick={handleDownloadSketch}
                >
                  <i className="ph ph-download-simple"></i>
                  <span>Save PNG</span>
                </button>
                <button
                  type="button"
                  className="button imp-button"
                  onClick={handleAddSketchToPaper}
                >
                  <i className="ph ph-plus"></i>
                  <span>Insert Sketch</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
