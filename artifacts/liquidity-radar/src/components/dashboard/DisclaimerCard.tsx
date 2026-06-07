import React from 'react';
import { useTranslation } from '@/i18n';

export function DisclaimerCard() {
  const { t } = useTranslation();

  return (
    <div className="p-4 mt-4 mb-6 rounded-lg bg-muted/20 border border-border/30 text-center">
      <p className="text-[10px] leading-relaxed text-muted-foreground/70">
        {t('disclaimer.text')}
      </p>
    </div>
  );
}
