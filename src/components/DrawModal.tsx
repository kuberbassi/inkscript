import React, { useEffect, useRef, useState } from 'react';

interface DrawModalProps {
  isOpen: boolean;
  inkColor: string;
  onClose: () => void;
  onAddImageToPaper: (dataUrl: string) => void;
}

export const DrawModal: React.FC<DrawModalProps> = ({
  isOpen,
  inkColor,
  onClose,
  onAddImageToPaper
}) => {
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
  }, [isOpen]);

  if (!isOpen) return null;

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

  const handleAddToPaper = () => {
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
    <section className="popup-container show">
      <div className="popup">
        <button
          type="button"
          className="close-button"
          onClick={onClose}
          aria-label="Close Draw Modal"
        >
          &times;
        </button>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <i className="ph-bold ph-pencil-line"></i> Freehand Diagram / Sketch Pad
          </h3>
          <canvas
            id="diagram-canvas"
            ref={canvasRef}
            width={600}
            height={340}
            style={{ backgroundColor: '#fff', border: '1px solid #333' }}
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={moveDraw}
            onTouchEnd={endDraw}
          />
          <div
            className="display-flex buttons-container"
            style={{
              justifyContent: 'center',
              gap: '10px',
              marginTop: '14px',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={() => setStrokeWidth((w) => (w === 2 ? 3.5 : 2))}
            >
              <i className="ph-bold ph-pen-nib"></i> Stroke:{' '}
              {strokeWidth === 2 ? 'Fine' : 'Bold'}
            </button>
            <button type="button" className="imp-button" onClick={handleAddToPaper}>
              <i className="ph-bold ph-plus"></i> Add to Sheet
            </button>
            <button type="button" onClick={handleDownloadSketch}>
              <i className="ph-bold ph-download-simple"></i> Download PNG
            </button>
            <button
              type="button"
              className="delete-button"
              onClick={clearCanvas}
            >
              <i className="ph-bold ph-trash"></i> Clear Canvas
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
