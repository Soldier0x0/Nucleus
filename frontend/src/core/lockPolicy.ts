import { launcherIconChange, type AliasComponentState } from "./launcher";

/** Why the app is coming to the front. A long stay in the background is not a reason by itself. */
export type LockSignal = "cold-start" | "phone-locked" | "still-unlocked";

/** An alias rewrite restarts the activity, so the lock treats it as a cold start. */
export function askAfterIconTap(input: {
  lockEnabled: boolean;
  states: Readonly<Record<string, AliasComponentState | undefined>>;
  nextAlias: string;
  phoneLocked: boolean;
  fullyClosed: boolean;
}): boolean {
  if (input.fullyClosed) return shouldAskBiometric(input.lockEnabled, "cold-start", 0);
  const plan = launcherIconChange(input.states, input.nextAlias);
  if (plan.changed) return shouldAskBiometric(input.lockEnabled, "cold-start", 0);
  if (input.phoneLocked) return shouldAskBiometric(input.lockEnabled, "phone-locked", 0);
  return shouldAskBiometric(input.lockEnabled, "still-unlocked", 0);
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
