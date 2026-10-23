import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Eraser, PenLine } from 'lucide-react';

// ✅ Canvas-based imza pad — alıcı / satıcı imzaları için
// Parent ref ile: ref.current.toDataURL() ve ref.current.isEmpty() çağırabilir.
const SignaturePadComponent = forwardRef(({ label, testId, height = 140 }, ref) => {
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const containerRef = useRef(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    // ✅ Canvas'ı container genişliğine ölçekle (retina-aware)
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      ctx.scale(ratio, ratio);
      padRef.current?.clear();
      setEmpty(true);
    };

    padRef.current = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 0.7,
      maxWidth: 2.2,
    });
    padRef.current.addEventListener('endStroke', () => {
      setEmpty(padRef.current.isEmpty());
    });

    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      padRef.current?.off();
    };
  }, [height]);

  useImperativeHandle(ref, () => ({
    isEmpty: () => padRef.current?.isEmpty() ?? true,
    toDataURL: (type = 'image/png') => padRef.current?.toDataURL(type) || '',
    clear: () => { padRef.current?.clear(); setEmpty(true); },
  }), []);

  return (
    <div className="space-y-1.5" data-testid={`signature-block-${testId}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <PenLine size={12} className="text-primary" />
          {label}
        </label>
        <button
          type="button"
          onClick={() => padRef.current?.clear() || setEmpty(true)}
          className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
          data-testid={`signature-clear-${testId}`}
        >
          <Eraser size={11} />
          Temizle
        </button>
      </div>
      <div
        ref={containerRef}
        className={`relative rounded-lg border-2 transition-colors ${empty ? 'border-dashed border-muted-foreground/30' : 'border-solid border-primary/40'}`}
      >
        <canvas
          ref={canvasRef}
          className="block w-full rounded-md cursor-crosshair touch-none"
          data-testid={`signature-canvas-${testId}`}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground/70">
            Bu alana imzanızı atın
          </span>
        )}
      </div>
    </div>
  );
});

SignaturePadComponent.displayName = 'SignaturePadComponent';

export default SignaturePadComponent;
