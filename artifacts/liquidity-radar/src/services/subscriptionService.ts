export type SubscriptionTier = 'free' | 'pro' | 'elite';

export function getCurrentTier(): SubscriptionTier {
  return 'free';
}

export function isPremium(): boolean {
  return false;
}

export function getFeatureFlags() {
  return {
    aiAnalysis: false,
    pushNotifications: false,
    unlimitedAssets: false,
    advancedCharts: false
  };
}
