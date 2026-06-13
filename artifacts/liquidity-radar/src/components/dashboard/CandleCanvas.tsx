/**
 * CandleCanvas — paints candles + indicator lines on a <canvas> absolutely
 * positioned over a recharts ComposedChart that provides axes / grid / tooltip.
 *
 * We compute the SAME scale recharts uses:
 *  - Y: linear [yMin..yMax], inverted (high price = low pixel)
 *  - X: scaleBand with no padding → each band = plotWidth / n, centre = left + (i+0.5)*bw
 *
 * marginRight should equal the recharts YAxis `width` prop.
 * marginBottom should approximate the XAxis tick height (≈ 28 px).
 */

import { useEffect, useRef, useCallback } from 'react';
import { OHLCPoint } from '@/services/cryptoService';

export interface CandleCanvasProps {
  data:    OHLCPoint[];
  yMin:    number;
  yMax:    number;
  /** Match recharts margin.top (default 8) */
  mt?: number;
  /** Match recharts YAxis width (default 54) */
  mr?: number;
  /** Approximate recharts XAxis height (default 28) */
  mb?: number;
  showEMA?:  boolean;
  showBB?:   boolean;
  ema?:      (number | null)[];
  bbUpper?:  (number | null)[];
  bbLower?:  (number | null)[];
}

export function CandleCanvas({
  data, yMin, yMax,
  mt = 8, mr = 54, mb = 28,
  showEMA = false, showBB  = false,
  ema = [], bbUpper = [], bbLower = [],
}: CandleCanvasProps) {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap || !data.length || yMax <= yMin) return;

    const { width: W, height: H } = wrap.getBoundingClientRect();
    if (W <= 0 || H <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const ml = 0;
    const pw = W - ml - mr;
    const ph = H - mt - mb;
    if (pw <= 0 || ph <= 0) return;

    // Scale helpers
    const toY = (price: number) => mt + (1 - (price - yMin) / (yMax - yMin)) * ph;
    const n   = data.length;
    const bw  = pw / n;
    const toX = (i: number) => ml + (i + 0.5) * bw;

    // ── Candle bodies + wicks ───────────────────────────────────────
    data.forEach((c, i) => {
      const x    = toX(i);
      const cw   = Math.max(bw * 0.62, 1.2);
      const isUp = c.close >= c.open;
      const col  = isUp ? '#22c55e' : '#ef4444';
      const bdr  = isUp ? '#16a34a' : '#dc2626';

      // Wick
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.9;
      ctx.moveTo(x, toY(c.high));
      ctx.lineTo(x, toY(c.low));
      ctx.stroke();

      // Body
      const bodyTop = toY(Math.max(c.open, c.close));
      const bodyH   = Math.max(toY(Math.min(c.open, c.close)) - bodyTop, 1.5);
      ctx.globalAlpha = 0.93;
      ctx.fillStyle   = col;
      ctx.fillRect(x - cw / 2, bodyTop, cw, bodyH);
      ctx.strokeStyle = bdr;
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(x - cw / 2, bodyTop, cw, bodyH);
    });

    // ── EMA line ────────────────────────────────────────────────────
    if (showEMA && ema.length) {
      ctx.beginPath();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth   = 1.8;
      ctx.globalAlpha = 0.95;
      ctx.setLineDash([]);
      let started = false;
      ema.forEach((v, i) => {
        if (v == null) { started = false; return; }
        const x = toX(i), y = toY(v);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // ── BB bands ────────────────────────────────────────────────────
    if (showBB && bbUpper.length) {
      const drawBand = (vals: (number | null)[]) => {
        ctx.beginPath();
        let s = false;
        vals.forEach((v, i) => {
          if (v == null) { s = false; return; }
          const x = toX(i), y = toY(v);
          if (!s) { ctx.moveTo(x, y); s = true; }
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      };
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth   = 1.2;
      ctx.globalAlpha = 0.72;
      ctx.setLineDash([4, 3]);
      drawBand(bbUpper);
      drawBand(bbLower);
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }, [data, yMin, yMax, mt, mr, mb, showEMA, showBB, ema, bbUpper, bbLower]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(el);
    return () => obs.disconnect();
  }, [draw]);

  return (
    <div ref={wrapRef} className="absolute inset-0 pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
