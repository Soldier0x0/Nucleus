/**
 * Webview stand-in for the phone's expo-crypto. Only the surface
 * frontend/src/core/crypto.ts uses is implemented; randomness comes from
 * the webview's own CSPRNG.
 */
export function getRandomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

export function digestStringAsync(algorithm: string, data: string): Promise<string> {
  return globalThis.crypto.subtle
    .digest(algorithm, new TextEncoder().encode(data))
    .then((buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join(""));
}
