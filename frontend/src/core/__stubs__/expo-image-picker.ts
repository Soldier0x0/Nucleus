// Inert namespace stub.
export const launchImageLibraryAsync = async () => ({
  canceled: true,
  assets: null as null | { uri: string }[],
});
export const launchCameraAsync = async () => ({
  canceled: true,
  assets: null as null | { uri: string }[],
});
export const requestCameraPermissionsAsync = async () => ({ granted: false });
export const requestMediaLibraryPermissionsAsync = async () => ({ granted: false });
