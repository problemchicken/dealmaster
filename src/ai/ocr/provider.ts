import {Platform} from 'react-native';

import {flags} from '../../config/featureFlags';

export type OcrProvider = {
  extractText: (uri: string) => Promise<string>;
};

const stubProvider: OcrProvider = {
  async extractText() {
    return '';
  },
};

let cachedProvider: OcrProvider | null = null;

const loadIosProvider = (): OcrProvider | null => {
  try {
    const {createIosProvider} = require('./iosProvider');
    if (typeof createIosProvider === 'function') {
      return createIosProvider();
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[OCR] Unable to load iOS provider. Falling back to stub.', error);
    }
  }

  return null;
};

const loadAndroidProvider = (): OcrProvider | null => {
  try {
    const {createAndroidProvider} = require('./androidProvider');
    if (typeof createAndroidProvider === 'function') {
      return createAndroidProvider();
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[OCR] Unable to load Android provider. Falling back to stub.', error);
    }
  }

  return null;
};

export const getOcrProvider = (): OcrProvider => {
  if (cachedProvider) {
    return cachedProvider;
  }

  if (!flags.ocrNative) {
    cachedProvider = stubProvider;
    return cachedProvider;
  }

  if (Platform.OS === 'ios') {
    const provider = loadIosProvider();
    if (provider) {
      cachedProvider = provider;
      return provider;
    }
  }

  if (Platform.OS === 'android') {
    const provider = loadAndroidProvider();
    if (provider) {
      cachedProvider = provider;
      return provider;
    }
  }

  cachedProvider = stubProvider;
  return cachedProvider;
};

export const __TESTING__ = {
  stubProvider,
  loadIosProvider,
  loadAndroidProvider,
};
