import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AssetData } from '@/types';
import { useTranslation } from '@/i18n';
import { motion } from 'framer-motion';
import { Crosshair } from 'lucide-react';

interface RadarScoreCardProps {
  asset: AssetData;
}

export function RadarScoreCard({ asset }: RadarScoreCardProps) {
  const { t } = useTranslation();
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    setDisplayScore(0);
    const duration = 1000;
    const steps = 60;
    const stepTime = duration / steps;
    const increment = asset.radarScore / steps;
    
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= asset.radarScore) {
        setDisplayScore(asset.radarScore);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(current));
      }
    }, stepTime);
    
    return () => clearInterval(timer);
  }, [asset.radarScore]);

  const getBiasColor = () => {
    if (asset.bias === 'bullish') return 'text-green-500 bg-green-500/10 border-green-500/20 shadow-[0_0_10px_0_rgba(34,197,94,0.2)]';
    if (asset.bias === 'bearish') return 'text-destructive bg-destructive/10 border-destructive/20 shadow-[0_0_10px_0_rgba(239,68,68,0.2)]';
    return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20 shadow-[0_0_10px_0_rgba(234,179,8,0.2)]';
  };

  const getScoreColorHex = () => {
    if (asset.radarScore >= 70) return '#22c55e'; // green-500
    if (asset.radarScore <= 40) return '#ef4444'; // destructive
    return '#eab308'; // yellow-500
  };

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  return (
    <Card className="bg-card border-border rounded-2xl overflow-hidden relative shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle
                cx="64"
                cy="64"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-muted/30"
              />
              <motion.circle
                cx="64"
                cy="64"
                r={radius}
                stroke={getScoreColorHex()}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 ease-out drop-shadow-[0_0_8px_currentColor]"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold font-mono">{displayScore}</span>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Radar</span>
            </div>
          </div>
          
          <div className="flex-1 pl-6 flex flex-col items-center justify-center">
            <div className={`px-4 py-2 rounded-lg border font-bold text-sm tracking-wider mb-2 ${getBiasColor()}`}>
              {t(`bias.${asset.bias}` as any)}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Market Bias Indicator based on liquidity conditions
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-border/50">
          <MetricBar label={t('metrics.liquidity')} value={asset.metrics.liquidity} color="bg-primary" />
          <MetricBar label={t('metrics.openInterest')} value={asset.metrics.openInterest} color="bg-secondary" />
          <MetricBar label={t('metrics.funding')} value={asset.metrics.funding} color="bg-green-500" />
          <MetricBar label={t('metrics.trend')} value={asset.metrics.trend} color="bg-blue-500" />
        </div>

        {/* Liquidity Target Section */}
        {asset.liquidityTarget && (
          <div className="mt-6 pt-4 border-t border-border/30">
            <div className="flex items-center space-x-2 mb-2 text-muted-foreground">
              <Crosshair size={14} className="text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider">Objetivo de Liquidez</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="font-mono text-xl font-bold">
                ${asset.liquidityTarget.price >= 1000 ? asset.liquidityTarget.price.toLocaleString() : asset.liquidityTarget.price.toFixed(3)}
              </span>
              <span className={`text-sm font-mono font-bold ${asset.liquidityTarget.distancePct >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {asset.liquidityTarget.distancePct >= 0 ? '+' : ''}{asset.liquidityTarget.distancePct.toFixed(1)}%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Zona con mayor concentración de liquidez</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5 font-medium">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}/100</span>
      </div>
      <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border/50">
        <motion.div 
          className={`h-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, delay: 0.2 }}
        />
      </div>
    </div>
  );
}
