/**
 * OnboardingModal — shown ONCE on first launch.
 * Step 1: language selector + name/email/nickname/phone.
 * Step 2: disclaimer — auto-closes when checkbox is ticked.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, ChevronRight, Zap } from 'lucide-react';
import { useTranslation } from '@/i18n';

export interface OnboardingProfile {
  name: string;
  email: string;
  nickname: string;
  phone: string;
  language: 'es' | 'en';
}

interface Props {
  onComplete: (profile: OnboardingProfile) => void;
}

const copy = {
  es: {
    welcome: 'Bienvenido a LRC',
    subtitle: 'Liquidity Radar Crypto',
    intro: 'Completa tu perfil para continuar. Recibirás alertas y notificaciones en tu email.',
    name: 'Nombre completo',
    email: 'Email',
    nickname: 'Nickname',
    nicknameOpt: '(opcional)',
    phone: 'Teléfono',
    phoneOpt: '(opcional)',
    namePh: 'Ej. Juan Pérez',
    emailPh: 'Ej. juan@email.com',
    nickPh: 'Ej. CryptoTrader99',
    phonePh: 'Ej. +34 600 000 000',
    emailErr: 'Introduce un email válido',
    step1hint: 'Paso 1 de 2 · Puedes editar esto en Ajustes → Perfil',
    continue: 'Continuar',
    disclaimer: 'Aviso legal',
    disclaimerBody1: 'provee información de mercado y herramientas de análisis únicamente.',
    disclaimerBody2: 'No constituye asesoramiento financiero, de inversión, legal ni fiscal. Los datos mostrados pueden contener errores o retrasos.',
    disclaimerBody3: 'El usuario es el único responsable de sus decisiones de inversión y debe consultar a un profesional antes de operar.',
    accept: 'Entiendo que esto no es asesoramiento financiero y acepto los términos de uso.',
    step2hint: 'Paso 2 de 2 · Solo se muestra una vez',
    begin: 'Comenzar →',
  },
  en: {
    welcome: 'Welcome to LRC',
    subtitle: 'Liquidity Radar Crypto',
    intro: 'Complete your profile to continue. You will receive alerts and notifications by email.',
    name: 'Full name',
    email: 'Email',
    nickname: 'Nickname',
    nicknameOpt: '(optional)',
    phone: 'Phone',
    phoneOpt: '(optional)',
    namePh: 'e.g. John Smith',
    emailPh: 'e.g. john@email.com',
    nickPh: 'e.g. CryptoTrader99',
    phonePh: 'e.g. +1 555 000 0000',
    emailErr: 'Enter a valid email address',
    step1hint: 'Step 1 of 2 · You can edit this in Settings → Profile',
    continue: 'Continue',
    disclaimer: 'Legal disclaimer',
    disclaimerBody1: 'provides market information and analysis tools only.',
    disclaimerBody2: 'It does not constitute financial, investment, legal or tax advice. Data shown may contain errors or delays.',
    disclaimerBody3: 'The user is solely responsible for their investment decisions and should consult a professional before trading.',
    accept: 'I understand this is not financial advice and I accept the terms of use.',
    step2hint: 'Step 2 of 2 · Shown only once',
    begin: 'Get started →',
  },
};

export function OnboardingModal({ onComplete }: Props) {
  const { setLanguage } = useTranslation();

  const [lang, setLang]         = useState<'es' | 'en'>('es');
  const [step, setStep]         = useState<1 | 2>(1);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone]       = useState('');
  const [checked, setChecked]   = useState(false);
  const [visible, setVisible]   = useState(true);
  const [emailError, setEmailError] = useState('');

  const c = copy[lang];

  // Update app language immediately when user picks one
  useEffect(() => {
    setLanguage(lang);
  }, [lang, setLanguage]);

  // Auto-proceed when disclaimer checkbox is ticked
  useEffect(() => {
    if (step === 2 && checked) {
      const t = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onComplete({ name: name.trim(), email: email.trim(), nickname: nickname.trim(), phone: phone.trim(), language: lang }), 350);
      }, 350);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [checked, step]);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const canNext = step === 1
    ? name.trim().length >= 2 && isValidEmail(email.trim())
    : checked;

  const handleNext = () => {
    if (step === 1) {
      if (!isValidEmail(email.trim())) { setEmailError(c.emailErr); return; }
      setEmailError('');
      setStep(2);
      return;
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/97 backdrop-blur-md p-4"
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[80px]" />
          </div>

          <motion.div
            key={step}
            initial={{ opacity: 0, x: step === 1 ? 0 : 40, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -40, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Progress bar */}
            <div className="h-0.5 bg-border/40 shrink-0">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: step === 1 ? '0%' : '50%' }}
                animate={{ width: step === 1 ? '50%' : '100%' }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">

              {/* ── Step 1: Language + Profile ───────────────────── */}
              {step === 1 && (
                <>
                  {/* Header row: logo + language toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="font-bold text-lg tracking-tight leading-tight">{c.welcome}</h2>
                        <p className="text-xs text-muted-foreground">{c.subtitle}</p>
                      </div>
                    </div>

                    {/* Language selector */}
                    <div className="flex items-center gap-1 bg-muted/50 border border-border/50 rounded-lg p-0.5 shrink-0">
                      <button
                        onClick={() => setLang('es')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${lang === 'es' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        🇪🇸 ES
                      </button>
                      <button
                        onClick={() => setLang('en')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${lang === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        🇬🇧 EN
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">{c.intro}</p>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ob-name" className="text-sm font-medium">
                        {c.name} <span className="text-destructive">*</span>
                      </Label>
                      <Input id="ob-name" value={name} onChange={e => setName(e.target.value)}
                        placeholder={c.namePh} className="h-10" autoFocus
                        onKeyDown={e => e.key === 'Enter' && canNext && handleNext()} />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ob-email" className="text-sm font-medium">
                        {c.email} <span className="text-destructive">*</span>
                      </Label>
                      <Input id="ob-email" type="email" value={email}
                        onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                        placeholder={c.emailPh}
                        className={`h-10 ${emailError ? 'border-destructive' : ''}`}
                        onKeyDown={e => e.key === 'Enter' && canNext && handleNext()} />
                      {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ob-nick" className="text-sm font-medium">
                        {c.nickname} <span className="text-muted-foreground font-normal text-xs">{c.nicknameOpt}</span>
                      </Label>
                      <Input id="ob-nick" value={nickname} onChange={e => setNickname(e.target.value)}
                        placeholder={c.nickPh} className="h-10"
                        onKeyDown={e => e.key === 'Enter' && canNext && handleNext()} />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ob-phone" className="text-sm font-medium">
                        {c.phone} <span className="text-muted-foreground font-normal text-xs">{c.phoneOpt}</span>
                      </Label>
                      <Input id="ob-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder={c.phonePh} className="h-10"
                        onKeyDown={e => e.key === 'Enter' && canNext && handleNext()} />
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground/50 text-center">{c.step1hint}</p>

                  <Button className="w-full h-11 font-bold gap-2" disabled={!canNext} onClick={handleNext}>
                    <span>{c.continue}</span><ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}

              {/* ── Step 2: Disclaimer ───────────────────────────── */}
              {step === 2 && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg tracking-tight">{c.disclaimer}</h2>
                      <p className="text-xs text-muted-foreground">
                        {lang === 'es' ? `Hola, ${name.split(' ')[0]} 👋` : `Hi, ${name.split(' ')[0]} 👋`}
                      </p>
                    </div>
                  </div>

                  <div className="bg-muted/40 border border-border/60 rounded-xl p-4 text-sm text-muted-foreground leading-relaxed space-y-2">
                    <p><strong className="text-foreground">Liquidity Radar Crypto</strong> {c.disclaimerBody1}</p>
                    <p>{c.disclaimerBody2}</p>
                    <p>{c.disclaimerBody3}</p>
                  </div>

                  <div
                    role="button" tabIndex={0}
                    onClick={() => setChecked(v => !v)}
                    onKeyDown={e => e.key === ' ' && setChecked(v => !v)}
                    className="flex items-start gap-3 bg-muted/30 border border-border/50 rounded-xl p-4 cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox id="ob-terms" checked={checked}
                      onCheckedChange={c2 => setChecked(c2 as boolean)}
                      className="mt-0.5 shrink-0" />
                    <label htmlFor="ob-terms" className="text-sm font-medium cursor-pointer leading-snug">
                      {c.accept}
                    </label>
                  </div>

                  <p className="text-[11px] text-muted-foreground/50 text-center">{c.step2hint}</p>

                  {/* Shown while waiting for auto-proceed animation */}
                  {checked && (
                    <p className="text-center text-xs text-primary animate-pulse">{lang === 'es' ? 'Entrando…' : 'Loading…'}</p>
                  )}
                </>
              )}

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
