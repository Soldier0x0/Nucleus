import { useSyncExternalStore } from "react";

/**
 * What the lock gate is doing right now. "unknown" until LockGate says
 * otherwise, so boot screens never assume the vault is open.
 */
export type LockSignalState = "unknown" | "locked" | "unlocked";

let state: LockSignalState = "unknown";
const listeners = new Set<() => void>();

export function publishLockState(locked: boolean) {
  const next: LockSignalState = locked ? "locked" : "unlocked";
  if (state === next) return;
  state = next;
  for (const listener of listeners) listener();
}

export function getLockSignal(): LockSignalState {
  return state;
}

export function useLockSignal(): LockSignalState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getLockSignal,
    getLockSignal,
  );
}
