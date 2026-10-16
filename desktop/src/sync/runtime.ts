/**
 * Live sync state shared between the React shell and the HTTP handler.
 *
 * The store registers a small runtime here while the document is open, and the
 * Pair screen publishes the one-time code it currently shows. Sync summaries
 * ("12 in, 3 out") are kept in memory only: the core PairedDevice record has no
 * room for them and normalizeDB keeps its four known fields.
 */
import type { DB } from "@core/types";
import type { DesktopSyncIdentity } from "./identity";

type Runtime = {
  identity: () => DesktopSyncIdentity | null;
  db: () => DB;
  apply: (fn: (db: DB) => DB) => void;
};

let runtime: Runtime | null = null;
let pairCode: string | null = null;

export function setSyncRuntime(next: Runtime | null): void {
  runtime = next;
}

export function getSyncRuntime(): Runtime | null {
  return runtime;
}

export function setPairCode(code: string | null): void {
  pairCode = code;
}

export function currentPairCode(): string | null {
  return pairCode;
}

export type SyncSummary = { at: string; inCount: number; outCount: number };

let summaries: Record<string, SyncSummary> = {};
const listeners = new Set<() => void>();

function changed(): void {
  for (const listener of listeners) listener();
}

export function noteSyncSummary(deviceId: string, summary: SyncSummary): void {
  summaries = { ...summaries, [deviceId]: summary };
  changed();
}

export function forgetSyncSummary(deviceId: string): void {
  if (!(deviceId in summaries)) return;
  const next = { ...summaries };
  delete next[deviceId];
  summaries = next;
  changed();
}

export function syncSummaries(): Record<string, SyncSummary> {
  return summaries;
}

export function subscribeSyncSummaries(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
