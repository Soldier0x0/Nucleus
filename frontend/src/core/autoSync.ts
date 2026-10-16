/**
 * When the phone may start an automatic sync round (desktop plan D2).
 *
 * Pure decision only: the caller owns the clock, the lock signal, the paired
 * list and the in-flight flag. A local change is sent once it is at least
 * DEBOUNCE_MS old; with nothing new, a round still runs every RETRY_MS so
 * both sides catch up while the app stays open. A change already carried by a
 * completed round — including data a sync applied — never counts again.
 */

export const DEBOUNCE_MS = 5000;
export const RETRY_MS = 120000;

export type PendingChangeInput = {
  now: number;
  /** Wall-clock ms of the last local edit, or null when this session made none. */
  lastLocalChangeAt: number | null;
  /** Wall-clock ms of the local edit the last completed round carried. */
  selfAppliedRevisionMarker?: number | null;
};

/** Has a local edit waited out the debounce and not gone out in a completed round? */
export function hasPendingLocalChange(input: PendingChangeInput): boolean {
  if (input.lastLocalChangeAt === null) return false;
  if (input.selfAppliedRevisionMarker != null && input.lastLocalChangeAt <= input.selfAppliedRevisionMarker) return false;
  return input.now - input.lastLocalChangeAt >= DEBOUNCE_MS;
}

export type AutoSyncInput = PendingChangeInput & {
  appActive: boolean;
  unlocked: boolean;
  pairedCount: number;
  inFlight: boolean;
  /** Wall-clock ms the last round started, shared by manual and automatic syncs. */
  lastAttemptAt: number | null;
};

/** True only when the app and vault are open, a desktop is paired, and there is work or a retry is due. */
export function shouldSyncNow(input: AutoSyncInput): boolean {
  if (!input.appActive || !input.unlocked || input.pairedCount <= 0 || input.inFlight) return false;
  if (hasPendingLocalChange(input)) return true;
  return input.lastAttemptAt === null || input.now - input.lastAttemptAt >= RETRY_MS;
}
