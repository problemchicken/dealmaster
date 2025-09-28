import {Platform} from 'react-native';

type SecureStorageModule = {
  setItem: (key: string, value: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
};

type MemoryStore = Map<string, string>;

const memoryStore: MemoryStore = new Map();

let secureModule: SecureStorageModule | null = null;

try {
  // Dynamically resolve the native encrypted storage implementation when available.
  secureModule = require('react-native-encrypted-storage');
} catch (error) {
  if (__DEV__) {
    console.warn(
      '[secureStorage] Falling back to in-memory storage. Install react-native-encrypted-storage for production builds.',
    );
  }
}

const fallbackMessage =
  '[secureStorage] Using non-persistent memory fallback. Install react-native-encrypted-storage for secure persistence.';

const secureStorage = {
  async setItem(key: string, value: string) {
    if (secureModule) {
      await secureModule.setItem(key, value);
      return;
    }

    if (__DEV__ && Platform.OS === 'web') {
      console.warn(fallbackMessage);
    }

    memoryStore.set(key, value);
  },
  async getItem(key: string) {
    if (secureModule) {
      return secureModule.getItem(key);
    }

    if (__DEV__ && Platform.OS === 'web') {
      console.warn(fallbackMessage);
    }

    return memoryStore.get(key) ?? null;
  },
  async removeItem(key: string) {
    if (secureModule) {
      await secureModule.removeItem(key);
      return;
    }

    if (__DEV__ && Platform.OS === 'web') {
      console.warn(fallbackMessage);
    }

    memoryStore.delete(key);
  },
};

export default secureStorage;
