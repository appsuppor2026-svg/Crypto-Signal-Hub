import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAlerts } from '@/context/AlertsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, BellOff, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import { SYMBOL_TO_COINGECKO } from '@/services/cryptoService';

interface PriceAlertsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PriceAlertsSheet({ open, onOpenChange }: PriceAlertsSheetProps) {
  const { alerts, addAlert, removeAlert } = useAlerts();
  const [symbol, setSymbol] = useState('BTC');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [priceStr, setPriceStr] = useState('');

  const handleAdd = () => {
    const p = parseFloat(priceStr);
    if (!isNaN(p) && p > 0) {
      addAlert({ symbol, condition, targetPrice: p });
      setPriceStr('');
    }
  };

  const assets = Object.keys(SYMBOL_TO_COINGECKO);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] bg-background border-t border-border flex flex-col sm:max-w-[430px] sm:mx-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 rounded-t-xl px-4 pb-6">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-mono text-xl">Alertas de Precio</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <BellOff className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">No tienes alertas configuradas</p>
            </div>
          ) : (
            alerts.slice().reverse().map(alert => (
              <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <Badge variant="secondary" className="font-mono">{alert.symbol}</Badge>
                    {alert.triggered && (
                      <Badge variant="default" className="bg-green-500/20 text-green-500 border-none">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Disparada
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm flex items-center text-muted-foreground">
                    {alert.condition === 'above' ? <ArrowUpRight className="w-4 h-4 mr-1 text-green-500" /> : <ArrowDownRight className="w-4 h-4 mr-1 text-red-500" />}
                    {alert.condition === 'above' ? 'Sube a' : 'Baja a'} <span className="font-mono font-medium text-foreground ml-1">${alert.targetPrice.toLocaleString()}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeAlert(alert.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="pt-4 border-t border-border space-y-4">
          <div className="flex gap-2">
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="w-[100px] font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assets.map(a => (
                  <SelectItem key={a} value={a} className="font-mono">{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex bg-muted rounded-md p-1">
              <Button
                variant={condition === 'above' ? 'default' : 'ghost'}
                size="sm"
                className={`flex-1 ${condition === 'above' ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' : ''}`}
                onClick={() => setCondition('above')}
              >
                Sube a ▲
              </Button>
              <Button
                variant={condition === 'below' ? 'default' : 'ghost'}
                size="sm"
                className={`flex-1 ${condition === 'below' ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : ''}`}
                onClick={() => setCondition('below')}
              >
                Baja a ▼
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                placeholder="Precio"
                className="pl-8 font-mono"
                value={priceStr}
                onChange={e => setPriceStr(e.target.value)}
              />
            </div>
            <Button onClick={handleAdd} disabled={!priceStr}>
              Añadir Alerta
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
