const store = new Map();

const AsyncStorage = {
  async getItem(key) {
    if (store.has(key)) {
      return store.get(key);
    }
    return null;
  },
  async setItem(key, value) {
    store.set(key, value);
    return null;
  },
  async removeItem(key) {
    store.delete(key);
    return null;
  },
  async clear() {
    store.clear();
    return null;
  },
  async getAllKeys() {
    return Array.from(store.keys());
  },
  async multiGet(keys) {
    return keys.map(key => [key, store.has(key) ? store.get(key) : null]);
  },
  async multiSet(entries) {
    entries.forEach(([key, value]) => {
      store.set(key, value);
    });
    return null;
  },
  async multiRemove(keys) {
    keys.forEach(key => {
      store.delete(key);
    });
    return null;
  },
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
