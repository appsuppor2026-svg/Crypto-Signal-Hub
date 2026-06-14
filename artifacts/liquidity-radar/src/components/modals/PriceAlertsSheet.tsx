import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAlerts, SmartAlertPrefs } from '@/context/AlertsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, BellOff, ArrowUpRight, ArrowDownRight, CheckCircle2, Bell, BellRing, TrendingUp, TrendingDown, ArrowLeftRight, ArrowUp, ArrowDown, Mail } from 'lucide-react';
import { SYMBOL_TO_COINGECKO } from '@/services/cryptoService';
import { useTranslation } from '@/i18n';

interface PriceAlertsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SmartAlertDef {
  key: keyof SmartAlertPrefs;
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: string;
}

const SMART_ALERT_DEFS: SmartAlertDef[] = [
  {
    key: 'radarHigh',
    icon: <TrendingUp className="w-4 h-4" />,
    label: 'Radar Score > 80',
    desc: 'Condiciones alcistas extremas detectadas',
    color: 'text-green-400',
  },
  {
    key: 'radarLow',
    icon: <TrendingDown className="w-4 h-4" />,
    label: 'Radar Score < 20',
    desc: 'Condiciones bajistas críticas detectadas',
    color: 'text-red-400',
  },
  {
    key: 'biasChange',
    icon: <ArrowLeftRight className="w-4 h-4" />,
    label: 'Cambio Alcista ↔ Bajista',
    desc: 'El sesgo de mercado cambia de dirección',
    color: 'text-amber-400',
  },
  {
    key: 'upperLiq200M',
    icon: <ArrowUp className="w-4 h-4" />,
    label: 'Liquidez Superior > $200M',
    desc: 'Zona de liquidez importante arriba del precio',
    color: 'text-primary',
  },
  {
    key: 'lowerLiq200M',
    icon: <ArrowDown className="w-4 h-4" />,
    label: 'Liquidez Inferior > $200M',
    desc: 'Zona de liquidez importante abajo del precio',
    color: 'text-violet-400',
  },
];

function SmartToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none ${
        active ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
          active ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function PriceAlertsSheet({ open, onOpenChange }: PriceAlertsSheetProps) {
  const { alerts, addAlert, removeAlert, notificationPermission, requestPermission, smartPrefs, toggleSmartPref } = useAlerts();
  const { language } = useTranslation();
  const [symbol, setSymbol] = useState('BTC');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [priceStr, setPriceStr] = useState('');
  const [requesting, setRequesting] = useState(false);

  const copy = {
    es: {
      title: 'Alertas',
      smartSection: 'Alertas Inteligentes',
      priceSection: 'Alertas de Precio Manual',
      newAlert: 'Nueva alerta de precio',
      noAlerts: 'No tienes alertas de precio',
      noAlertsHint: 'Añade una abajo',
      above: 'Sube ▲',
      below: 'Baja ▼',
      pricePh: 'Precio objetivo',
      add: 'Añadir',
      triggered: 'Disparada',
      active: 'Activa',
      goesUp: 'Sube a',
      goesDown: 'Baja a',
      pushActive: 'Notificaciones push activas',
      pushCta: '🔔 Activar notificaciones push',
      pushDesc: 'Recibe alertas aunque tengas la app en segundo plano.',
      pushRequesting: 'Solicitando...',
      emailFallback: 'Alertas activas por email',
      emailFallbackDesc: 'Te avisamos por correo cuando se activen tus alertas.',
    },
    en: {
      title: 'Alerts',
      smartSection: 'Smart Alerts',
      priceSection: 'Manual Price Alerts',
      newAlert: 'New price alert',
      noAlerts: 'No price alerts yet',
      noAlertsHint: 'Add one below',
      above: 'Goes up ▲',
      below: 'Goes down ▼',
      pricePh: 'Target price',
      add: 'Add',
      triggered: 'Triggered',
      active: 'Active',
      goesUp: 'Goes up to',
      goesDown: 'Goes down to',
      pushActive: 'Push notifications active',
      pushCta: '🔔 Enable push notifications',
      pushDesc: 'Get alerts even when the app is in the background.',
      pushRequesting: 'Requesting...',
      emailFallback: 'Email alerts active',
      emailFallbackDesc: 'We will notify you by email when your alerts trigger.',
    },
  };
  const c = copy[language as 'es' | 'en'] ?? copy.es;

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
  const activeSmartCount = Object.values(smartPrefs).filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] bg-background border-t border-border flex flex-col sm:max-w-[430px] sm:mx-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 rounded-t-xl px-4 pb-6">
        <SheetHeader className="mb-3">
          <SheetTitle className="font-mono text-xl flex items-center gap-2">
            <BellRing className="w-5 h-5 text-primary" />
            {c.title}
            {activeSmartCount > 0 && (
              <Badge className="bg-primary/20 text-primary border-none text-xs font-mono ml-1">
                {activeSmartCount}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Push granted → green badge */}
        {notificationPermission === 'granted' && (
          <div className="mb-3 rounded-xl p-2.5 border border-green-500/20 bg-green-500/5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xs text-green-500 font-medium">{c.pushActive}</p>
          </div>
        )}

        {/* Push not-yet-asked → soft opt-in button */}
        {notificationPermission === 'default' && (
          <div className="mb-3 rounded-xl p-3 border border-primary/20 bg-primary/5 flex items-start gap-3">
            <Bell className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground leading-snug">{c.pushDesc}</p>
              <Button
                size="sm"
                className="mt-2 h-7 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"
                onClick={handleRequestPermission}
                disabled={requesting}
              >
                {requesting ? c.pushRequesting : c.pushCta}
              </Button>
            </div>
          </div>
        )}

        {/* Push denied → silent email fallback, no red error */}
        {notificationPermission === 'denied' && (
          <div className="mb-3 rounded-xl p-2.5 border border-border/40 bg-muted/30 flex items-center gap-2.5">
            <Mail className="w-4 h-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">{c.emailFallback}</p>
              <p className="text-[10px] text-muted-foreground/60">{c.emailFallbackDesc}</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">

          {/* ── Smart Alerts ─────────────────────────── */}
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
              {c.smartSection}
            </p>
            <div className="space-y-2">
              {SMART_ALERT_DEFS.map(({ key, icon, label, desc, color }) => (
                <div
                  key={key}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                    smartPrefs[key]
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border/50 bg-card'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`shrink-0 ${color}`}>{icon}</div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium leading-tight ${smartPrefs[key] ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5 leading-tight">
                        {desc}
                      </p>
                    </div>
                  </div>
                  <SmartToggle
                    active={smartPrefs[key]}
                    onToggle={() => toggleSmartPref(key)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Price Alerts ──────────────────────────── */}
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
              {c.priceSection}
            </p>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 text-muted-foreground">
                <BellOff className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">{c.noAlerts}</p>
                <p className="text-xs opacity-60 mt-0.5">{c.noAlertsHint}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.slice().reverse().map(alert => (
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
                            <CheckCircle2 className="w-3 h-3 mr-1" /> {c.triggered}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary/80">
                            {c.active}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm flex items-center text-muted-foreground">
                        {alert.condition === 'above'
                          ? <ArrowUpRight className="w-4 h-4 mr-1 text-green-500 shrink-0" />
                          : <ArrowDownRight className="w-4 h-4 mr-1 text-red-500 shrink-0" />
                        }
                        <span>{alert.condition === 'above' ? c.goesUp : c.goesDown}</span>
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
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Add new price alert ───────────────────── */}
        <div className="pt-4 border-t border-border space-y-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{c.newAlert}</p>
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
                {c.above}
              </Button>
              <Button
                variant={condition === 'below' ? 'default' : 'ghost'}
                size="sm"
                className={`flex-1 text-xs ${condition === 'below' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-none shadow-none' : 'text-muted-foreground'}`}
                onClick={() => setCondition('below')}
              >
                {c.below}
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                placeholder={c.pricePh}
                className="pl-7 font-mono"
                value={priceStr}
                onChange={e => setPriceStr(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <Button onClick={handleAdd} disabled={!priceStr} className="shrink-0">
              {c.add}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
