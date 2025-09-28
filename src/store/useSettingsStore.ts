import {create} from 'zustand';

export type EnvOverrides = Record<string, string>;

export interface SettingsState {
  envOverrides: EnvOverrides;
  setEnvVar: (name: string, value: string | undefined) => void;
  clearEnvVar: (name: string) => void;
}

const normalizeName = (name: string): string => name.trim().toUpperCase();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  envOverrides: {},
  setEnvVar: (name, value) => {
    const normalized = normalizeName(name);
    set(state => {
      const next = {...state.envOverrides};
      if (value && value.length > 0) {
        next[normalized] = value;
      } else {
        delete next[normalized];
      }
      return {envOverrides: next};
    });
  },
  clearEnvVar: name => {
    const normalized = normalizeName(name);
    const existing = get().envOverrides;
    if (normalized in existing) {
      set(state => {
        const next = {...state.envOverrides};
        delete next[normalized];
        return {envOverrides: next};
      });
    }
  },
}));

export const selectEnvOverrides = (state: SettingsState) => state.envOverrides;
