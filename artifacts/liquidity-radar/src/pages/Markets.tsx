import { useState, useEffect } from "react";
import { useTranslation } from "@/i18n";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useAsset } from "@/context/AssetContext";
import { useAssetData } from "@/hooks/useAssetData";
import { fetchCoinPrice } from "@/services/cryptoService";
import { useToast } from "@/hooks/use-toast";
import { Activity, ArrowUpCircle, ArrowDownCircle, Trash2 } from "lucide-react";

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

export default function Markets() {
  const { t } = useTranslation();
  const { selectedAsset } = useAsset();
  const { assetData } = useAssetData(selectedAsset);
  const { toast } = useToast();

  const [positions, setPositions] = useState<SimPosition[]>([]);
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [capitalStr, setCapitalStr] = useState('100');
  const [leverage, setLeverage] = useState(10);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lr_sim_positions');
      if (saved) setPositions(JSON.parse(saved));
    } catch {}
  }, []);

  const savePositions = (pos: SimPosition[]) => {
    setPositions(pos);
    localStorage.setItem('lr_sim_positions', JSON.stringify(pos));
  };

  useEffect(() => {
    if (assetData?.price) {
      setPrices(prev => ({ ...prev, [selectedAsset]: assetData.price }));
    }
  }, [assetData?.price, selectedAsset]);

  useEffect(() => {
    const pollOtherPrices = async () => {
      const symbols = Array.from(new Set(positions.map(p => p.symbol).filter(s => s !== selectedAsset)));
      for (const sym of symbols) {
        const data = await fetchCoinPrice(sym);
        if (data) {
          setPrices(prev => ({ ...prev, [sym]: data.usd }));
        }
      }
    };
    if (positions.length > 0) {
      pollOtherPrices();
      const interval = setInterval(pollOtherPrices, 30000);
      return () => clearInterval(interval);
    }
  }, [positions, selectedAsset]);

  const capital = parseFloat(capitalStr) || 0;
  const currentPrice = assetData?.price || 0;
  
  const liquidationPrice = direction === 'long' 
    ? currentPrice * (1 - 1/leverage)
    : currentPrice * (1 + 1/leverage);
    
  const estimatedFee = (capital * leverage) * 0.0004;

  const handleOpen = () => {
    if (capital <= 0 || !currentPrice) return;
    
    const newPos: SimPosition = {
      id: Math.random().toString(36).substring(7),
      symbol: selectedAsset,
      direction,
      entryPrice: currentPrice,
      capital,
      leverage,
      liquidationPrice,
      openedAt: Date.now()
    };
    
    savePositions([...positions, newPos]);
    setCapitalStr('100');
    toast({ title: 'Posición abierta', description: `${direction.toUpperCase()} ${leverage}x en ${selectedAsset}` });
  };

  const handleClose = (id: string, pnl: number) => {
    savePositions(positions.filter(p => p.id !== id));
    const isProfit = pnl > 0;
    toast({ 
      title: 'Posición cerrada', 
      description: `P&L final: ${isProfit ? '+' : ''}$${pnl.toFixed(2)}`,
      variant: isProfit ? 'default' : 'destructive'
    });
  };

  const calculatePnL = (pos: SimPosition) => {
    const p = prices[pos.symbol] || pos.entryPrice;
    if (pos.direction === 'long') {
      return ((p - pos.entryPrice) / pos.entryPrice) * pos.capital * pos.leverage;
    } else {
      return ((pos.entryPrice - p) / pos.entryPrice) * pos.capital * pos.leverage;
    }
  };

  return (
    <div className="flex-1 p-4 pb-24 overflow-y-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        
        <div className="flex items-center justify-center space-x-2 bg-primary/10 text-primary py-2 px-4 rounded-full w-max mx-auto mb-2 text-sm font-bold tracking-widest border border-primary/20">
          <Activity className="w-4 h-4" />
          <span>MODO SIMULACIÓN</span>
        </div>

        <div className="text-center">
          <div className="text-sm font-mono text-muted-foreground">{selectedAsset}/USDT</div>
          <div className="text-4xl font-mono font-bold tracking-tighter my-1">
            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </div>
          <div className={`text-sm font-bold ${assetData?.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {assetData?.change24h >= 0 ? '+' : ''}{assetData?.changePercent24h?.toFixed(2)}%
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Nueva Posición</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex bg-muted rounded-lg p-1">
              <Button
                variant={direction === 'long' ? 'default' : 'ghost'}
                className={`flex-1 ${direction === 'long' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}`}
                onClick={() => setDirection('long')}
              >
                LONG ▲
              </Button>
              <Button
                variant={direction === 'short' ? 'default' : 'ghost'}
                className={`flex-1 ${direction === 'short' ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
                onClick={() => setDirection('short')}
              >
                SHORT ▼
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Capital (USDT)</span>
                <span className="font-mono">${capital.toFixed(2)}</span>
              </div>
              <Input
                type="number"
                value={capitalStr}
                onChange={e => setCapitalStr(e.target.value)}
                className="font-mono text-lg"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Apalancamiento</span>
                <span className="font-mono font-bold">{leverage}x</span>
              </div>
              <Slider
                value={[leverage]}
                min={1}
                max={50}
                step={1}
                onValueChange={([v]) => setLeverage(v)}
                className="my-4"
              />
              <div className="flex gap-2">
                {[1, 5, 10, 25, 50].map(l => (
                  <Button
                    key={l}
                    variant="outline"
                    size="sm"
                    className={`flex-1 h-7 text-xs ${leverage === l ? 'border-primary text-primary' : ''}`}
                    onClick={() => setLeverage(l)}
                  >
                    {l}x
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio de entrada</span>
                <span className="font-mono">${currentPrice.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio de liquidación</span>
                <span className="font-mono text-destructive">${liquidationPrice.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Comisión est. (0.04%)</span>
                <span className="font-mono">${estimatedFee.toFixed(2)}</span>
              </div>
            </div>

            <Button 
              className={`w-full text-lg font-bold h-12 ${direction === 'long' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
              onClick={handleOpen}
              disabled={capital <= 0 || !currentPrice}
            >
              ABRIR POSICIÓN
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="font-bold text-lg px-1">Posiciones Abiertas</h3>
          {positions.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
              No tienes posiciones abiertas
            </div>
          ) : (
            positions.map(pos => {
              const pnl = calculatePnL(pos);
              const pnlPct = (pnl / pos.capital) * 100;
              const isProfit = pnl >= 0;
              const p = prices[pos.symbol] || pos.entryPrice;
              const isWarning = pnlPct <= -90;

              return (
                <Card key={pos.id} className={`bg-card ${isWarning ? 'border-destructive shadow-[0_0_8px_0_rgba(239,68,68,0.5)]' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{pos.symbol}</span>
                        <Badge variant="outline" className={pos.direction === 'long' ? 'text-green-500 border-green-500/30 bg-green-500/10' : 'text-red-500 border-red-500/30 bg-red-500/10'}>
                          {pos.direction.toUpperCase()} {pos.leverage}x
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className={`font-mono font-bold text-lg ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                          {isProfit ? '+' : ''}${pnl.toFixed(2)}
                        </div>
                        <div className={`font-mono text-xs ${isProfit ? 'text-green-500/80' : 'text-red-500/80'}`}>
                          {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-2 rounded">
                      <div>
                        <div className="text-muted-foreground text-xs">Entrada</div>
                        <div className="font-mono">${pos.entryPrice.toFixed(4)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Actual</div>
                        <div className="font-mono">${p.toFixed(4)}</div>
                      </div>
                    </div>
                    
                    {isWarning && (
                      <div className="text-xs text-destructive font-bold text-center bg-destructive/10 p-1 rounded">
                        ⚠️ Peligro de liquidación
                      </div>
                    )}

                    <Button variant="outline" className="w-full h-8" onClick={() => handleClose(pos.id, pnl)}>
                      Cerrar Posición
                    </Button>
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
