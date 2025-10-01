const storage = new Map();

const normalizeKey = key => {
  if (typeof key !== 'string') {
    throw new TypeError('AsyncStorage keys must be strings');
  }
  return key;
};

const AsyncStorage = {
  async getItem(key) {
    return storage.has(normalizeKey(key)) ? storage.get(key) ?? null : null;
  },

  async setItem(key, value) {
    storage.set(normalizeKey(key), String(value));
  },

  async removeItem(key) {
    storage.delete(normalizeKey(key));
  },

  async clear() {
    storage.clear();
  },

  async getAllKeys() {
    return Array.from(storage.keys());
  },

  async multiGet(keys) {
    if (!Array.isArray(keys)) {
      throw new TypeError('multiGet expects an array of keys');
    }
    return Promise.all(keys.map(async key => [key, await AsyncStorage.getItem(key)]));
  },

  async multiSet(entries) {
    if (!Array.isArray(entries)) {
      throw new TypeError('multiSet expects an array of key/value tuples');
    }
    for (const [key, value] of entries) {
      await AsyncStorage.setItem(key, value);
    }
  },
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
