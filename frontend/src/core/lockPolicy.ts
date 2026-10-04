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

/** The new process asks unless the dying process marked an unlocked icon change. */
export function askOnRelaunch(input: { lockEnabled: boolean; marked: boolean; phoneLocked: boolean; fullyClosed: boolean }): boolean {
  if (!input.lockEnabled) return false;
  if (input.phoneLocked) return true;
  if (input.fullyClosed) return true;
  if (input.marked) return false;
  return true;
}

/**
 * A screenshot on an unlocked phone does not ask.
 * The phone being locked, or the screen having turned off, still does.
 */
export function askAfterLeave(input: {
  lockEnabled: boolean;
  deviceLocked: boolean;
  screenTurnedOff: boolean;
  screenshot: boolean;
}): boolean {
  if (!input.lockEnabled) return false;
  if (input.screenshot && !input.deviceLocked) return false;
  if (input.deviceLocked) return true;
  if (input.screenTurnedOff) return true;
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
