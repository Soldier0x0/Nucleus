/**
 * Desktop port of the phone's local encryption layer (frontend/src/core/crypto.ts).
 *
 * Formats MUST stay byte-compatible with the phone in both directions:
 * - device documents: "NCE1." + base64(iv) + "." + base64(AES-256-GCM ciphertext)
 * - password backups: { kdf: "pbkdf2-sha256", iterations, salt, iv, ct } (all base64)
 *
 * This file is intentionally free of Tauri, React Native and Expo imports so it
 * can run under `node --test` (see frontend/src/core/desktopCompat.test.ts).
 */
import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const PREFIX = "NCE1."; // Nucleus Cipher Envelope v1
export const PBKDF2_ITERATIONS = 600_000;
/** Long is enough; a hostile envelope naming 4 billion rounds would freeze the app. */
export const PBKDF2_ITERATIONS_MAX = 10_000_000;

export class DataUnreadableError extends Error {
  constructor(message = "Could not open saved data") {
    super(message);
    this.name = "DataUnreadableError";
  }
}

export const randomBytes = (n: number): Uint8Array => {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
};

export const randomId = () => globalThis.crypto.randomUUID();

// ---------- base64 (same alphabet and padding as the phone) ----------
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

// ---------- utf-8 (same routines as the phone) ----------
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

// ---------- device-key envelopes ----------
export const isEncrypted = (s: string) => s.startsWith(PREFIX);

export function sealString(plain: string, key: Uint8Array) {
  const iv = randomBytes(12);
  const ct = gcm(key, iv).encrypt(toUtf8(plain));
  return `${PREFIX}${toB64(iv)}.${toB64(ct)}`;
}

export function openString(envelope: string, key: Uint8Array) {
  const parts = envelope.slice(PREFIX.length).split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new DataUnreadableError("Envelope is invalid");
  const [iv, ct] = parts;
  try {
    return fromUtf8(gcm(key, fromB64(iv)).decrypt(fromB64(ct)));
  } catch {
    throw new DataUnreadableError("Could not open saved data");
  }
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
  const iterations = Math.min(env.iterations, PBKDF2_ITERATIONS_MAX);
  const key = await passwordKey(password, fromB64(env.salt), iterations);
  return fromUtf8(gcm(key, fromB64(env.iv)).decrypt(fromB64(env.ct)));
}

// ---------- password strength (ported verbatim from the phone) ----------
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
