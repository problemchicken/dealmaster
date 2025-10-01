export type SubscriptionPlan = 'free' | 'pro';

export type UsageType = 'aiMessages' | 'ocr';

export type UsageSnapshot = {
  period: string;
  aiMessages: number;
  ocr: number;
};

export type UsageLimits = Record<UsageType, number>;

export const USAGE_LIMITS: Record<SubscriptionPlan, UsageLimits> = {
  free: {
    aiMessages: 10,
    ocr: 3,
  },
  pro: {
    aiMessages: Number.POSITIVE_INFINITY,
    ocr: Number.POSITIVE_INFINITY,
  },
};

const getCurrentPeriodKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};

export const createInitialUsage = (): UsageSnapshot => ({
  period: getCurrentPeriodKey(),
  aiMessages: 0,
  ocr: 0,
});

export const ensureUsagePeriod = (usage: UsageSnapshot): UsageSnapshot => {
  const currentPeriod = getCurrentPeriodKey();
  if (usage.period === currentPeriod) {
    return usage;
  }

  return {
    period: currentPeriod,
    aiMessages: 0,
    ocr: 0,
  };
};

export const getRemainingQuota = (
  plan: SubscriptionPlan,
  usage: UsageSnapshot,
  type: UsageType,
): number => {
  const limit = USAGE_LIMITS[plan][type];
  if (!Number.isFinite(limit)) {
    return limit;
  }

  return Math.max(0, limit - usage[type]);
};

export const canConsumeQuota = (
  plan: SubscriptionPlan,
  usage: UsageSnapshot,
  type: UsageType,
  amount = 1,
): boolean => {
  const limit = USAGE_LIMITS[plan][type];
  if (!Number.isFinite(limit)) {
    return true;
  }

  return usage[type] + amount <= limit;
};

export const consumeQuota = (
  usage: UsageSnapshot,
  type: UsageType,
  amount = 1,
): UsageSnapshot => ({
  ...usage,
  [type]: usage[type] + amount,
});

export const FREE_MESSAGE_LIMIT = USAGE_LIMITS.free.aiMessages;
