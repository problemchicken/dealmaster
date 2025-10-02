export type FeatureFlags = {
  ocrNative: boolean;
};

const readEnvFlag = (): boolean | undefined => {
  if (typeof process === 'undefined' || !process?.env) {
    return undefined;
  }

  const candidates = [
    process.env.EXPO_PUBLIC_OCR_NATIVE,
    process.env.OCR_NATIVE,
    process.env.REACT_NATIVE_OCR_NATIVE,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const normalized = candidate.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
      }
      if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
      }
    }
  }

  return undefined;
};

const readExtraFlag = (): boolean | undefined => {
  try {
    const Constants = require('expo-constants');
    const extra =
      Constants?.expoConfig?.extra ?? Constants?.manifest?.extra ?? Constants?.expoGoConfig?.extra;
    const value = extra?.ocrNative;
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
      }
      if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Flags] Unable to read expo extra configuration.', error);
    }
  }

  return undefined;
};

const resolveFlag = (): boolean => {
  const envValue = readEnvFlag();
  if (typeof envValue === 'boolean') {
    return envValue;
  }

  const extraValue = readExtraFlag();
  if (typeof extraValue === 'boolean') {
    return extraValue;
  }

  return false;
};

export const flags: FeatureFlags = {
  ocrNative: resolveFlag(),
};
