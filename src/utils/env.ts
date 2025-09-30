import type {EnvOverrides} from '../store/useSettingsStore';
import {selectEnvOverrides, useSettingsStore} from '../store/useSettingsStore';

type MaybeRecord = Record<string, unknown> | null | undefined;

const normalizeName = (name: string): string => name.trim().toUpperCase();

const readFromRecord = (record: MaybeRecord, name: string): string | undefined => {
  if (!record || typeof record !== 'object') {
    return undefined;
  }

  const container = record as Record<string, unknown>;

  const direct = container[name];
  if (typeof direct === 'string') {
    return direct;
  }

  const nestedKeys: Array<keyof typeof container> = [
    'extra',
    'manifest',
    'manifest2',
    'expoConfig',
    'config',
  ];

  for (const key of nestedKeys) {
    const value = container[key as string];
    if (!value || typeof value !== 'object') {
      continue;
    }
    if (key === 'manifest' || key === 'manifest2') {
      const manifest = value as Record<string, unknown>;
      const extra = manifest.extra;
      if (extra && typeof extra === 'object') {
        const match = (extra as Record<string, unknown>)[name];
        if (typeof match === 'string') {
          return match;
        }
      }
      continue;
    }
    const nested = value as Record<string, unknown>;
    const match = nested[name];
    if (typeof match === 'string') {
      return match;
    }
    if ('extra' in nested && typeof nested.extra === 'object' && nested.extra) {
      const extra = nested.extra as Record<string, unknown>;
      const extraMatch = extra[name];
      if (typeof extraMatch === 'string') {
        return extraMatch;
      }
    }
  }

  return undefined;
};

const readFromExpoGlobals = (name: string): string | undefined => {
  const globalAny = globalThis as Record<string, unknown>;
  const candidates: unknown[] = [
    globalAny?.Expo && (globalAny.Expo as Record<string, unknown>).Constants,
    globalAny?.Constants,
    globalAny?.ExpoConstants,
    globalAny?.expoConfig,
    globalAny?.__expoConfig,
    globalAny?.Config,
    globalAny?.config,
  ];

  for (const candidate of candidates) {
    const value = readFromRecord(candidate as MaybeRecord, name);
    if (typeof value === 'string') {
      return value;
    }
  }

  return undefined;
};

const readFromSettings = (overrides: EnvOverrides, name: string): string | undefined =>
  overrides[name];

export const getEnvVar = (rawName: string): string | undefined => {
  const name = normalizeName(rawName);
  if (!name) {
    return undefined;
  }

  const overrides = selectEnvOverrides(useSettingsStore.getState());
  const fromSettings = readFromSettings(overrides, name);
  if (fromSettings) {
    return fromSettings;
  }

  const fromExpo = readFromExpoGlobals(name);
  if (fromExpo) {
    return fromExpo;
  }

  if (typeof process !== 'undefined' && typeof process?.env === 'object') {
    const value = process.env?.[name];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
};

export const useEnvVar = (name: string): string | undefined => {
  const overrides = useSettingsStore(state => state.envOverrides);
  const normalized = normalizeName(name);

  return getEnvVar(normalized) ?? overrides[normalized];
};
