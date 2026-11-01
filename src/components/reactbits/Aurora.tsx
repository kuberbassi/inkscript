'use client';

import React, { useEffect, useRef, type CSSProperties } from 'react';

export interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  speed?: number;
  height?: number;
  opacity?: number;
  lightMode?: boolean;
  mouseInteraction?: boolean;
  className?: string;
  style?: CSSProperties;
}

const Aurora: React.FC<AuroraProps> = ({
  colorStops = ['#3b82f6', '#6366f1', '#1d4ed8'],
  amplitude = 0.85,
  blend = 0.55,
  speed = 0.75,
  height = 0.55,
  opacity = 0.38,
  lightMode = false,
  mouseInteraction = true,
  className = '',
  style
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.25, targetX: 0.5, targetY: 0.25 });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let raf = 0;
    let clock = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!mouseInteraction) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerRef.current.targetX = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      pointerRef.current.targetY = Math.max(
        0,
        Math.min(1, (e.clientY - rect.top) / rect.height)
      );
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      clock += dt * speed;

      const p = pointerRef.current;
      p.x += (p.targetX - p.x) * 0.04;
      p.y += (p.targetY - p.y) * 0.04;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const stops =
        colorStops && colorStops.length >= 2
          ? colorStops
          : lightMode
            ? ['#09090b', '#18181b', '#27272a']
            : ['#1d4ed8', '#4f46e5', '#0ea5e9'];

      ctx.save();
      ctx.globalAlpha = opacity;

      // Draw 3 smooth organic flowing aurora ribbons across the top margin
      for (let i = 0; i < 3; i++) {
        const stopColor = lightMode
          ? i === 0
            ? '#09090b'
            : i === 1
              ? '#18181b'
              : '#27272a'
          : stops[i % stops.length];

        const phase = clock * (0.7 + i * 0.22) + i * 2.1;
        const centerX =
          W * (0.22 + i * 0.28 + Math.sin(phase) * 0.14 * amplitude) +
          (p.x - 0.5) * W * 0.18;
        const centerY =
          H * (0.1 + i * 0.08 + Math.cos(phase * 0.8) * 0.08 * amplitude);
        const radiusX = W * (0.42 + blend * 0.22);
        const radiusY = H * (height * (0.75 + i * 0.15));

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(1, radiusY / Math.max(1, radiusX));

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
        grad.addColorStop(0, stopColor);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    resize();
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [colorStops, amplitude, blend, speed, height, opacity, lightMode, mouseInteraction]);

  return (
    <div
      ref={containerRef}
      className={['relative h-full w-full overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        aria-hidden="true"
      />
    </div>
  );
};

export default Aurora;
