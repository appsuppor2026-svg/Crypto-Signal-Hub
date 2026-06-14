/**
 * OnboardingModal — shown ONCE on first launch.
 * Step 1: name (required), email (required), nickname + phone (optional).
 * Step 2: disclaimer acceptance.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, ChevronRight, Zap } from 'lucide-react';

export interface OnboardingProfile {
  name: string;
  email: string;
  nickname: string;
  phone: string;
}

interface Props {
  onComplete: (profile: OnboardingProfile) => void;
}

export function OnboardingModal({ onComplete }: Props) {
  const [step, setStep]         = useState<1 | 2>(1);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone]       = useState('');
  const [checked, setChecked]   = useState(false);
  const [visible, setVisible]   = useState(true);
  const [emailError, setEmailError] = useState('');

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const canNext = step === 1
    ? name.trim().length >= 2 && isValidEmail(email.trim())
    : checked;

  const handleNext = () => {
    if (step === 1) {
      if (!isValidEmail(email.trim())) {
        setEmailError('Introduce un email válido');
        return;
      }
      setEmailError('');
      setStep(2);
      return;
    }
    setVisible(false);
    setTimeout(() => onComplete({
      name: name.trim(),
      email: email.trim(),
      nickname: nickname.trim(),
      phone: phone.trim(),
    }), 350);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/97 backdrop-blur-md p-6"
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
            className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Progress bar */}
            <div className="h-0.5 bg-border/40">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: step === 1 ? '0%' : '50%' }}
                animate={{ width: step === 1 ? '50%' : '100%' }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>

            <div className="p-7 space-y-5">
              {/* ── Step 1: Profile ──────────────────────────────── */}
              {step === 1 && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg tracking-tight">Bienvenido a LRC</h2>
                      <p className="text-xs text-muted-foreground">Liquidity Radar Crypto</p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Completa tu perfil para continuar. Recibirás alertas y notificaciones en tu email.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ob-name" className="text-sm font-medium">
                        Nombre completo <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="ob-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ej. Juan Pérez"
                        className="h-10"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && canNext && handleNext()}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ob-email" className="text-sm font-medium">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="ob-email"
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                        placeholder="Ej. juan@email.com"
                        className={`h-10 ${emailError ? 'border-destructive' : ''}`}
                        onKeyDown={e => e.key === 'Enter' && canNext && handleNext()}
                      />
                      {emailError && (
                        <p className="text-xs text-destructive">{emailError}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ob-nick" className="text-sm font-medium">
                        Nickname <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                      </Label>
                      <Input
                        id="ob-nick"
                        value={nickname}
                        onChange={e => setNickname(e.target.value)}
                        placeholder="Ej. CryptoTrader99"
                        className="h-10"
                        onKeyDown={e => e.key === 'Enter' && canNext && handleNext()}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ob-phone" className="text-sm font-medium">
                        Teléfono <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                      </Label>
                      <Input
                        id="ob-phone"
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="Ej. +34 600 000 000"
                        className="h-10"
                        onKeyDown={e => e.key === 'Enter' && canNext && handleNext()}
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground/50 text-center">
                    Paso 1 de 2 · Puedes editar esto en Ajustes → Perfil
                  </p>
                </>
              )}

              {/* ── Step 2: Disclaimer ───────────────────────────── */}
              {step === 2 && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg tracking-tight">Aviso legal</h2>
                      <p className="text-xs text-muted-foreground">Hola, {name.split(' ')[0]} 👋</p>
                    </div>
                  </div>

                  <div className="bg-muted/40 border border-border/60 rounded-xl p-4 text-sm text-muted-foreground leading-relaxed space-y-2">
                    <p>
                      <strong className="text-foreground">Liquidity Radar Crypto</strong> provee
                      información de mercado y herramientas de análisis únicamente.
                    </p>
                    <p>
                      No constituye asesoramiento financiero, de inversión, legal ni fiscal.
                      Los datos mostrados pueden contener errores o retrasos.
                    </p>
                    <p>
                      El usuario es el único responsable de sus decisiones de inversión y
                      debe consultar a un profesional antes de operar.
                    </p>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setChecked(v => !v)}
                    onKeyDown={e => e.key === ' ' && setChecked(v => !v)}
                    className="flex items-start gap-3 bg-muted/30 border border-border/50 rounded-xl p-4 cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id="ob-terms"
                      checked={checked}
                      onCheckedChange={c => setChecked(c as boolean)}
                      className="mt-0.5 shrink-0"
                    />
                    <label htmlFor="ob-terms" className="text-sm font-medium cursor-pointer leading-snug">
                      Entiendo que esto no es asesoramiento financiero y acepto los términos de uso.
                    </label>
                  </div>

                  <p className="text-[11px] text-muted-foreground/50 text-center">
                    Paso 2 de 2 · Solo se muestra una vez
                  </p>
                </>
              )}

              <Button
                className="w-full h-11 font-bold gap-2"
                disabled={!canNext}
                onClick={handleNext}
              >
                {step === 1 ? (
                  <><span>Continuar</span><ChevronRight className="w-4 h-4" /></>
                ) : (
                  'Comenzar →'
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
