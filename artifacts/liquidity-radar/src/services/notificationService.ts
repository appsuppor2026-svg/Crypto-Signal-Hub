export interface NotificationConfig {
  enabled: boolean;
  priceAlerts: boolean;
  liquidityAlerts: boolean;
}

export const defaultNotificationConfig: NotificationConfig = {
  enabled: false,
  priceAlerts: true,
  liquidityAlerts: true
};

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function scheduleNotification(title: string, body: string): Promise<void> {
  // Implementation
}
