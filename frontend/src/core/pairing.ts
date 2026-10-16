/**
 * Pairing keys and sealed messages for desktop sync (plan D2).
 *
 * - Each side makes an X25519 key pair; public keys travel in the pairing QR.
 * - The one-time 6-digit code salts an HKDF over the ECDH secret, so a device
 *   that only saw the QR still cannot read messages without the typed code.
 * - Messages use AES-256-GCM in the same envelope style as crypto.ts (NCE1).
 * - Everything here is pure and Hermes-safe (@noble, no native modules).
 */
import { x25519 } from "@noble/curves/ed25519.js";
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import type { DB, PairedDevice } from "./types";
import { fromB64, fromUtf8, randomBytes, toB64, toUtf8 } from "./crypto";

export const PAIR_QR_TAG = "nucleus-pair-1";
const PAIR_INFO = "nucleus-pair-v1";
const PROOF_TEXT = "nucleus-pair-proof";
/** Nucleus Pair Sealed v1, mirroring crypto.ts NCE1. */
const SEAL_PREFIX = "NPS1.";

export type DeviceKeyPair = { publicKey: string; privateKey: string };
export type PairQr = { deviceId: string; name: string; publicKey: string; host: string; port: number; code: string };

/** 32-byte keys as canonical base64 (44 chars, padded). */
function isKeyB64(s: string): boolean {
  return s.length > 0 && toB64(fromB64(s)) === s && fromB64(s).length === 32;
}

function keyBytes(b64: string): Uint8Array {
  const bytes = fromB64(b64);
  if (bytes.length !== 32) throw new Error("Pair key must be 32 bytes");
  return bytes;
}

export function newDeviceKeyPair(): DeviceKeyPair {
  const privateKey = randomBytes(32);
  return { privateKey: toB64(privateKey), publicKey: toB64(x25519.getPublicKey(privateKey)) };
}

/** The QR the desktop shows: `{ deviceId, name, public key, LAN host/port, one-time code }`. */
export function pairQrPayload(input: PairQr): string {
  return JSON.stringify({ t: PAIR_QR_TAG, deviceId: input.deviceId, name: input.name, publicKey: input.publicKey, host: input.host, port: input.port, code: input.code });
}

/** Strict reader for pairQrPayload. Anything malformed is null, never a throw. */
export function parsePairQrPayload(text: string): PairQr | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (row.t !== PAIR_QR_TAG) return null;
  const deviceId = typeof row.deviceId === "string" ? row.deviceId.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const host = typeof row.host === "string" ? row.host.trim() : "";
  const publicKey = typeof row.publicKey === "string" ? row.publicKey : "";
  const code = typeof row.code === "string" ? row.code : "";
  const port = typeof row.port === "number" ? row.port : Number.NaN;
  if (!deviceId || !name || !host) return null;
  if (!isKeyB64(publicKey)) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (!/^\d{6}$/.test(code)) return null;
  return { deviceId, name, publicKey, host, port, code };
}

/** HKDF-SHA256 over the X25519 shared secret, salted with the one-time code. */
export function derivePairKey(privateKeyB64: string, theirPublicKeyB64: string, code: string): string {
  const secret = x25519.getSharedSecret(keyBytes(privateKeyB64), keyBytes(theirPublicKeyB64));
  return toB64(hkdf(sha256, secret, toUtf8(code), toUtf8(PAIR_INFO), 32));
}

export function sealMessage(pairKeyB64: string, payload: unknown): string {
  const iv = randomBytes(12);
  const ct = gcm(keyBytes(pairKeyB64), iv).encrypt(toUtf8(JSON.stringify(payload)));
  return `${SEAL_PREFIX}${toB64(iv)}.${toB64(ct)}`;
}

/** Throws a DataUnreadable-style Error on a wrong key, tampering or a bad envelope. */
export function openMessage(pairKeyB64: string, sealed: string): unknown {
  const parts = sealed.startsWith(SEAL_PREFIX) ? sealed.slice(SEAL_PREFIX.length).split(".") : [];
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("Sealed message is invalid");
  const plain = fromUtf8(gcm(keyBytes(pairKeyB64), fromB64(parts[0])).decrypt(fromB64(parts[1])));
  return JSON.parse(plain);
}

export function pairProof(pairKeyB64: string): string {
  return toB64(hmac(sha256, keyBytes(pairKeyB64), toUtf8(PROOF_TEXT)));
}

export function verifyPairProof(pairKeyB64: string, proofB64: string): boolean {
  const expected = fromB64(pairProof(pairKeyB64));
  const got = fromB64(proofB64);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ got[i];
  return diff === 0;
}

export function addPairedDevice(db: DB, dev: PairedDevice): DB {
  const kept = (db.settings.pairedDevices ?? []).filter((d) => d.id !== dev.id);
  return { ...db, settings: { ...db.settings, pairedDevices: [...kept, dev] } };
}

export function removePairedDevice(db: DB, id: string): DB {
  return { ...db, settings: { ...db.settings, pairedDevices: (db.settings.pairedDevices ?? []).filter((d) => d.id !== id) } };
}

export function pairedDeviceById(db: DB, id: string): PairedDevice | undefined {
  return (db.settings.pairedDevices ?? []).find((d) => d.id === id);
}
