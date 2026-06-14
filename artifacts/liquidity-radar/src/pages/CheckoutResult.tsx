import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/context/SubscriptionContext';
import { useTranslation } from '@/i18n';

export default function CheckoutResult({ success }: { success: boolean }) {
  const [, navigate] = useLocation();
  const { email, checkStatus } = useSubscription();
  const { t } = useTranslation();

  useEffect(() => {
    if (success && email) {
      // Poll subscription status after checkout
      const poll = async () => {
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 2000));
          await checkStatus(email);
        }
      };
      poll();
    }
  }, [success, email, checkStatus]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
      >
        {success ? (
          <CheckCircle2 size={72} className="text-[#f7931a] mx-auto" />
        ) : (
          <XCircle size={72} className="text-muted-foreground mx-auto" />
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-2"
      >
        <h1 className="text-2xl font-bold font-mono">
          {success ? '¡Bienvenido a LRC Pro!' : 'Pago cancelado'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {success
            ? 'Tu prueba gratuita de 2 días está activa. Disfruta de todas las funciones.'
            : 'Puedes suscribirte en cualquier momento desde Ajustes.'}
        </p>
      </motion.div>

      <Button
        className="bg-[#f7931a] hover:bg-[#f7931a]/90 text-black font-bold px-8"
        onClick={() => navigate(success ? '/' : '/subscription')}
      >
        {success ? 'Ir al Dashboard' : t('sub.cta')}
      </Button>
    </div>
  );
}
