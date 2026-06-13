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
  Swords, TrendingUp, TrendingDown, Trophy, Clock, History,
  ChevronDown, ChevronUp, Wallet, CalendarDays,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
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

type HistoryFilter = 'today' | 'week' | 'month' | 'all';

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_POS   = 'lr_sim_positions';
const STORAGE_HIST  = 'lr_trade_history';
const STORAGE_BAL   = 'lr_usdldr_balance';
const INITIAL_BAL   = 10_000;

// ── Utils ─────────────────────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function formatLDR(v: number): string {
  return `${v >= 0 ? '' : '-'}${Math.abs(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDLDR`;
}

function formatPrice(v: number): string {
  return v >= 1
    ? `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${v.toFixed(5)}`;
}

function filterPeriodStart(filter: HistoryFilter): number {
  const now = Date.now();
  if (filter === 'today') {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  }
  if (filter === 'week') return now - 7 * 24 * 3600 * 1000;
  if (filter === 'month') return now - 30 * 24 * 3600 * 1000;
  return 0;
}

const FILTER_LABELS: Record<HistoryFilter, string> = {
  today: 'Hoy', week: 'Semana', month: 'Mes', all: 'Todo',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Markets() {
  const { selectedAsset } = useAsset();
  const { assetData } = useAssetData(selectedAsset);
  const { toast } = useToast();

  const [positions, setPositions] = useState<SimPosition[]>([]);
  const [history, setHistory]     = useState<ClosedTrade[]>([]);
  const [balance, setBalance]     = useState(INITIAL_BAL);

  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [capitalStr, setCapitalStr] = useState('100');
  const [leverage, setLeverage]   = useState(10);
  const [prices, setPrices]       = useState<Record<string, number>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [histFilter, setHistFilter] = useState<HistoryFilter>('all');

  // Load from localStorage
  useEffect(() => {
    try {
      const pos  = localStorage.getItem(STORAGE_POS);  if (pos)  setPositions(JSON.parse(pos));
      const hist = localStorage.getItem(STORAGE_HIST); if (hist) setHistory(JSON.parse(hist));
      const bal  = localStorage.getItem(STORAGE_BAL);
      setBalance(bal !== null ? parseFloat(bal) : INITIAL_BAL);
    } catch {}
  }, []);

  // Sync live price
  useEffect(() => {
    if (assetData?.price) {
      setPrices(prev => ({ ...prev, [selectedAsset]: assetData.price }));
    }
  }, [assetData?.price, selectedAsset]);

  // Poll prices for other open positions
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
      const id = setInterval(pollOther, 30_000);
      return () => clearInterval(id);
    }
    return undefined;
  }, [positions, selectedAsset]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const capital = parseFloat(capitalStr) || 0;
  const currentPrice = assetData?.price || 0;
  const liquidationPrice = direction === 'long'
    ? currentPrice * (1 - 1 / leverage)
    : currentPrice * (1 + 1 / leverage);
  const estimatedFee = capital * leverage * 0.0004;

  // Reserved capital in open positions
  const reservedCapital = positions.reduce((s, p) => s + p.capital, 0);
  const availableBalance = balance - reservedCapital;

  // ── Persist helpers ────────────────────────────────────────────────────────
  const savePositions = (pos: SimPosition[]) => {
    setPositions(pos); localStorage.setItem(STORAGE_POS, JSON.stringify(pos));
  };
  const saveHistory = (hist: ClosedTrade[]) => {
    setHistory(hist); localStorage.setItem(STORAGE_HIST, JSON.stringify(hist));
  };
  const saveBalance = (b: number) => {
    const capped = Math.max(0, b);
    setBalance(capped); localStorage.setItem(STORAGE_BAL, String(capped));
  };

  const calculatePnL = (pos: SimPosition): number => {
    const p = prices[pos.symbol] || pos.entryPrice;
    return pos.direction === 'long'
      ? ((p - pos.entryPrice) / pos.entryPrice) * pos.capital * pos.leverage
      : ((pos.entryPrice - p) / pos.entryPrice) * pos.capital * pos.leverage;
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleOpen = () => {
    if (capital <= 0 || !currentPrice) return;
    if (capital > availableBalance) {
      toast({
        title: 'Saldo insuficiente',
        description: `Disponible: ${formatLDR(availableBalance)}`,
        variant: 'destructive',
      });
      return;
    }
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
    toast({ title: '⚔️ Posición abierta', description: `${direction.toUpperCase()} ${leverage}x en ${selectedAsset} · −${capital.toFixed(2)} USDLDR reservados` });
  };

  const handleClose = (id: string) => {
    const pos = positions.find(p => p.id === id);
    if (!pos) return;
    const pnl = calculatePnL(pos);
    const pnlPct = (pnl / pos.capital) * 100;
    const closePrice = prices[pos.symbol] || pos.entryPrice;

    const trade: ClosedTrade = {
      id: pos.id, symbol: pos.symbol, direction: pos.direction,
      entryPrice: pos.entryPrice, closePrice,
      capital: pos.capital, leverage: pos.leverage,
      finalPnL: pnl, finalPnLPct: pnlPct,
      openedAt: pos.openedAt, closedAt: Date.now(),
    };

    // Return capital + PnL to balance
    const newBalance = balance + pnl;
    saveBalance(newBalance);
    savePositions(positions.filter(p => p.id !== id));
    saveHistory([trade, ...history].slice(0, 100));

    const isProfit = pnl >= 0;
    toast({
      title: isProfit ? '🏆 Ganancia' : '💸 Pérdida',
      description: `P&L: ${isProfit ? '+' : ''}${pnl.toFixed(2)} USDLDR · Saldo: ${newBalance.toFixed(2)} USDLDR`,
      variant: isProfit ? 'default' : 'destructive',
    });
  };

  const handleReset = () => {
    if (!confirm('¿Resetear saldo a 10.000 USDLDR y borrar historial?')) return;
    savePositions([]);
    saveHistory([]);
    saveBalance(INITIAL_BAL);
    toast({ title: '🔄 Cuenta reseteada', description: 'Saldo restaurado a 10.000 USDLDR' });
  };

  // ── History filtering ──────────────────────────────────────────────────────
  const periodStart = filterPeriodStart(histFilter);
  const filteredHistory = history.filter(t => t.closedAt >= periodStart);
  const totalPnL   = filteredHistory.reduce((s, t) => s + t.finalPnL, 0);
  const wins       = filteredHistory.filter(t => t.finalPnL > 0).length;
  const winRate    = filteredHistory.length > 0 ? Math.round((wins / filteredHistory.length) * 100) : 0;

  // Global stats for all-time
  const allTimePnL = history.reduce((s, t) => s + t.finalPnL, 0);

  // Balance color
  const balanceColor = balance >= INITIAL_BAL ? 'text-green-400' : balance >= INITIAL_BAL * 0.5 ? 'text-amber-400' : 'text-red-400';

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
              <p className="text-[10px] text-muted-foreground">Simulador · Liquidity Radar Crypto</p>
            </div>
          </div>
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-bold tracking-wider">
            SIN RIESGO REAL
          </Badge>
        </div>

        {/* Wallet card */}
        <Card className="bg-gradient-to-br from-primary/5 to-cyan-500/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cuenta USDLDR</span>
              </div>
              <button onClick={handleReset} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                Resetear
              </button>
            </div>
            <div className={`text-3xl font-mono font-bold tracking-tight ${balanceColor}`}>
              {balance.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-base ml-1 font-semibold opacity-70">USDLDR</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground mb-0.5">Disponible</div>
                <div className="font-mono font-medium text-foreground">{availableBalance.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-0.5">Reservado</div>
                <div className="font-mono font-medium text-amber-400">{reservedCapital.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-0.5">P&L Total</div>
                <div className={`font-mono font-medium ${allTimePnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {allTimePnL >= 0 ? '+' : ''}{allTimePnL.toFixed(2)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live price */}
        <div className="text-center py-2">
          <div className="text-xs font-mono text-muted-foreground">{selectedAsset}/USD</div>
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
            <CardTitle className="text-base">Nueva Posición</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {/* Direction */}
            <div className="flex bg-muted rounded-xl p-1 gap-1">
              {(['long', 'short'] as const).map(d => (
                <Button key={d} variant="ghost"
                  className={`flex-1 h-10 font-bold text-sm gap-1 rounded-lg ${direction === d
                    ? d === 'long' ? 'bg-green-500 hover:bg-green-600 text-white shadow-md shadow-green-500/20'
                      : 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20'
                    : 'text-muted-foreground'}`}
                  onClick={() => setDirection(d)}>
                  {d === 'long' ? <><TrendingUp className="w-4 h-4" /> LONG</> : <><TrendingDown className="w-4 h-4" /> SHORT</>}
                </Button>
              ))}
            </div>

            {/* Capital */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Capital (USDLDR)</span>
                <span className="font-mono font-medium text-muted-foreground">
                  Disponible: {availableBalance.toFixed(2)}
                </span>
              </div>
              <Input
                type="number"
                value={capitalStr}
                onChange={e => setCapitalStr(e.target.value)}
                className={`font-mono text-base h-10 ${capital > availableBalance ? 'border-red-500/50 focus-visible:ring-red-500/30' : ''}`}
                min={1} max={availableBalance}
              />
              {/* Quick % buttons */}
              <div className="flex gap-1">
                {[25, 50, 75, 100].map(pct => (
                  <Button key={pct} variant="outline" size="sm"
                    className="flex-1 h-7 text-[10px] border-border/50"
                    onClick={() => setCapitalStr((availableBalance * pct / 100).toFixed(2))}>
                    {pct}%
                  </Button>
                ))}
              </div>
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
                  <Button key={l} variant="outline" size="sm"
                    className={`flex-1 h-7 text-xs font-mono ${leverage === l ? 'border-primary text-primary bg-primary/10' : 'border-border/50'}`}
                    onClick={() => setLeverage(l)}>
                    {l}x
                  </Button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-muted/40 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Posición total</span>
                <span className="font-mono font-medium">{(capital * leverage).toFixed(2)} USDLDR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio entrada</span>
                <span className="font-mono">{formatPrice(currentPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Liquidación</span>
                <span className="font-mono text-red-400">{formatPrice(liquidationPrice)}</span>
              </div>
              <div className="flex justify-between border-t border-border/30 pt-2">
                <span className="text-muted-foreground">Comisión est.</span>
                <span className="font-mono text-muted-foreground">{estimatedFee.toFixed(3)} USDLDR</span>
              </div>
            </div>

            <Button
              className={`w-full h-12 text-base font-bold tracking-wide rounded-xl ${direction === 'long'
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20'
                : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'}`}
              onClick={handleOpen}
              disabled={capital <= 0 || capital > availableBalance || !currentPrice || balance <= 0}
            >
              {balance <= 0 ? '⛔ SALDO AGOTADO'
                : capital > availableBalance ? '⚠️ SALDO INSUFICIENTE'
                : direction === 'long' ? '⚔️ ABRIR LONG' : '⚔️ ABRIR SHORT'}
            </Button>

            {balance <= 0 && (
              <button onClick={handleReset} className="w-full text-xs text-primary hover:underline py-1">
                Resetear cuenta a 10.000 USDLDR
              </button>
            )}
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
          ) : positions.map(pos => {
            const pnl = calculatePnL(pos);
            const pnlPct = (pnl / pos.capital) * 100;
            const isProfit = pnl >= 0;
            const currentP = prices[pos.symbol] || pos.entryPrice;
            const isWarning = pnlPct <= -80;

            return (
              <motion.div key={pos.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={`bg-card ${isWarning ? 'border-red-500/50 shadow-[0_0_12px_0_rgba(239,68,68,0.3)]' : 'border-border'}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base font-mono">{pos.symbol}</span>
                        <Badge className={`text-[10px] font-bold ${pos.direction === 'long' ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                          {pos.direction.toUpperCase()} {pos.leverage}x
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className={`font-mono font-bold text-lg ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                          {isProfit ? '+' : ''}{pnl.toFixed(2)} <span className="text-xs font-normal">LDR</span>
                        </div>
                        <div className={`font-mono text-xs ${isProfit ? 'text-green-400/70' : 'text-red-400/70'}`}>
                          {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 rounded-lg p-2.5">
                      <div><div className="text-muted-foreground mb-0.5">Entrada</div><div className="font-mono text-[11px]">{formatPrice(pos.entryPrice)}</div></div>
                      <div><div className="text-muted-foreground mb-0.5">Actual</div><div className="font-mono text-[11px]">{formatPrice(currentP)}</div></div>
                      <div><div className="text-muted-foreground mb-0.5">Duración</div><div className="font-mono text-[11px] flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatDuration(Date.now() - pos.openedAt)}</div></div>
                    </div>
                    {isWarning && (
                      <div className="text-[11px] text-red-400 font-bold text-center bg-red-500/10 rounded-lg py-1.5 animate-pulse">
                        ⚠️ Peligro de liquidación — cierra pronto
                      </div>
                    )}
                    <Button variant="outline" className="w-full h-8 text-sm font-medium" onClick={() => handleClose(pos.id)}>
                      Cerrar Posición
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Trade History */}
        <div className="space-y-2">
          <button className="w-full flex items-center justify-between px-1 py-1" onClick={() => setShowHistory(!showHistory)}>
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4" />
              Historial ({filteredHistory.length}{histFilter !== 'all' ? ` / ${history.length}` : ''})
            </h3>
            {showHistory ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">

                {/* Filter bar */}
                <div className="flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {(Object.keys(FILTER_LABELS) as HistoryFilter[]).map(f => (
                    <Button key={f} variant="ghost" size="sm"
                      className={`h-7 px-3 text-xs flex-1 ${histFilter === f ? 'bg-primary/15 text-primary font-bold border border-primary/20' : 'text-muted-foreground'}`}
                      onClick={() => setHistFilter(f)}>
                      {FILTER_LABELS[f]}
                    </Button>
                  ))}
                </div>

                {/* Stats for selected period */}
                {filteredHistory.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-card border border-border rounded-xl p-3 text-center">
                      <div className="text-lg font-bold font-mono">{filteredHistory.length}</div>
                      <div className="text-[10px] text-muted-foreground">Ops.</div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3 text-center">
                      <div className={`text-lg font-bold font-mono ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{winRate}%</div>
                      <div className="text-[10px] text-muted-foreground">Win Rate</div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3 text-center">
                      <div className={`text-sm font-bold font-mono ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(0)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">P&L LDR</div>
                    </div>
                  </div>
                )}

                {filteredHistory.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border/40 rounded-xl text-muted-foreground text-sm">
                    <Trophy className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    {histFilter === 'all' ? 'Aún no has cerrado operaciones' : `Sin operaciones en ${FILTER_LABELS[histFilter].toLowerCase()}`}
                  </div>
                ) : (
                  filteredHistory.map((trade) => {
                    const isProfit = trade.finalPnL >= 0;
                    const date = new Date(trade.closedAt).toLocaleDateString('es-ES', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    });
                    const dur = formatDuration(trade.closedAt - trade.openedAt);
                    return (
                      <div key={trade.id} className={`flex items-center justify-between p-3 rounded-xl border ${isProfit ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-sm">{trade.symbol}</span>
                            <Badge className={`text-[9px] font-bold px-1.5 py-0 ${trade.direction === 'long' ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                              {trade.direction.toUpperCase()} {trade.leverage}x
                            </Badge>
                            {isProfit ? <TrendingUp className="w-3.5 h-3.5 text-green-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {formatPrice(trade.entryPrice)} → {formatPrice(trade.closePrice)}
                            <span className="ml-2 opacity-60">{dur} · {date}</span>
                          </div>
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          <div className={`font-mono font-bold text-sm ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                            {isProfit ? '+' : ''}{trade.finalPnL.toFixed(2)}
                          </div>
                          <div className={`font-mono text-[10px] opacity-70 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
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
                    onClick={() => { if (confirm('¿Borrar todo el historial?')) { saveHistory([]); setShowHistory(false); } }}>
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
