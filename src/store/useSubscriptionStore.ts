import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {
  SubscriptionPlan,
  UsageSnapshot,
  UsageType,
  canConsumeQuota,
  consumeQuota,
  createInitialUsage,
  ensureUsagePeriod,
  getRemainingQuota,
} from '../subscription/limits';

type SubscriptionState = {
  plan: SubscriptionPlan;
  usage: UsageSnapshot;
  setPlan: (plan: SubscriptionPlan) => void;
  canUseFeature: (type: UsageType, amount?: number) => boolean;
  recordUsage: (type: UsageType, amount?: number) => void;
  remainingQuota: (type: UsageType) => number;
  resetUsage: () => void;
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      plan: 'free',
      usage: createInitialUsage(),
      setPlan: plan =>
        set(state => ({
          plan,
          usage: ensureUsagePeriod(state.usage),
        })),
      canUseFeature: (type, amount = 1) => {
        const state = get();
        const normalized = ensureUsagePeriod(state.usage);
        if (normalized !== state.usage) {
          set({usage: normalized});
        }
        return canConsumeQuota(state.plan, normalized, type, amount);
      },
      recordUsage: (type, amount = 1) => {
        const state = get();
        const normalized = ensureUsagePeriod(state.usage);
        const updated = consumeQuota(normalized, type, amount);
        set({usage: updated});
      },
      remainingQuota: type => {
        const state = get();
        const normalized = ensureUsagePeriod(state.usage);
        if (normalized !== state.usage) {
          set({usage: normalized});
        }
        return getRemainingQuota(state.plan, normalized, type);
      },
      resetUsage: () => set({usage: createInitialUsage()}),
    }),
    {
      name: 'subscription-usage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        plan: state.plan,
        usage: ensureUsagePeriod(state.usage),
      }),
    },
  ),
);
