import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';

export type SubscriptionPlan = 'free' | 'pro';

const PLAN_KEY = 'subscription:plan';
const USAGE_KEY = 'subscription:usage';
const RESET_KEY = 'subscription:reset';

const PLAN_QUOTAS: Record<SubscriptionPlan, number> = {
  free: 3,
  pro: 1000000,
};

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
  recordUsage: (amount?: number) => Promise<void>;
  setPlan: (plan: SubscriptionPlan) => Promise<void>;
  resetMonthlyUsage: () => Promise<void>;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  plan: 'free',
  monthlyQuota: PLAN_QUOTAS.free,
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
      const quota = PLAN_QUOTAS[storedPlan];
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
        monthlyQuota: PLAN_QUOTAS.free,
        usedQuota: 0,
        quotaResetAt: getCurrentMonthIdentifier(),
        isInitialized: true,
      });
    } finally {
      set({isLoading: false});
    }
  },
  recordUsage: async (amount = 1) => {
    const state = get();
    if (state.plan === 'pro') {
      return;
    }
    const currentMonth = getCurrentMonthIdentifier();
    let nextUsage = state.usedQuota;
    if (state.quotaResetAt !== currentMonth) {
      nextUsage = 0;
      await AsyncStorage.multiSet([
        [USAGE_KEY, '0'],
        [RESET_KEY, currentMonth],
      ]);
    }
    nextUsage = Math.min(state.monthlyQuota, nextUsage + amount);
    await AsyncStorage.setItem(USAGE_KEY, String(nextUsage));
    await AsyncStorage.setItem(RESET_KEY, currentMonth);
    set({usedQuota: nextUsage, quotaResetAt: currentMonth});
    if (nextUsage >= state.monthlyQuota) {
      set({upgradeModalVisible: true});
    }
  },
  setPlan: async (plan: SubscriptionPlan) => {
    const quota = PLAN_QUOTAS[plan];
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
}));

export const SUBSCRIPTION_PLAN_QUOTAS = PLAN_QUOTAS;
