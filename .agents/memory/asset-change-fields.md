---
name: AssetData change fields
description: Distinction between change24h (USD) and changePercent24h (%) in AssetData
---

**Rule:** Use `changePercent24h` for any percentage display or score calculation. Use `change24h` only for absolute dollar-change display.

**Why:** `change24h` = absolute price change in USD (e.g. $1543 for BTC). `changePercent24h` = percentage (e.g. 2.41). Mixing them up shows values like "618.39%" instead of "2.41%".

**How to apply:**
- Display "▲ 2.41% 24h" → `changePercent24h`
- Bull/bear gauge score calculation → `changePercent24h`
- Chart stroke color (positive/negative) → `change24h >= 0` or `changePercent24h >= 0` (both have same sign)
- Absolute dollar change display → `change24h`
