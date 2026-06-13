---
name: OKX klines proxy
description: Why OKX is used for OHLCV data and how the proxy works
---

**Rule:** Always use OKX via the server-side proxy at `/api/market/klines`. Never call Binance or CoinGecko OHLC endpoints from this project.

**Why:** Binance returns 451 (geo-block) from Replit IPs. CoinGecko Pro OHLC returns 401 (requires paid key). CryptoCompare requires key. OKX has no key requirement and doesn't block Replit.

**How to apply:**
- Endpoint: `GET /api/market/klines?symbol=BTC&interval=1h&limit=60`
- Server file: `artifacts/api-server/src/routes/market.ts`
- OKX format: `[ts_ms, open, high, low, close, vol, ...]` newest-first → reversed to ascending
- Response shape: Binance-compatible `[openTime_ms, open, high, low, close, volume]`
- TTL cache: 60s server-side (Map), 2-10min client-side per timeframe
- OKX bar params: `1m 5m 15m 30m 1H 4H 1D 1W` (hours/days uppercase)
- Symbol format: `BTC-USDT`, `ETH-USDT`, etc.
