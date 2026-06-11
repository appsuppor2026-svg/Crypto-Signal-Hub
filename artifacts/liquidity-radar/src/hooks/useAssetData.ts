import { useState, useEffect, useRef, useCallback } from 'react';
import { AssetData } from '@/types';
import { mockAssets } from '@/data/mockData';
import {
  fetchCoinPrice,
  fetchChartData,
  SYMBOL_TO_KRAKEN,
} from '@/services/cryptoService';
import { computeZones } from '@/services/liquidityZones';
import { useAlerts } from '@/context/AlertsContext';

export type DataStatus = 'loading' | 'live' | 'polling' | 'mock';

export function useAssetData(symbol: string) {
  const [assetData, setAssetData] = useState<AssetData>(() => mockAssets[symbol] ?? mockAssets['BTC']);
  const [status, setStatus] = useState<DataStatus>('loading');
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const { checkAlerts } = useAlerts();

  const applyPrice = useCallback(
    (price: number, change24h: number, changePercent24h: number) => {
      setAssetData((prev) => ({
        ...prev,
        price,
        change24h,
        changePercent24h,
        ...computeZones(prev.symbol, price),
      }));
      checkAlerts(symbol, price);
    },
    [checkAlerts, symbol]
  );

  // Initial fetch: price + chart from CoinGecko
  useEffect(() => {
    mountedRef.current = true;
    setStatus('loading');

    const mock = mockAssets[symbol] ?? mockAssets['BTC'];
    setAssetData(mock);

    let priceResult: { price: number; change: number; changePct: number } | null = null;
    let chartResult: AssetData['chartData'] = [];
    let priceLoaded = false;
    let chartLoaded = false;

    const tryApply = () => {
      if (!mountedRef.current || !priceLoaded || !chartLoaded) return;
      if (priceResult) {
        const zones = computeZones(symbol, priceResult.price);
        setAssetData((prev) => ({
          ...prev,
          price: priceResult!.price,
          change24h: priceResult!.change,
          changePercent24h: priceResult!.changePct,
          chartData: chartResult.length > 0 ? chartResult : prev.chartData,
          ...zones,
        }));
        setStatus('polling');
      } else {
        setStatus('mock');
      }
    };

    fetchCoinPrice(symbol).then((coin) => {
      if (!mountedRef.current) return;
      if (coin) {
        const prevPrice = coin.usd / (1 + coin.usd_24h_change / 100);
        priceResult = {
          price: coin.usd,
          change: coin.usd - prevPrice,
          changePct: coin.usd_24h_change,
        };
      }
      priceLoaded = true;
      tryApply();
    });

    fetchChartData(symbol).then((points) => {
      if (!mountedRef.current) return;
      chartResult = points;
      chartLoaded = true;
      tryApply();
    });

    return () => {
      mountedRef.current = false;
    };
  }, [symbol]);

  // Kraken WebSocket for real-time price streaming
  useEffect(() => {
    const krakenPair = SYMBOL_TO_KRAKEN[symbol];
    if (!krakenPair) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        const ws = new WebSocket('wss://ws.kraken.com/v2');
        wsRef.current = ws;

        ws.onopen = () => {
          if (closed) { ws.close(); return; }
          ws.send(JSON.stringify({
            method: 'subscribe',
            params: { channel: 'ticker', symbol: [krakenPair] },
          }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.channel === 'ticker' && Array.isArray(msg.data) && msg.data.length > 0) {
              const tick = msg.data[0];
              const price = tick.last ?? tick.last_trade ?? null;
              const change24hPct = tick.change_pct ?? null;
              if (price !== null && !isNaN(price)) {
                const change = change24hPct !== null
                  ? (price / (1 + change24hPct / 100)) * (change24hPct / 100)
                  : 0;
                applyPrice(price, change, change24hPct ?? 0);
                setStatus('live');
              }
            }
          } catch {
            // ignore malformed messages
          }
        };

        ws.onerror = () => { ws.close(); };

        ws.onclose = () => {
          wsRef.current = null;
          if (!closed) reconnectTimer = setTimeout(connect, 5000);
        };
      } catch {
        // WebSocket constructor failed
      }
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [symbol, applyPrice]);

  // CoinGecko polling every 30s as fallback when WS is not live
  useEffect(() => {
    const poll = async () => {
      if (status === 'live') return;
      const coin = await fetchCoinPrice(symbol);
      if (coin) {
        const prevPrice = coin.usd / (1 + coin.usd_24h_change / 100);
        applyPrice(coin.usd, coin.usd - prevPrice, coin.usd_24h_change);
        setStatus((s) => (s === 'mock' ? 'polling' : s));
      }
    };

    pollRef.current = setInterval(poll, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [symbol, status, applyPrice]);

  return { assetData, status };
}
