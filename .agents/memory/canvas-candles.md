---
name: Canvas candles fix
description: Why recharts Customized fails for candles and the working solution
---

**Rule:** Never use recharts `Customized` component to draw candle bodies/wicks. Use `CandleCanvas.tsx` instead.

**Why:** recharts `Customized` does not reliably pass `xAxisMap`/`yAxisMap` with working scale functions. Candles rendered via `Customized` appear invisible (coordinates resolve to undefined or wrong positions).

**How to apply:**
- Component: `artifacts/liquidity-radar/src/components/dashboard/CandleCanvas.tsx`
- Wrap the recharts chart div in `relative`, render `<CandleCanvas>` as an absolute overlay
- Props: `data`, `yMin`, `yMax`, `mt`/`mr`/`mb` (must match recharts margins + YAxis width), `showEMA`/`showBB`, `ema`/`bbUpper`/`bbLower`
- Canvas X scale: `(i + 0.5) * (plotWidth / n)` — matches recharts scaleBand with no padding
- Canvas Y scale: `mt + (1 - (price - yMin) / (yMax - yMin)) * plotHeight`
- Keep recharts chart for axes, grid, reference lines, tooltip (transparent `Line dataKey="close"` anchors tooltip hit-area)
- SQZ sub-panel: use recharts `Bar` + `Cell` (standard recharts, no Customized needed)
