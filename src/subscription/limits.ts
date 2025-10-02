import type {SubscriptionPlan} from './types';

export const MONTHLY_FREE_QUOTA = 3;
export const MONTHLY_PRO_QUOTA = 1_000_000;

export const PLAN_MONTHLY_QUOTAS: Record<SubscriptionPlan, number> = {
  free: MONTHLY_FREE_QUOTA,
  pro: MONTHLY_PRO_QUOTA,
};

export const getMonthlyQuotaForPlan = (plan: SubscriptionPlan): number =>
  PLAN_MONTHLY_QUOTAS[plan];

export const isUnlimitedPlan = (plan: SubscriptionPlan): boolean => plan === 'pro';

export const canUseChat = (
  plan: SubscriptionPlan,
  usedQuota: number,
  monthlyQuota: number,
): boolean => {
  if (isUnlimitedPlan(plan)) {
    return true;
  }
  return usedQuota < monthlyQuota;
};

export const canUseOcr = canUseChat;

const normalizeAmount = (amount: number | undefined): number => {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return amount;
};

const applyConsumption = (
  plan: SubscriptionPlan,
  usedQuota: number,
  monthlyQuota: number,
  amount?: number,
): number => {
  if (isUnlimitedPlan(plan)) {
    return usedQuota;
  }
  const normalized = normalizeAmount(amount);
  if (normalized === 0) {
    return usedQuota;
  }
  return Math.min(monthlyQuota, usedQuota + normalized);
};

export const onChatConsumed = (
  plan: SubscriptionPlan,
  usedQuota: number,
  monthlyQuota: number,
  amount?: number,
): number => applyConsumption(plan, usedQuota, monthlyQuota, amount);

export const onOcrConsumed = (
  plan: SubscriptionPlan,
  usedQuota: number,
  monthlyQuota: number,
  amount?: number,
): number => applyConsumption(plan, usedQuota, monthlyQuota, amount);
