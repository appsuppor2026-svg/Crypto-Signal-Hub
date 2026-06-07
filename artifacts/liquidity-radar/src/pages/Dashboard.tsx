import { useAsset } from '@/context/AssetContext';
import { mockAlerts } from '@/data/mockData';
import { useAssetData } from '@/hooks/useAssetData';
import { motion } from 'framer-motion';

import { PriceCard } from '@/components/dashboard/PriceCard';
import { RadarScoreCard } from '@/components/dashboard/RadarScoreCard';
import { LiquidationZonesCard } from '@/components/dashboard/LiquidationZonesCard';
import { ChartArea } from '@/components/dashboard/ChartArea';
import { ActiveAlertsCard } from '@/components/dashboard/ActiveAlertsCard';
import { DisclaimerCard } from '@/components/dashboard/DisclaimerCard';
import { LiveBadge } from '@/components/dashboard/LiveBadge';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function Dashboard() {
  const { selectedAsset } = useAsset();
  const { assetData, status } = useAssetData(selectedAsset);

  return (
    <motion.div
      className="p-4 flex flex-col space-y-4"
      variants={container}
      initial="hidden"
      animate="show"
      key={selectedAsset}
    >
      <motion.div variants={item}>
        <LiveBadge status={status} />
      </motion.div>

      <motion.div variants={item}>
        <PriceCard asset={assetData} />
      </motion.div>

      <motion.div variants={item}>
        <RadarScoreCard asset={assetData} />
      </motion.div>

      <motion.div variants={item}>
        <ChartArea asset={assetData} />
      </motion.div>

      <motion.div variants={item}>
        <LiquidationZonesCard asset={assetData} />
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
