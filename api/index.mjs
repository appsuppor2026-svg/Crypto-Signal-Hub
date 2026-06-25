// Simple API for Liquidity Radar - no external dependencies except fetch

export default async function handler(req, res) {
  const path = req.url.split('?')[0];

  try {
    if (path === '/healthz' || path === '/api/healthz') {
      return res.status(200).json({ status: 'ok', time: new Date().toISOString() });
    }

    if (path === '/market/ticker' || path === '/api/market/ticker') {
      const symbol = req.query.symbol || 'BTC';
      const okxSymbol = `${symbol}-USDT`;
      
      const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${okxSymbol}`);
      const data = await response.json();
      
      if (data.data && data.data[0]) {
        const ticker = data.data[0];
        return res.status(200).json({
          symbol,
          price: parseFloat(ticker.last),
          change24h: parseFloat(ticker.change24h),
          changePercent24h: parseFloat(ticker.change24h) / parseFloat(ticker.open24h) * 100,
          high24h: parseFloat(ticker.high24h),
          low24h: parseFloat(ticker.low24h),
          volume24h: parseFloat(ticker.vol24h),
        });
      }
      return res.status(500).json({ error: 'No data from OKX' });
    }

    if (path === '/market/klines' || path === '/api/market/klines') {
      const symbol = req.query.symbol || 'BTC';
      const interval = req.query.interval || '1h';
      const okxSymbol = `${symbol}-USDT`;
      const limit = req.query.limit || 100;
      
      const okxInterval = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H', '1d': '1D' }[interval] || '1H';
      
      const response = await fetch(`https://www.okx.com/api/v5/market/candles?instId=${okxSymbol}&bar=${okxInterval}&limit=${limit}`);
      const data = await response.json();
      
      if (data.data) {
        const candles = data.data.map(c => ({
          timestamp: parseInt(c[0]),
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4]),
          volume: parseFloat(c[5]),
        })).reverse();
        return res.status(200).json({ symbol, interval, candles });
      }
      return res.status(500).json({ error: 'No data from OKX' });
    }

    if (path === '/ai/analyze' || path === '/api/ai/analyze') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      const { symbol, price } = req.body || {};
      if (!symbol || !price) {
        return res.status(400).json({ error: 'symbol and price required' });
      }
      return res.status(200).json({
        symbol,
        price,
        analysis: 'Market analysis would be generated here with OpenAI API',
        recommendation: 'Hold',
        timestamp: new Date().toISOString(),
      });
    }

    if (path === '/push/vapid-key' || path === '/api/push/vapid-key') {
      const key = process.env.VAPID_PUBLIC_KEY;
      if (!key) {
        return res.status(503).json({ error: 'Push notifications not configured' });
      }
      return res.status(200).json({ publicKey: key });
    }

    if (path === '/stripe/plans' || path === '/api/stripe/plans') {
      return res.status(200).json({ products: [], message: 'Stripe not configured' });
    }

    // Default - return API info
    return res.status(200).json({
      message: 'Liquidity Radar API',
      version: '1.0.0',
      routes: [
        '/healthz',
        '/market/ticker',
        '/market/klines',
        '/ai/analyze',
        '/push/vapid-key',
        '/stripe/plans'
      ]
    });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
