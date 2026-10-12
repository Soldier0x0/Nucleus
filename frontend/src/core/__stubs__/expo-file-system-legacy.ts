// Test stub for expo-file-system/legacy.
export const EncodingType = {
  UTF8: "utf8",
  Base64: "base64",
} as const;

export async function readAsStringAsync(
  _uri: string,
  _options?: { encoding?: string },
): Promise<string> {
  return "";
}
