/** Why the app is coming to the front. A long stay in the background is not a reason by itself. */
export type LockSignal = "cold-start" | "phone-locked" | "still-unlocked";

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
