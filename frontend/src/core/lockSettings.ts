import type { Settings } from "./types";

export type UnlockMethod = Settings["unlockMethod"];

/** When app lock is turned on, prefer biometrics when the device has enrolled hardware. */
export function unlockSettingsForNewLock(biometricsAvailable: boolean): Pick<Settings, "unlockMethod" | "biometricEnabled"> {
  if (biometricsAvailable) return { unlockMethod: "both", biometricEnabled: true };
  return { unlockMethod: "pin", biometricEnabled: false };
}

export const LOCK_TIMEOUT_OPTIONS: { sec: number; label: string }[] = [
  { sec: 0, label: "Immediately" },
  { sec: 30, label: "30 seconds" },
  { sec: 60, label: "1 minute" },
  { sec: 300, label: "5 minutes" },
];

export function lockTimeoutLabel(sec: number): string {
  const row = LOCK_TIMEOUT_OPTIONS.find((o) => o.sec === sec);
  return row?.label ?? `${sec} seconds`;
}
