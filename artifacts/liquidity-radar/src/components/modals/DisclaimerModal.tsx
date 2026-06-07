import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function DisclaimerModal({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const handleAccept = () => {
    setIsVisible(false);
    setTimeout(() => {
      onAccept();
    }, 300);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md p-6"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/50 pointer-events-none" />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-sm flex flex-col items-center text-center space-y-6 bg-card border border-border p-8 rounded-2xl shadow-2xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mb-2 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <AlertTriangle size={32} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-mono tracking-tight text-foreground">Aviso importante</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Liquidity Radar Crypto provee información de mercado y herramientas de análisis únicamente. No es asesoramiento financiero. Los usuarios son responsables de sus propias decisiones de inversión.
              </p>
            </div>

            <div className="flex items-start space-x-3 w-full bg-muted/50 p-4 rounded-lg border border-border/50 text-left">
              <Checkbox 
                id="terms" 
                checked={checked}
                onCheckedChange={(c) => setChecked(c as boolean)}
                className="mt-1"
              />
              <label 
                htmlFor="terms" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Entiendo y acepto los términos
              </label>
            </div>

            <Button 
              className="w-full font-bold uppercase tracking-wide py-6"
              disabled={!checked}
              onClick={handleAccept}
            >
              Continuar
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
