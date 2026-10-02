/**
 * Local encryption layer.
 *
 * - Everything written to AsyncStorage is encrypted with AES-256-GCM using a device key
 *   that is generated on first run and kept in Android Keystore / iOS Keychain (SecureStore).
 * - Backup files can be encrypted with a password (PBKDF2-SHA256 -> AES-256-GCM).
 * - Pure JS (@noble/ciphers) so it works on Hermes without native modules.
 */
import * as Crypto from "expo-crypto";
import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { secureStorage, storage } from "@/src/utils/storage";

const DEK_KEY = "nucleus.dek.v1";
const PREFIX = "NCE1."; // Nucleus Cipher Envelope v1
export const PBKDF2_ITERATIONS = 100_000;

export const randomBytes = (n: number) => Crypto.getRandomBytes(n);

// ---------- base64 ----------
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toB64(b: Uint8Array) {
  let out = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < b.length ? B64[n & 63] : "=");
  }
  return out;
}

export function fromB64(s: string) {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((clean[i + 2] ? B64.indexOf(clean[i + 2]) : 0) << 6) | (clean[i + 3] ? B64.indexOf(clean[i + 3]) : 0);
    out[p++] = (n >> 16) & 255;
    if (clean[i + 2]) out[p++] = (n >> 8) & 255;
    if (clean[i + 3]) out[p++] = n & 255;
  }
  return out.subarray(0, p);
}

// ---------- utf-8 (no TextEncoder dependency) ----------
export function toUtf8(s: string) {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const cp = 0x10000 + ((c & 0x3ff) << 10) + (s.charCodeAt(++i) & 0x3ff);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}

export function fromUtf8(b: Uint8Array) {
  const parts: string[] = [];
  let chunk: number[] = [];
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    if (c < 0x80) chunk.push(c);
    else if (c < 0xe0) chunk.push(((c & 31) << 6) | (b[i++] & 63));
    else if (c < 0xf0) chunk.push(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
    else {
      const u = (((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63)) - 0x10000;
      chunk.push(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
    }
    if (chunk.length >= 4096) {
      parts.push(String.fromCharCode(...chunk));
      chunk = [];
    }
  }
  if (chunk.length) parts.push(String.fromCharCode(...chunk));
  return parts.join("");
}

// ---------- device key ----------
let dek: Uint8Array | null = null;

export async function deviceKey() {
  if (dek) return dek;
  const existing = await secureStorage.getItem(DEK_KEY);
  if (existing) {
    dek = fromB64(existing);
    if (dek.length === 32) return dek;
  }
  dek = randomBytes(32);
  await secureStorage.setItem(DEK_KEY, toB64(dek));
  return dek;
}

/** True when a stored value is one of our AES-GCM envelopes. */
export const isEncrypted = (s: string) => s.startsWith(PREFIX);

export async function encryptString(plain: string) {
  const key = await deviceKey();
  const iv = randomBytes(12);
  const ct = gcm(key, iv).encrypt(toUtf8(plain));
  return `${PREFIX}${toB64(iv)}.${toB64(ct)}`;
}

export async function decryptString(envelope: string) {
  const [iv, ct] = envelope.slice(PREFIX.length).split(".");
  const key = await deviceKey();
  return fromUtf8(gcm(key, fromB64(iv)).decrypt(fromB64(ct)));
}

/** Read a JSON document that may be encrypted or (legacy) plaintext. */
export async function loadSecureDoc<T>(key: string): Promise<T | null> {
  const raw = await storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(isEncrypted(raw) ? await decryptString(raw) : raw) as T;
  } catch {
    return null;
  }
}

export async function saveSecureDoc(key: string, value: unknown) {
  await storage.setItem(key, await encryptString(JSON.stringify(value)));
}

// ---------- password-based (backups) ----------
export type PasswordEnvelope = { kdf: "pbkdf2-sha256"; iterations: number; salt: string; iv: string; ct: string };

async function passwordKey(password: string, salt: Uint8Array, iterations: number) {
  return pbkdf2Async(sha256, toUtf8(password), salt, { c: iterations, dkLen: 32 });
}

export async function encryptWithPassword(plain: string, password: string): Promise<PasswordEnvelope> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await passwordKey(password, salt, PBKDF2_ITERATIONS);
  return { kdf: "pbkdf2-sha256", iterations: PBKDF2_ITERATIONS, salt: toB64(salt), iv: toB64(iv), ct: toB64(gcm(key, iv).encrypt(toUtf8(plain))) };
}

export async function decryptWithPassword(env: PasswordEnvelope, password: string) {
  const key = await passwordKey(password, fromB64(env.salt), env.iterations);
  return fromUtf8(gcm(key, fromB64(env.iv)).decrypt(fromB64(env.ct)));
}

// ---------- password strength (deterministic, local) ----------
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string } {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const unique = new Set(pw).size;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10 && classes >= 2) score++;
  if (pw.length >= 14 && classes >= 3) score++;
  if (pw.length >= 18 && classes >= 3 && unique >= 10) score++;
  if (/^(.)\1+$/.test(pw) || /^(1234|0000|password|qwerty)/i.test(pw)) score = 0;
  const label = ["Too weak", "Weak", "Fair", "Strong", "Very strong"][score];
  const hint = score >= 3 ? "Good. Store it somewhere you won't lose it — there is no recovery." : pw.length < 12 ? "Use 12+ characters; a short phrase works well." : "Mix in another character type.";
  return { score: score as 0 | 1 | 2 | 3 | 4, label, hint };
}
