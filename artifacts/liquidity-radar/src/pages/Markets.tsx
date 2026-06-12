import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useAsset } from "@/context/AssetContext";
import { useAssetData } from "@/hooks/useAssetData";
import { fetchCoinPrice } from "@/services/cryptoService";
import { useToast } from "@/hooks/use-toast";
import {
  Swords, TrendingUp, TrendingDown, Trophy, Clock, History, ChevronDown, ChevronUp,
} from "lucide-react";

interface SimPosition {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  capital: number;
  leverage: number;
  liquidationPrice: number;
  openedAt: number;
}

interface ClosedTrade {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  closePrice: number;
  capital: number;
  leverage: number;
  finalPnL: number;
  finalPnLPct: number;
  openedAt: number;
  closedAt: number;
}

const STORAGE_POS = 'lr_sim_positions';
const STORAGE_HIST = 'lr_trade_history';

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function formatPrice(v: number): string {
  return v >= 1
    ? `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${v.toFixed(5)}`;
}

export default function Markets() {
  const { selectedAsset } = useAsset();
  const { assetData } = useAssetData(selectedAsset);
  const { toast } = useToast();

  const [positions, setPositions] = useState<SimPosition[]>([]);
  const [history, setHistory] = useState<ClosedTrade[]>([]);
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [capitalStr, setCapitalStr] = useState('100');
  const [leverage, setLeverage] = useState(10);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    try {
      const pos = localStorage.getItem(STORAGE_POS);
      if (pos) setPositions(JSON.parse(pos));
      const hist = localStorage.getItem(STORAGE_HIST);
      if (hist) setHistory(JSON.parse(hist));
    } catch {}
  }, []);

  useEffect(() => {
    if (assetData?.price) {
      setPrices(prev => ({ ...prev, [selectedAsset]: assetData.price }));
    }
  }, [assetData?.price, selectedAsset]);

  useEffect(() => {
    const pollOther = async () => {
      const symbols = [...new Set(positions.map(p => p.symbol).filter(s => s !== selectedAsset))];
      for (const sym of symbols) {
        const data = await fetchCoinPrice(sym);
        if (data) setPrices(prev => ({ ...prev, [sym]: data.usd }));
      }
    };
    if (positions.length > 0) {
      pollOther();
      const id = setInterval(pollOther, 30000);
      return () => clearInterval(id);
    }
    return undefined;
  }, [positions, selectedAsset]);

  const capital = parseFloat(capitalStr) || 0;
  const currentPrice = assetData?.price || 0;
  const liquidationPrice = direction === 'long'
    ? currentPrice * (1 - 1 / leverage)
    : currentPrice * (1 + 1 / leverage);
  const estimatedFee = capital * leverage * 0.0004;

  const savePositions = (pos: SimPosition[]) => {
    setPositions(pos);
    localStorage.setItem(STORAGE_POS, JSON.stringify(pos));
  };
  const saveHistory = (hist: ClosedTrade[]) => {
    setHistory(hist);
    localStorage.setItem(STORAGE_HIST, JSON.stringify(hist));
  };

  const calculatePnL = (pos: SimPosition): number => {
    const p = prices[pos.symbol] || pos.entryPrice;
    return pos.direction === 'long'
      ? ((p - pos.entryPrice) / pos.entryPrice) * pos.capital * pos.leverage
      : ((pos.entryPrice - p) / pos.entryPrice) * pos.capital * pos.leverage;
  };

  const handleOpen = () => {
    if (capital <= 0 || !currentPrice) return;
    const pos: SimPosition = {
      id: Math.random().toString(36).substring(7),
      symbol: selectedAsset,
      direction,
      entryPrice: currentPrice,
      capital,
      leverage,
      liquidationPrice,
      openedAt: Date.now(),
    };
    savePositions([...positions, pos]);
    setCapitalStr('100');
    toast({ title: '⚔️ Posición abierta', description: `${direction.toUpperCase()} ${leverage}x en ${selectedAsset}` });
  };

  const handleClose = (id: string) => {
    const pos = positions.find(p => p.id === id);
    if (!pos) return;
    const pnl = calculatePnL(pos);
    const pnlPct = (pnl / pos.capital) * 100;
    const closePrice = prices[pos.symbol] || pos.entryPrice;

    const trade: ClosedTrade = {
      id: pos.id,
      symbol: pos.symbol,
      direction: pos.direction,
      entryPrice: pos.entryPrice,
      closePrice,
      capital: pos.capital,
      leverage: pos.leverage,
      finalPnL: pnl,
      finalPnLPct: pnlPct,
      openedAt: pos.openedAt,
      closedAt: Date.now(),
    };

    savePositions(positions.filter(p => p.id !== id));
    saveHistory([trade, ...history].slice(0, 50));

    const isProfit = pnl >= 0;
    toast({
      title: isProfit ? '🏆 Posición cerrada con ganancia' : '💸 Posición cerrada con pérdida',
      description: `P&L final: ${isProfit ? '+' : ''}${formatPrice(pnl)} (${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`,
      variant: isProfit ? 'default' : 'destructive',
    });
  };

  const totalPnL = history.reduce((sum, t) => sum + t.finalPnL, 0);
  const wins = history.filter(t => t.finalPnL > 0).length;
  const winRate = history.length > 0 ? Math.round((wins / history.length) * 100) : 0;

  return (
    <div className="flex-1 pb-24 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Swords className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">CryptoArena</h1>
              <p className="text-[10px] text-muted-foreground">Simulador de Trading</p>
            </div>
          </div>
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-bold tracking-wider">
            SIN RIESGO REAL
          </Badge>
        </div>

        {/* Live price */}
        <div className="text-center py-2">
          <div className="text-xs font-mono text-muted-foreground">{selectedAsset}/USDT</div>
          <div className="text-4xl font-mono font-bold tracking-tighter my-1">
            {formatPrice(currentPrice)}
          </div>
          <div className={`text-sm font-bold ${(assetData?.change24h ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {(assetData?.change24h ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(assetData?.changePercent24h ?? 0).toFixed(2)}%
          </div>
        </div>

        {/* New position form */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <span>Nueva Posición</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {/* Direction toggle */}
            <div className="flex bg-muted rounded-xl p-1 gap-1">
              <Button
                variant="ghost"
                className={`flex-1 h-10 font-bold text-sm gap-1 rounded-lg ${direction === 'long' ? 'bg-green-500 hover:bg-green-600 text-white shadow-md shadow-green-500/20' : 'text-muted-foreground'}`}
                onClick={() => setDirection('long')}
              >
                <TrendingUp className="w-4 h-4" /> LONG
              </Button>
              <Button
                variant="ghost"
                className={`flex-1 h-10 font-bold text-sm gap-1 rounded-lg ${direction === 'short' ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20' : 'text-muted-foreground'}`}
                onClick={() => setDirection('short')}
              >
                <TrendingDown className="w-4 h-4" /> SHORT
              </Button>
            </div>

            {/* Capital */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Capital (USDT)</span>
                <span className="font-mono font-medium">${capital.toFixed(2)}</span>
              </div>
              <Input
                type="number"
                value={capitalStr}
                onChange={e => setCapitalStr(e.target.value)}
                className="font-mono text-base h-10"
              />
            </div>

            {/* Leverage */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Apalancamiento</span>
                <span className={`font-mono font-bold ${leverage >= 25 ? 'text-red-400' : leverage >= 10 ? 'text-amber-400' : 'text-green-400'}`}>
                  {leverage}x
                </span>
              </div>
              <Slider value={[leverage]} min={1} max={50} step={1} onValueChange={([v]) => setLeverage(v)} />
              <div className="flex gap-1.5">
                {[1, 5, 10, 25, 50].map(l => (
                  <Button
                    key={l}
                    variant="outline"
                    size="sm"
                    className={`flex-1 h-7 text-xs font-mono ${leverage === l ? 'border-primary text-primary bg-primary/10' : 'border-border/50'}`}
                    onClick={() => setLeverage(l)}
                  >
                    {l}x
                  </Button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-muted/40 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Posición total</span>
                <span className="font-mono font-medium">${(capital * leverage).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio de entrada</span>
                <span className="font-mono">{formatPrice(currentPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio liquidación</span>
                <span className="font-mono text-red-400">{formatPrice(liquidationPrice)}</span>
              </div>
              <div className="flex justify-between border-t border-border/30 pt-2">
                <span className="text-muted-foreground">Comisión est.</span>
                <span className="font-mono text-muted-foreground">${estimatedFee.toFixed(3)}</span>
              </div>
            </div>

            <Button
              className={`w-full h-12 text-base font-bold tracking-wide rounded-xl ${direction === 'long'
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20'
                : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
              }`}
              onClick={handleOpen}
              disabled={capital <= 0 || !currentPrice}
            >
              {direction === 'long' ? '⚔️ ABRIR LONG' : '⚔️ ABRIR SHORT'}
            </Button>
          </CardContent>
        </Card>

        {/* Open positions */}
        <div className="space-y-2">
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider px-1">
            Posiciones Abiertas ({positions.length})
          </h3>
          {positions.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-border/40 rounded-xl text-muted-foreground text-sm">
              <Swords className="w-8 h-8 mx-auto mb-2 opacity-20" />
              No tienes posiciones abiertas
            </div>
          ) : (
            positions.map(pos => {
              const pnl = calculatePnL(pos);
              const pnlPct = (pnl / pos.capital) * 100;
              const isProfit = pnl >= 0;
              const currentP = prices[pos.symbol] || pos.entryPrice;
              const isWarning = pnlPct <= -80;
              const duration = formatDuration(Date.now() - pos.openedAt);

              return (
                <motion.div key={pos.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={`bg-card ${isWarning ? 'border-red-500/50 shadow-[0_0_12px_0_rgba(239,68,68,0.3)]' : 'border-border'}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base font-mono">{pos.symbol}</span>
                          <Badge className={`text-[10px] font-bold ${pos.direction === 'long'
                            ? 'bg-green-500/15 text-green-400 border-green-500/30'
                            : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                            {pos.direction.toUpperCase()} {pos.leverage}x
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono font-bold text-lg ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                            {isProfit ? '+' : ''}{formatPrice(pnl)}
                          </div>
                          <div className={`font-mono text-xs ${isProfit ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 rounded-lg p-2.5">
                        <div>
                          <div className="text-muted-foreground mb-0.5">Entrada</div>
                          <div className="font-mono text-[11px]">{formatPrice(pos.entryPrice)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-0.5">Actual</div>
                          <div className="font-mono text-[11px]">{formatPrice(currentP)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-0.5">Duración</div>
                          <div className="font-mono text-[11px] flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />{duration}
                          </div>
                        </div>
                      </div>
                      {isWarning && (
                        <div className="text-[11px] text-red-400 font-bold text-center bg-red-500/10 rounded-lg py-1.5 animate-pulse">
                          ⚠️ Peligro de liquidación — cierra pronto
                        </div>
                      )}
                      <Button
                        variant="outline"
                        className="w-full h-8 text-sm font-medium"
                        onClick={() => handleClose(pos.id)}
                      >
                        Cerrar Posición
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Trade History */}
        <div className="space-y-2">
          <button
            className="w-full flex items-center justify-between px-1 py-1"
            onClick={() => setShowHistory(!showHistory)}
          >
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4" />
              Historial ({history.length})
            </h3>
            {showHistory ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {/* Stats summary */}
                {history.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-card border border-border rounded-xl p-3 text-center">
                      <div className="text-lg font-bold font-mono">{history.length}</div>
                      <div className="text-[10px] text-muted-foreground">Operaciones</div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3 text-center">
                      <div className={`text-lg font-bold font-mono ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {winRate}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">Win Rate</div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3 text-center">
                      <div className={`text-base font-bold font-mono ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalPnL >= 0 ? '+' : ''}{totalPnL >= 1 || totalPnL <= -1
                          ? `$${Math.abs(totalPnL).toFixed(0)}`
                          : formatPrice(totalPnL)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">P&L Total</div>
                    </div>
                  </div>
                )}

                {history.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border/40 rounded-xl text-muted-foreground text-sm">
                    <Trophy className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    Aún no has cerrado ninguna operación
                  </div>
                ) : (
                  history.map((trade) => {
                    const isProfit = trade.finalPnL >= 0;
                    const date = new Date(trade.closedAt).toLocaleDateString('es-ES', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    });
                    const duration = formatDuration(trade.closedAt - trade.openedAt);
                    return (
                      <div key={trade.id} className={`flex items-center justify-between p-3 rounded-xl border ${isProfit ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-sm">{trade.symbol}</span>
                            <Badge className={`text-[9px] font-bold px-1.5 py-0 ${trade.direction === 'long'
                              ? 'bg-green-500/15 text-green-400 border-green-500/30'
                              : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                              {trade.direction.toUpperCase()} {trade.leverage}x
                            </Badge>
                            {isProfit ? (
                              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {formatPrice(trade.entryPrice)} → {formatPrice(trade.closePrice)}
                            <span className="ml-2 opacity-60">{duration} · {date}</span>
                          </div>
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          <div className={`font-mono font-bold text-sm ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                            {isProfit ? '+' : ''}{formatPrice(trade.finalPnL)}
                          </div>
                          <div className={`font-mono text-[10px] ${isProfit ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            {trade.finalPnLPct > 0 ? '+' : ''}{trade.finalPnLPct.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {history.length > 0 && (
                  <button
                    className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground py-2 transition-colors"
                    onClick={() => {
                      if (confirm('¿Borrar todo el historial?')) {
                        saveHistory([]);
                        setShowHistory(false);
                      }
                    }}
                  >
                    Borrar historial
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </motion.div>
    </div>
  );
}
