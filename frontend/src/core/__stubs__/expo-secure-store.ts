// Inert namespace stubs for Expo/RN native modules that pure logic imports but
// never calls under `node --test`. Importing them must not touch a native runtime.
export const getItemAsync = async (_key: string): Promise<string | null> => null;
export const setItemAsync = async (_key: string, _value: string) => {};
export const deleteItemAsync = async (_key: string) => {};
export const isAvailableAsync = async () => false;
