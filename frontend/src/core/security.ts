import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";
import { secureStorage } from "@/src/utils/storage";

const PIN_KEY = "nucleus.pin.v1";
const LEGACY_PIN_KEY = "tessera.pin.v1";
const readPin = async () => (await secureStorage.getItem(PIN_KEY)) ?? (await secureStorage.getItem(LEGACY_PIN_KEY));

async function hash(pin: string, salt: string) {
  // Iterated SHA-256 (key stretching) — PIN hash lives in Android Keystore-backed SecureStore.
  let h = salt + pin;
  for (let i = 0; i < 200; i++) h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, h + salt);
  return h;
}

export async function setPin(pin: string) {
  const salt = Crypto.randomUUID();
  const h = await hash(pin, salt);
  await secureStorage.setItem(PIN_KEY, JSON.stringify({ salt, h }));
}

export async function hasPin() {
  return !!(await readPin());
}

export async function verifyPin(pin: string) {
  const raw = await readPin();
  if (!raw) return false;
  const { salt, h } = JSON.parse(raw);
  return (await hash(pin, salt)) === h;
}

export async function clearPin() {
  await secureStorage.removeItem(PIN_KEY);
  await secureStorage.removeItem(LEGACY_PIN_KEY);
}

// ---------- wrong-PIN back-off ----------
const BACKOFF_KEY = "nucleus.backoff.v1";
export type Backoff = { fails: number; until: number };

export async function readBackoff(): Promise<Backoff> {
  try {
    const raw = await secureStorage.getItem(BACKOFF_KEY);
    return raw ? JSON.parse(raw) : { fails: 0, until: 0 };
  } catch {
    return { fails: 0, until: 0 };
  }
}

/** 5 free attempts, then 30s, 60s, 120s … (capped at 30 min). */
export async function registerFailure(): Promise<Backoff> {
  const b = await readBackoff();
  const fails = b.fails + 1;
  const over = fails - 5;
  const wait = over > 0 ? Math.min(30 * 2 ** (over - 1), 1800) : 0;
  const next = { fails, until: wait ? Date.now() + wait * 1000 : 0 };
  await secureStorage.setItem(BACKOFF_KEY, JSON.stringify(next));
  return next;
}

export async function clearFailures() {
  await secureStorage.removeItem(BACKOFF_KEY);
}

export async function biometricAvailable() {
  if (Platform.OS === "web") return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function biometricUnlock() {
  if (Platform.OS === "web") return false;
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Nucleus", cancelLabel: "Use PIN", disableDeviceFallback: true });
  return r.success;
}
