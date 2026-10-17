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
/** Backoff cap: a silent failure may not wake the timer more often than this. */
export const RETRY_MAX_MS = 5 * 60_000;

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

/**
 * Silent-failure backoff: the round still retries in the usual cadence, but
 * each consecutive miss doubles the wait (2/4/5/5... minutes, capped). A
 * success or a manual sync resets the ladder.
 */
export function backoffMs(consecutiveFailures: number): number {
  const step = 2 ** Math.max(0, consecutiveFailures - 1);
  return Math.min(RETRY_MS * step, RETRY_MAX_MS);
}

/**
 * True when the next retry is due: the base retry clock, widened by the
 * current failure streak. A due local change always wins.
 */
export function retryDue(input: AutoSyncInput & { consecutiveFailures: number }): boolean {
  if (input.lastAttemptAt === null) return true;
  return input.now - input.lastAttemptAt >= backoffMs(input.consecutiveFailures);
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
export function shouldSyncNow(input: AutoSyncInput & { consecutiveFailures?: number }): boolean {
  if (!input.appActive || !input.unlocked || input.pairedCount <= 0 || input.inFlight) return false;
  if (hasPendingLocalChange(input)) return true;
  return retryDue({ ...input, consecutiveFailures: input.consecutiveFailures ?? 0 });
}
