import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';

export type SubscriptionPlan = 'free' | 'pro';

const PLAN_KEY = 'subscription:plan';
const USAGE_KEY = 'subscription:usage';
const RESET_KEY = 'subscription:reset';

const PLAN_QUOTAS: Record<SubscriptionPlan, number> = {
  free: 5,
  pro: 1000,
};

const getTodayIdentifier = () => {
  return new Date().toISOString().slice(0, 10);
};

export type SubscriptionState = {
  plan: SubscriptionPlan;
  dailyQuota: number;
  usedQuota: number;
  quotaResetAt: string;
  upgradeModalVisible: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  loadSubscription: () => Promise<void>;
  recordUsage: (amount?: number) => Promise<void>;
  setPlan: (plan: SubscriptionPlan) => Promise<void>;
  resetDailyUsage: () => Promise<void>;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  plan: 'free',
  dailyQuota: PLAN_QUOTAS.free,
  usedQuota: 0,
  quotaResetAt: getTodayIdentifier(),
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
      const today = getTodayIdentifier();
      const storedReset = data[RESET_KEY] ?? today;
      let storedUsageRaw = data[USAGE_KEY];
      if (storedReset !== today) {
        storedUsageRaw = '0';
        await AsyncStorage.multiSet([
          [USAGE_KEY, '0'],
          [RESET_KEY, today],
        ]);
      }
      const parsedUsage = storedUsageRaw ? Number.parseInt(storedUsageRaw, 10) : 0;
      set({
        plan: storedPlan,
        dailyQuota: quota,
        usedQuota: Number.isFinite(parsedUsage) ? Math.max(parsedUsage, 0) : 0,
        quotaResetAt: storedReset,
        isInitialized: true,
      });
    } catch (error) {
      console.error('Failed to load subscription state', error);
      set({
        plan: 'free',
        dailyQuota: PLAN_QUOTAS.free,
        usedQuota: 0,
        quotaResetAt: getTodayIdentifier(),
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
    const today = getTodayIdentifier();
    let nextUsage = state.usedQuota;
    if (state.quotaResetAt !== today) {
      nextUsage = 0;
      await AsyncStorage.multiSet([
        [USAGE_KEY, '0'],
        [RESET_KEY, today],
      ]);
    }
    nextUsage = Math.min(state.dailyQuota, nextUsage + amount);
    await AsyncStorage.setItem(USAGE_KEY, String(nextUsage));
    await AsyncStorage.setItem(RESET_KEY, today);
    set({usedQuota: nextUsage, quotaResetAt: today});
    if (nextUsage >= state.dailyQuota) {
      set({upgradeModalVisible: true});
    }
  },
  setPlan: async (plan: SubscriptionPlan) => {
    const quota = PLAN_QUOTAS[plan];
    const today = getTodayIdentifier();
    await AsyncStorage.setItem(PLAN_KEY, plan);
    if (plan === 'pro') {
      await AsyncStorage.multiSet([
        [USAGE_KEY, '0'],
        [RESET_KEY, today],
      ]);
    }
    const nextUsage = plan === 'pro' ? 0 : Math.min(get().usedQuota, quota);
    set({
      plan,
      dailyQuota: quota,
      usedQuota: nextUsage,
      quotaResetAt: plan === 'pro' ? today : get().quotaResetAt,
      upgradeModalVisible: false,
    });
  },
  resetDailyUsage: async () => {
    const today = getTodayIdentifier();
    await AsyncStorage.multiSet([
      [USAGE_KEY, '0'],
      [RESET_KEY, today],
    ]);
    set({usedQuota: 0, quotaResetAt: today});
  },
  openUpgradeModal: () => set({upgradeModalVisible: true}),
  closeUpgradeModal: () => set({upgradeModalVisible: false}),
}));

export const SUBSCRIPTION_PLAN_QUOTAS = PLAN_QUOTAS;
