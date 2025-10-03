import type {EnvOverrides} from '../store/useSettingsStore';
import {selectEnvOverrides, useSettingsStore} from '../store/useSettingsStore';

type ExpoConstantsLike = {
  [key: string]: unknown;
  expoConfig?: {extra?: Record<string, unknown> | null | undefined} | null | undefined;
  manifest?: {extra?: Record<string, unknown> | null | undefined} | null | undefined;
  manifest2?: {extra?: Record<string, unknown> | null | undefined} | null | undefined;
};

type MaybeRecord = Record<string, unknown> | null | undefined;

const normalizeName = (name: string): string => name.trim().toUpperCase();

let hasAttemptedExpoConstantsLoad = false;
let cachedExpoConstants: ExpoConstantsLike | undefined;

const loadExpoConstantsSafely = (): ExpoConstantsLike | undefined => {
  if (hasAttemptedExpoConstantsLoad) {
    return cachedExpoConstants;
  }

  hasAttemptedExpoConstantsLoad = true;

  try {
    if (typeof require !== 'function') {
      return undefined;
    }

    const moduleExports = require('expo-constants');
    const constants = (moduleExports?.default ?? moduleExports) as ExpoConstantsLike | undefined;

    if (constants && typeof constants === 'object') {
      cachedExpoConstants = constants;
      return cachedExpoConstants;
    }
  } catch {
    cachedExpoConstants = undefined;
    return undefined;
  }

  cachedExpoConstants = undefined;
  return undefined;
};

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
  const expoConstants = loadExpoConstantsSafely();
  const candidates: unknown[] = [
    expoConstants,
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
