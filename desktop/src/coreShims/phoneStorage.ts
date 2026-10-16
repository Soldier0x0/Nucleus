/**
 * Inert stand-in for the phone's @/src/utils/storage. Shared core modules that
 * desktop imports (pairing -> crypto) name this module at the top, but the
 * desktop keeps its document in platform/document.ts and never reaches here.
 */
const bucket = new Map<string, string>();

export const storage = {
  getItem: async (key: string) => bucket.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    bucket.set(key, value);
  },
  removeItem: async (key: string) => {
    bucket.delete(key);
  },
  clear: async () => {
    bucket.clear();
  },
};

export const secureStorage = {
  getItem: async (key: string) => bucket.get(`secure:${key}`) ?? null,
  setItem: async (key: string, value: string) => {
    bucket.set(`secure:${key}`, value);
  },
  removeItem: async (key: string) => {
    bucket.delete(`secure:${key}`);
  },
};
