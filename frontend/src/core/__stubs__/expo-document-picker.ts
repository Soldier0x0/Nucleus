// Inert namespace stub. Pure logic under test never invokes the picker.
export const getDocumentAsync = async () => ({
  canceled: true,
  assets: null as null | { uri: string; name: string; size: number }[],
});
