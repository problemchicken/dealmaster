import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import type {SubscriptionPlan} from '../subscription/types';
import {
  PLAN_MONTHLY_QUOTAS,
  canUseChat as canUseChatHelper,
  canUseOcr as canUseOcrHelper,
  getMonthlyQuotaForPlan,
  onChatConsumed,
  onOcrConsumed,
} from '../subscription/limits';
import {track} from '../services/telemetry';

const PLAN_KEY = 'subscription:plan';
const USAGE_KEY = 'subscription:usage';
const RESET_KEY = 'subscription:reset';

const getCurrentMonthIdentifier = () => {
  return new Date().toISOString().slice(0, 7);
};

export type SubscriptionState = {
  plan: SubscriptionPlan;
  monthlyQuota: number;
  usedQuota: number;
  quotaResetAt: string;
  upgradeModalVisible: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  loadSubscription: () => Promise<void>;
  consumeChat: (amount?: number) => Promise<boolean>;
  consumeOcr: (amount?: number) => Promise<boolean>;
  consumeQuota: (feature: 'chat' | 'ocr', amount?: number) => Promise<boolean>;
  canUseChat: () => boolean;
  canUseOcr: () => boolean;
  isQuotaExceeded: () => boolean;
  setPlan: (plan: SubscriptionPlan) => Promise<void>;
  resetMonthlyUsage: () => Promise<void>;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  plan: 'free',
  monthlyQuota: PLAN_MONTHLY_QUOTAS.free,
  usedQuota: 0,
  quotaResetAt: getCurrentMonthIdentifier(),
  upgradeModalVisible: false,
  isInitialized: false,
  isLoading: false,
  loadSubscription: async () => {
    set({isLoading: true});
    try {
      const entries = await AsyncStorage.multiGet([PLAN_KEY, USAGE_KEY, RESET_KEY]);
      const data = Object.fromEntries(entries);
      const storedPlan = data[PLAN_KEY] === 'pro' ? 'pro' : 'free';
      const quota = getMonthlyQuotaForPlan(storedPlan);
      const currentMonth = getCurrentMonthIdentifier();
      const storedReset = data[RESET_KEY] ?? currentMonth;
      let storedUsageRaw = data[USAGE_KEY];
      if (storedReset !== currentMonth) {
        storedUsageRaw = '0';
        await AsyncStorage.multiSet([
          [USAGE_KEY, '0'],
          [RESET_KEY, currentMonth],
        ]);
      }
      const parsedUsage = storedUsageRaw ? Number.parseInt(storedUsageRaw, 10) : 0;
      set({
        plan: storedPlan,
        monthlyQuota: quota,
        usedQuota: Number.isFinite(parsedUsage) ? Math.max(parsedUsage, 0) : 0,
        quotaResetAt: storedReset,
        isInitialized: true,
      });
    } catch (error) {
      console.error('Failed to load subscription state', error);
      set({
        plan: 'free',
        monthlyQuota: PLAN_MONTHLY_QUOTAS.free,
        usedQuota: 0,
        quotaResetAt: getCurrentMonthIdentifier(),
        isInitialized: true,
      });
    } finally {
      set({isLoading: false});
    }
  },
  consumeChat: async (amount = 1) => {
    return get().consumeQuota('chat', amount);
  },
  consumeOcr: async (amount = 1) => {
    return get().consumeQuota('ocr', amount);
  },
  canUseChat: () => {
    const state = get();
    return canUseChatHelper(state.plan, state.usedQuota, state.monthlyQuota);
  },
  canUseOcr: () => {
    const state = get();
    return canUseOcrHelper(state.plan, state.usedQuota, state.monthlyQuota);
  },
  isQuotaExceeded: () => {
    const state = get();
    return !canUseChatHelper(state.plan, state.usedQuota, state.monthlyQuota);
  },
  setPlan: async (plan: SubscriptionPlan) => {
    const quota = getMonthlyQuotaForPlan(plan);
    const currentMonth = getCurrentMonthIdentifier();
    await AsyncStorage.setItem(PLAN_KEY, plan);
    if (plan === 'pro') {
      await AsyncStorage.multiSet([
        [USAGE_KEY, '0'],
        [RESET_KEY, currentMonth],
      ]);
    }
    const nextUsage = plan === 'pro' ? 0 : Math.min(get().usedQuota, quota);
    set({
      plan,
      monthlyQuota: quota,
      usedQuota: nextUsage,
      quotaResetAt: plan === 'pro' ? currentMonth : get().quotaResetAt,
      upgradeModalVisible: false,
    });
  },
  resetMonthlyUsage: async () => {
    const currentMonth = getCurrentMonthIdentifier();
    await AsyncStorage.multiSet([
      [USAGE_KEY, '0'],
      [RESET_KEY, currentMonth],
    ]);
    set({usedQuota: 0, quotaResetAt: currentMonth});
  },
  openUpgradeModal: () => set({upgradeModalVisible: true}),
  closeUpgradeModal: () => set({upgradeModalVisible: false}),
  consumeQuota: async (feature: 'chat' | 'ocr', amount = 1) => {
    const state = get();
    if (state.plan === 'pro') {
      if (feature === 'ocr') {
        track('quota_consume', {feature});
      }
      return true;
    }

    const currentMonth = getCurrentMonthIdentifier();
    let usedQuota = state.usedQuota;
    if (state.quotaResetAt !== currentMonth) {
      usedQuota = 0;
      await AsyncStorage.multiSet([
        [USAGE_KEY, '0'],
        [RESET_KEY, currentMonth],
      ]);
      set({usedQuota: 0, quotaResetAt: currentMonth});
    }

    const monthlyQuota = get().monthlyQuota;
    if (!canUseChatHelper(state.plan, usedQuota, monthlyQuota)) {
      set({upgradeModalVisible: true});
      return false;
    }

    const nextUsage =
      feature === 'ocr'
        ? onOcrConsumed(state.plan, usedQuota, monthlyQuota, amount)
        : onChatConsumed(state.plan, usedQuota, monthlyQuota, amount);

    if (nextUsage === usedQuota) {
      if (feature === 'ocr') {
        track('quota_consume', {feature});
      }
      return true;
    }

    await AsyncStorage.multiSet([
      [USAGE_KEY, String(nextUsage)],
      [RESET_KEY, currentMonth],
    ]);
    set({usedQuota: nextUsage, quotaResetAt: currentMonth});

    if (feature === 'ocr') {
      track('quota_consume', {feature});
    }

    if (!canUseChatHelper(state.plan, nextUsage, monthlyQuota)) {
      set({upgradeModalVisible: true});
    }

    return true;
  },
}));

export const SUBSCRIPTION_PLAN_QUOTAS = PLAN_MONTHLY_QUOTAS;
export type {SubscriptionPlan};
