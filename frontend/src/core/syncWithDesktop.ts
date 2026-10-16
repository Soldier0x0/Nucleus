/**
 * One sync round with a paired desktop (desktop plan D2).
 *
 * The settings screen and the background auto-sync both come through here, so
 * the request, the sealed reply, the vault follow-up and the error codes never
 * drift apart. Rounds never overlap: a caller that arrives while one is
 * running joins it, and the shared attempt time keeps auto-sync from firing
 * right after a manual round.
 */
import type { DB, PairedDevice } from "./types";
import { applySyncResponse, buildSyncRequest, buildVaultUpload, desktopAddress, SyncError, type SyncSummary } from "./syncClient";
import { postSyncJson } from "./syncTransport";

export type SyncRound = { db: DB; summary: SyncSummary };

export type SyncRoundOptions = {
  /** Background callers show nothing, so progress callbacks are skipped. */
  silent?: boolean;
  onProgress?: (line: string) => void;
};

let inFlight: Promise<SyncRound> | null = null;
let lastAttemptAt: number | null = null;

export function syncInFlight(): boolean {
  return inFlight !== null;
}

/** When the last round started, whichever caller — manual or automatic — began it. */
export function syncLastAttemptAt(): number | null {
  return lastAttemptAt;
}

async function runRound(db: DB, device: PairedDevice, options: SyncRoundOptions): Promise<SyncRound> {
  const address = desktopAddress(db, device.id);
  if (!address) throw new SyncError("bad-address");
  lastAttemptAt = Date.now();
  const progress = options.silent ? () => {} : (options.onProgress ?? (() => {}));
  progress("Syncing…");
  const first = await postSyncJson(address.host, address.port, "/sync", buildSyncRequest(db, device));
  const round = applySyncResponse(db, device, first.body);
  let merged = round.db;
  if (round.needFromPhone.length) {
    progress("Sending files…");
    const follow = await postSyncJson(address.host, address.port, "/sync", buildVaultUpload(merged, device, round.needFromPhone));
    merged = applySyncResponse(merged, device, follow.body).db;
  }
  return { db: merged, summary: round.summary };
}

/** Run one round, or join the round already running. */
export function syncWithDesktop(db: DB, device: PairedDevice, options: SyncRoundOptions = {}): Promise<SyncRound> {
  if (inFlight) return inFlight;
  const round = runRound(db, device, options).finally(() => {
    inFlight = null;
  });
  inFlight = round;
  return round;
}
