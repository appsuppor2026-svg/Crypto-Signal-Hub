import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAlerts } from '@/context/AlertsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, BellOff, ArrowUpRight, ArrowDownRight, CheckCircle2, Bell, BellRing } from 'lucide-react';
import { SYMBOL_TO_COINGECKO } from '@/services/cryptoService';

interface PriceAlertsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PriceAlertsSheet({ open, onOpenChange }: PriceAlertsSheetProps) {
  const { alerts, addAlert, removeAlert, notificationPermission, requestPermission } = useAlerts();
  const [symbol, setSymbol] = useState('BTC');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [priceStr, setPriceStr] = useState('');
  const [requesting, setRequesting] = useState(false);

  const handleAdd = () => {
    const p = parseFloat(priceStr);
    if (!isNaN(p) && p > 0) {
      addAlert({ symbol, condition, targetPrice: p });
      setPriceStr('');
    }
  };

  const handleRequestPermission = async () => {
    setRequesting(true);
    await requestPermission();
    setRequesting(false);
  };

  const assets = Object.keys(SYMBOL_TO_COINGECKO);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] bg-background border-t border-border flex flex-col sm:max-w-[430px] sm:mx-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 rounded-t-xl px-4 pb-6">
        <SheetHeader className="mb-3">
          <SheetTitle className="font-mono text-xl flex items-center gap-2">
            <BellRing className="w-5 h-5 text-primary" />
            Alertas de Precio
          </SheetTitle>
        </SheetHeader>

        {notificationPermission !== 'granted' && (
          <div className={`mb-3 rounded-xl p-3 border flex items-start gap-3 ${
            notificationPermission === 'denied'
              ? 'bg-destructive/10 border-destructive/30'
              : 'bg-primary/10 border-primary/30'
          }`}>
            <Bell className={`w-5 h-5 mt-0.5 shrink-0 ${notificationPermission === 'denied' ? 'text-destructive' : 'text-primary'}`} />
            <div className="flex-1 min-w-0">
              {notificationPermission === 'denied' ? (
                <>
                  <p className="text-xs font-semibold text-destructive">Notificaciones bloqueadas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Habilita las notificaciones en la configuración de tu navegador para recibir alertas en segundo plano.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-primary">Activa las notificaciones push</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Recibe alertas de precio aunque tengas la app en segundo plano.
                  </p>
                  <Button
                    size="sm"
                    className="mt-2 h-7 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"
                    onClick={handleRequestPermission}
                    disabled={requesting}
                  >
                    {requesting ? 'Solicitando...' : '🔔 Activar notificaciones'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {notificationPermission === 'granted' && (
          <div className="mb-3 rounded-xl p-2.5 border border-green-500/20 bg-green-500/5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xs text-green-500 font-medium">
              Notificaciones push activas — te avisamos en segundo plano
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <BellOff className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">No tienes alertas configuradas</p>
              <p className="text-xs opacity-60 mt-1">Añade una alerta abajo</p>
            </div>
          ) : (
            alerts.slice().reverse().map(alert => (
              <div
                key={alert.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  alert.triggered
                    ? 'border-green-500/20 bg-green-500/5'
                    : 'border-border/50 bg-card'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <Badge variant="secondary" className="font-mono text-xs">{alert.symbol}</Badge>
                    {alert.triggered ? (
                      <Badge className="bg-green-500/20 text-green-400 border-none text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Disparada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary/80">
                        Activa
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm flex items-center text-muted-foreground">
                    {alert.condition === 'above'
                      ? <ArrowUpRight className="w-4 h-4 mr-1 text-green-500 shrink-0" />
                      : <ArrowDownRight className="w-4 h-4 mr-1 text-red-500 shrink-0" />
                    }
                    <span>{alert.condition === 'above' ? 'Sube a' : 'Baja a'}</span>
                    <span className="font-mono font-medium text-foreground ml-1">
                      ${alert.targetPrice.toLocaleString('es-ES', { minimumFractionDigits: alert.targetPrice < 1 ? 4 : 2 })}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAlert(alert.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0 ml-2"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="pt-4 border-t border-border space-y-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nueva alerta</p>
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
            <div className="flex bg-muted rounded-lg p-1 flex-1">
              <Button
                variant={condition === 'above' ? 'default' : 'ghost'}
                size="sm"
                className={`flex-1 text-xs ${condition === 'above' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border-none shadow-none' : 'text-muted-foreground'}`}
                onClick={() => setCondition('above')}
              >
                Sube ▲
              </Button>
              <Button
                variant={condition === 'below' ? 'default' : 'ghost'}
                size="sm"
                className={`flex-1 text-xs ${condition === 'below' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-none shadow-none' : 'text-muted-foreground'}`}
                onClick={() => setCondition('below')}
              >
                Baja ▼
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                placeholder="Precio objetivo"
                className="pl-7 font-mono"
                value={priceStr}
                onChange={e => setPriceStr(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <Button onClick={handleAdd} disabled={!priceStr} className="shrink-0">
              Añadir
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
