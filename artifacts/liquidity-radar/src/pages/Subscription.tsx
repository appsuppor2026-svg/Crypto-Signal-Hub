import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Star, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n';
import { useSubscription, type Plan } from '@/context/SubscriptionContext';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

function formatDate(ts: number | null) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Subscription() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const {
    status, isActive, isTrial, periodEnd, trialEnd,
    email, checkStatus, openCheckout, openPortal,
    plans, plansLoading,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [inputEmail, setInputEmail] = useState(email ?? '');
  const [loading, setLoading] = useState(false);
  const [restoreMode, setRestoreMode] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState('');

  // Find price IDs from plans
  const lrcPro = plans[0] as Plan | undefined;
  const monthlyPrice = lrcPro?.prices.find(p => p.recurring?.interval === 'month');
  const annualPrice = lrcPro?.prices.find(p => p.recurring?.interval === 'year');

  const selectedPriceId = selectedPlan === 'monthly' ? monthlyPrice?.id : annualPrice?.id;

  const handleCheckout = async () => {
    if (!inputEmail.trim() || !inputEmail.includes('@')) {
      toast({ title: t('sub.emailRequired'), variant: 'destructive' });
      return;
    }
    if (!selectedPriceId) return;
    setLoading(true);
    try {
      await openCheckout(selectedPriceId, inputEmail.trim());
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await openPortal(email);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreEmail.trim() || !restoreEmail.includes('@')) return;
    setLoading(true);
    try {
      await checkStatus(restoreEmail.trim());
      setRestoreMode(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const features = [
    t('sub.f1'), t('sub.f2'), t('sub.f3'), t('sub.f4'), t('sub.f5'), t('sub.f6'),
  ];

  // ── Active subscriber view ──
  if (isActive) {
    return (
      <div className="flex-1 flex flex-col p-4 pb-24 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <button onClick={() => navigate('/settings')} className="flex items-center text-muted-foreground text-sm mb-2 gap-1">
            <ArrowLeft size={16} /> {t('settings.title')}
          </button>

          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-[#f7931a]/20 flex items-center justify-center mx-auto mb-4">
              <Star className="text-[#f7931a]" size={32} />
            </div>
            <h1 className="text-2xl font-bold font-mono text-[#f7931a]">{t('sub.title')}</h1>
            <p className="text-muted-foreground mt-1">
              {isTrial ? t('sub.trial_active') : t('sub.active')}
            </p>
            {(isTrial ? trialEnd : periodEnd) && (
              <p className="text-sm text-muted-foreground mt-1">
                {isTrial ? t('sub.trial_ends') : t('sub.expires')} {formatDate(isTrial ? trialEnd : periodEnd)}
              </p>
            )}
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Check size={16} className="text-[#f7931a] flex-shrink-0" />
                  <span className="text-sm">{f}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full border-border"
            onClick={handlePortal}
            disabled={loading}
          >
            {t('sub.cancel')}
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── Paywall view ──
  return (
    <div className="flex-1 flex flex-col p-4 pb-24 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <button onClick={() => navigate('/settings')} className="flex items-center text-muted-foreground text-sm gap-1">
          <ArrowLeft size={16} /> {t('settings.title')}
        </button>

        {/* Header */}
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-[#f7931a]/20 flex items-center justify-center mx-auto mb-3">
            <Zap className="text-[#f7931a]" size={28} />
          </div>
          <h1 className="text-3xl font-bold font-mono text-[#f7931a]">{t('sub.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('sub.subtitle')}</p>
          <Badge variant="secondary" className="mt-2 bg-[#f7931a]/10 text-[#f7931a] border-[#f7931a]/30">
            {t('sub.trial')}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">{t('sub.trialDesc')}</p>
        </div>

        {/* Plan toggle */}
        <div className="flex rounded-xl overflow-hidden border border-border">
          <button
            onClick={() => setSelectedPlan('monthly')}
            className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
              selectedPlan === 'monthly'
                ? 'bg-[#f7931a] text-black'
                : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('sub.monthly')}
            {!plansLoading && monthlyPrice && (
              <div className="text-xs mt-0.5 font-normal">
                €{(monthlyPrice.unit_amount / 100).toFixed(2)}{t('sub.perMonth')}
              </div>
            )}
          </button>
          <button
            onClick={() => setSelectedPlan('annual')}
            className={`flex-1 py-3 text-center text-sm font-medium transition-colors relative ${
              selectedPlan === 'annual'
                ? 'bg-[#f7931a] text-black'
                : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('sub.annual')}
            {!plansLoading && annualPrice && (
              <div className="text-xs mt-0.5 font-normal">
                €{(annualPrice.unit_amount / 100).toFixed(2)}{t('sub.perYear')}
              </div>
            )}
            <span className={`absolute -top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-bold ${
              selectedPlan === 'annual' ? 'bg-black/20 text-black' : 'bg-[#f7931a]/20 text-[#f7931a]'
            }`}>
              {t('sub.save')}
            </span>
          </button>
        </div>

        {/* Features */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t('sub.features')}
            </p>
            <div className="space-y-2.5">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Check size={15} className="text-[#f7931a] flex-shrink-0" />
                  <span className="text-sm">{f}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Email input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('sub.emailLabel')}</label>
          <Input
            type="email"
            placeholder={t('sub.emailPh')}
            value={inputEmail}
            onChange={e => setInputEmail(e.target.value)}
            className="bg-card border-border"
          />
        </div>

        {/* CTA */}
        <Button
          className="w-full bg-[#f7931a] hover:bg-[#f7931a]/90 text-black font-bold text-base py-6"
          onClick={handleCheckout}
          disabled={loading || plansLoading || !selectedPriceId}
        >
          {loading ? t('sub.ctaLoading') : t('sub.cta')}
        </Button>

        {/* Restore access */}
        {!restoreMode ? (
          <button
            onClick={() => setRestoreMode(true)}
            className="w-full text-center text-sm text-muted-foreground underline underline-offset-2"
          >
            {t('sub.restore')}
          </button>
        ) : (
          <div className="space-y-2">
            <Input
              type="email"
              placeholder={t('sub.restorePh')}
              value={restoreEmail}
              onChange={e => setRestoreEmail(e.target.value)}
              className="bg-card border-border"
            />
            <Button
              variant="outline"
              className="w-full border-border"
              onClick={handleRestore}
              disabled={loading}
            >
              {t('sub.restore')}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
