import AsyncStorage from "@react-native-async-storage/async-storage";

export const storage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
  clear: () => AsyncStorage.clear(),
};

// Web preview has no secure enclave; fall back to namespaced local storage.
export const secureStorage = {
  getItem: (key: string) => AsyncStorage.getItem(`secure:${key}`),
  setItem: (key: string, value: string) => AsyncStorage.setItem(`secure:${key}`, value),
  removeItem: (key: string) => AsyncStorage.removeItem(`secure:${key}`),
};
