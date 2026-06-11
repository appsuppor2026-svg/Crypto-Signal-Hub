import { useState, useEffect } from "react";
import { useTranslation } from "@/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Plus, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPortfolio, savePortfolio, PortfolioEntry } from "@/services/portfolioService";
import { fetchCoinPrice, SYMBOL_TO_COINGECKO } from "@/services/cryptoService";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { SiBitcoin, SiEthereum, SiSolana, SiRipple, SiBinance, SiDogecoin } from "react-icons/si";

const ASSET_ICONS: Record<string, React.FC<any>> = {
  BTC: SiBitcoin, ETH: SiEthereum, SOL: SiSolana,
  XRP: SiRipple, BNB: SiBinance, DOGE: SiDogecoin
};

const ASSET_COLORS: Record<string, string> = {
  BTC: "#F7931A", ETH: "#627EEA", SOL: "#9945FF",
  XRP: "#00AAE4", BNB: "#F0B90B", DOGE: "#C2A633"
};

export default function Portfolio() {
  const { t } = useTranslation();
  const [holdings, setHoldings] = useState<PortfolioEntry[]>([]);
  const [prices, setPrices] = useState<Record<string, { price: number, change: number }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addSymbol, setAddSymbol] = useState("BTC");
  const [addAmount, setAddAmount] = useState("");

  useEffect(() => {
    const loaded = getPortfolio();
    setHoldings(loaded);
    loadPrices(loaded.map(h => h.symbol));
  }, []);

  const loadPrices = async (symbols: string[]) => {
    const uniqueSymbols = Array.from(new Set(symbols));
    for (const sym of uniqueSymbols) {
      const data = await fetchCoinPrice(sym);
      if (data) {
        setPrices(prev => ({ ...prev, [sym]: { price: data.usd, change: data.usd_24h_change } }));
      }
    }
  };

  const handleAdd = async () => {
    const amt = parseFloat(addAmount);
    if (!isNaN(amt) && amt > 0) {
      const currentPriceData = await fetchCoinPrice(addSymbol);
      const newHolding: PortfolioEntry = {
        symbol: addSymbol,
        amount: amt,
        entryPrice: currentPriceData?.usd || 0
      };
      const updated = [...holdings, newHolding];
      setHoldings(updated);
      savePortfolio(updated);
      setAddAmount("");
      setIsAdding(false);
      loadPrices([addSymbol]);
    }
  };

  const handleRemove = (index: number) => {
    const updated = holdings.filter((_, i) => i !== index);
    setHoldings(updated);
    savePortfolio(updated);
  };

  const totalValue = holdings.reduce((sum, h) => {
    const p = prices[h.symbol]?.price || h.entryPrice;
    return sum + h.amount * p;
  }, 0);

  const pieData = Object.entries(
    holdings.reduce((acc, h) => {
      const p = prices[h.symbol]?.price || h.entryPrice;
      const val = h.amount * p;
      acc[h.symbol] = (acc[h.symbol] || 0) + val;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);

  const availableAssets = Object.keys(SYMBOL_TO_COINGECKO);

  return (
    <div className="flex-1 p-4 pb-24 overflow-y-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-xl text-muted-foreground font-medium mb-1">Mi Portafolio</h1>
          <div className="text-4xl font-bold font-mono tracking-tighter">
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Chart */}
        {pieData.length > 0 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={ASSET_COLORS[entry.name] || "#8884d8"} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Valor']}
                  contentStyle={{ backgroundColor: '#000', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Holdings */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-lg font-bold">Activos</h2>
            <Button variant="ghost" size="sm" onClick={() => setIsAdding(!isAdding)} className="text-primary h-8 px-2">
              <Plus className="w-4 h-4 mr-1" /> Añadir
            </Button>
          </div>

          <AnimatePresence>
            {isAdding && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <Card className="bg-card/50 border-primary/20">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex gap-2">
                      <Select value={addSymbol} onValueChange={setAddSymbol}>
                        <SelectTrigger className="w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableAssets.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" placeholder="Cantidad" value={addAmount} onChange={e => setAddAmount(e.target.value)} className="flex-1" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>Cancelar</Button>
                      <Button className="flex-1" onClick={handleAdd} disabled={!addAmount}>Agregar</Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {holdings.length === 0 && !isAdding ? (
            <div className="text-center py-12 px-4 border border-dashed border-border rounded-xl">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground text-sm">Añade tus criptos para ver tu portafolio</p>
            </div>
          ) : (
            holdings.map((h, i) => {
              const p = prices[h.symbol];
              const currentPrice = p?.price || h.entryPrice;
              const val = h.amount * currentPrice;
              const isPos = (p?.change || 0) >= 0;
              const Icon = ASSET_ICONS[h.symbol] || Briefcase;

              return (
                <Card key={i} className="bg-card overflow-hidden">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted" style={{ color: ASSET_COLORS[h.symbol] }}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-base leading-none mb-1">{h.symbol}</div>
                        <div className="text-xs text-muted-foreground">{h.amount} {h.symbol}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono font-bold">${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        {p && (
                          <div className={`text-xs flex items-center justify-end ${isPos ? 'text-green-500' : 'text-red-500'}`}>
                            {isPos ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                            {Math.abs(p.change).toFixed(2)}%
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(i)} className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
