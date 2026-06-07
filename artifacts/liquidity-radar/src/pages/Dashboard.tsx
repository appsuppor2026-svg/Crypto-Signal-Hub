import React from 'react';
import { useAsset } from '@/context/AssetContext';
import { mockAssets, mockAlerts } from '@/data/mockData';
import { motion } from 'framer-motion';

import { PriceCard } from '@/components/dashboard/PriceCard';
import { RadarScoreCard } from '@/components/dashboard/RadarScoreCard';
import { LiquidationZonesCard } from '@/components/dashboard/LiquidationZonesCard';
import { ChartArea } from '@/components/dashboard/ChartArea';
import { ActiveAlertsCard } from '@/components/dashboard/ActiveAlertsCard';
import { DisclaimerCard } from '@/components/dashboard/DisclaimerCard';

export default function Dashboard() {
  const { selectedAsset } = useAsset();
  const assetData = mockAssets[selectedAsset];

  if (!assetData) return null;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <motion.div 
      className="p-4 flex flex-col space-y-4"
      variants={container}
      initial="hidden"
      animate="show"
      key={selectedAsset} // Re-animate on asset change
    >
      <motion.div variants={item}>
        <PriceCard asset={assetData} />
      </motion.div>
      
      <motion.div variants={item}>
        <RadarScoreCard asset={assetData} />
      </motion.div>
      
      <motion.div variants={item}>
        <LiquidationZonesCard asset={assetData} />
      </motion.div>
      
      <motion.div variants={item}>
        <ChartArea asset={assetData} />
      </motion.div>
      
      <motion.div variants={item}>
        <ActiveAlertsCard alerts={mockAlerts} selectedAsset={selectedAsset} />
      </motion.div>
      
      <motion.div variants={item}>
        <DisclaimerCard />
      </motion.div>
    </motion.div>
  );
}
