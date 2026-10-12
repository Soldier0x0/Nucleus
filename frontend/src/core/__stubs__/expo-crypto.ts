// Test stub for expo-crypto, backed by Node's built-in crypto so the pure
// logic in crypto.ts / security.ts can run under `node --test` with no native
// runtime. Only the surface Nucleus actually uses is implemented.
import nodeCrypto from "node:crypto";

export const CryptoDigestAlgorithm = {
  SHA1: "SHA-1",
  SHA256: "SHA-256",
  SHA512: "SHA-512",
  MD2: "MD2",
  MD5: "MD5",
} as const;

export function getRandomBytes(length: number): Uint8Array {
  return new Uint8Array(nodeCrypto.randomBytes(length));
}

export function randomUUID(): string {
  return nodeCrypto.randomUUID();
}

export async function digestStringAsync(
  algorithm: string,
  data: string,
): Promise<string> {
  const nodeAlg = algorithm === "SHA-256" ? "sha256" : algorithm.toLowerCase();
  return nodeCrypto.createHash(nodeAlg).update(data, "utf8").digest("hex");
}
