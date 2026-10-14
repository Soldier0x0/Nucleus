// Test stub for @react-native-async-storage/async-storage (default export).
const store = new Map<string, string>();

const AsyncStorage = {
  getItem: async (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: async (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: async (key: string) => {
    store.delete(key);
  },
  clear: async () => {
    store.clear();
  },
  getAllKeys: async () => [...store.keys()],
};

export default AsyncStorage;
