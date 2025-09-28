import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import secureStorage from '../services/secureStorage';

type AiSettingsState = {
  apiKey: string | null;
  setApiKey: (apiKey: string | null) => void;
  clearApiKey: () => void;
};

const STORAGE_KEY = 'ai-settings';

export const useAiSettingsStore = create<AiSettingsState>()(
  persist(
    set => ({
      apiKey: null,
      setApiKey: apiKey => {
        const trimmed = apiKey?.trim();
        set({apiKey: trimmed ? trimmed : null});
      },
      clearApiKey: () => set({apiKey: null}),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => ({
        getItem: secureStorage.getItem,
        setItem: secureStorage.setItem,
        removeItem: secureStorage.removeItem,
      })),
      partialize: state => ({apiKey: state.apiKey}),
    },
  ),
);
