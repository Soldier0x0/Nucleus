/**
 * Desktop PIN handling.
 *
 * security.ts on the phone cannot be imported here (it pulls in expo-crypto,
 * expo-local-authentication and react-native), so the hash is ported exactly:
 * 200 rounds of SHA-256 over `h + salt` starting from `salt + pin`, hex encoded.
 * The PIN record lives inside the Stronghold-encrypted vault (see secure.ts);
 * only the wrong-PIN back-off counter is kept in the open (it holds no secret).
 */
export type PinRecord = { salt: string; h: string };

export const PIN_MIN_DIGITS = 4;

export const isValidPin = (pin: string) => /^\d{4,}$/.test(pin);

export async function digestSha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  let out = "";
  for (const b of new Uint8Array(buf)) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Same construction as the phone's security.ts hash(). */
export async function hashPin(pin: string, salt: string): Promise<string> {
  let h = salt + pin;
  for (let i = 0; i < 200; i++) h = await digestSha256Hex(h + salt);
  return h;
}

export async function makePinRecord(pin: string): Promise<PinRecord> {
  const salt = globalThis.crypto.randomUUID();
  return { salt, h: await hashPin(pin, salt) };
}

export async function verifyPinRecord(record: PinRecord, pin: string): Promise<boolean> {
  if (!record?.salt || !record?.h) return false;
  const h = await hashPin(pin, record.salt);
  if (h.length !== record.h.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ record.h.charCodeAt(i);
  return diff === 0;
}

// ---------- wrong-PIN back-off (same schedule as the phone) ----------
export type Backoff = { fails: number; until: number };

export function nextBackoff(prev: Backoff, now = Date.now()): Backoff {
  const fails = prev.fails + 1;
  const over = fails - 5;
  const wait = over > 0 ? Math.min(30 * 2 ** (over - 1), 1800) : 0;
  return { fails, until: wait ? now + wait * 1000 : 0 };
}

export const backoffRemainingMs = (b: Backoff, now = Date.now()) => Math.max(0, b.until - now);

export function backoffLabel(ms: number): string {
  const secs = Math.ceil(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.ceil(secs / 60)} min`;
}
