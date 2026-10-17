import { useSyncExternalStore } from "react";

/**
 * Live sync facts for the current app session (v0.12). The pill and the Sync
 * settings screen read this; syncWithDesktop writes it. Rounds are silent —
 * this store is the only place a failure becomes visible.
 */
export type SyncSignal = {
  running: boolean;
  /** Wall-clock ms of the last failed attempt this session, null when none. */
  lastFailedAt: number | null;
  /** Wall-clock ms of the last finished round (success), null when none. */
  lastRoundAt: number | null;
};

let state: SyncSignal = { running: false, lastFailedAt: null, lastRoundAt: null };
const listeners = new Set<() => void>();

function publish(next: SyncSignal) {
  state = next;
  for (const listener of listeners) listener();
}

export function noteSyncStarted() {
  publish({ ...state, running: true, lastFailedAt: null });
}

export function noteSyncFailed(now = Date.now()) {
  publish({ running: false, lastFailedAt: now, lastRoundAt: state.lastRoundAt });
}

export function noteSyncFinished(now = Date.now()) {
  publish({ running: false, lastFailedAt: null, lastRoundAt: now });
}

export function getSyncSignal(): SyncSignal {
  return state;
}

export function useSyncSignal(): SyncSignal {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSyncSignal,
    getSyncSignal,
  );
}
