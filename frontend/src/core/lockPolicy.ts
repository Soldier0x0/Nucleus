import type { AliasComponentState } from "./launcher";

/** Why the app is coming to the front. A long stay in the background is not a reason by itself. */
export type LockSignal = "cold-start" | "phone-locked" | "still-unlocked";

/**
 * An icon change restarts the process. The phone is still unlocked across that restart,
 * so the thumbprint waits for a real lock or a full close.
 */
export function askAfterIconTap(input: {
  lockEnabled: boolean;
  states: Readonly<Record<string, AliasComponentState | undefined>>;
  nextAlias: string;
  phoneLocked: boolean;
  fullyClosed: boolean;
}): boolean {
  if (!input.lockEnabled) return false;
  if (input.fullyClosed) return true;
  if (input.phoneLocked) return true;
  return false;
}

/** A new process with app lock on always asks, including after an icon change or install-over. */
export function askOnRelaunch(input: { lockEnabled: boolean; marked: boolean; phoneLocked: boolean; fullyClosed: boolean }): boolean {
  if (!input.lockEnabled) return false;
  if (input.phoneLocked) return true;
  if (input.fullyClosed) return true;
  return true;
}

/**
 * Returning from background: phone lock and screen-off always relock.
 * Background longer than lockTimeoutSec relocks. A screenshot alone does not block those.
 * Within the grace period, a screenshot on an unlocked phone does not relock.
 */
export function askAfterLeave(input: {
  lockEnabled: boolean;
  deviceLocked: boolean;
  screenTurnedOff: boolean;
  screenshot: boolean;
  backgroundMs: number;
  lockTimeoutSec: number;
  externalActivity: boolean;
}): boolean {
  if (!input.lockEnabled) return false;
  if (input.externalActivity) return false;
  if (input.deviceLocked) return true;
  if (input.screenTurnedOff) return true;
  const graceMs = Math.max(0, input.lockTimeoutSec) * 1000;
  if (input.backgroundMs >= graceMs) return true;
  if (input.screenshot) return false;
  return false;
}

export function shouldAskBiometric(lockEnabled: boolean, signal: LockSignal, _backgroundMs: number): boolean {
  if (!lockEnabled) return false;
  switch (signal) {
    case "cold-start":
    case "phone-locked":
      return true;
    case "still-unlocked":
      return false;
    default: {
      const unreachable: never = signal;
      return unreachable;
    }
  }
}
