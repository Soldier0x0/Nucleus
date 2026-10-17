/**
 * The sync pill: one glanceable state beside the online chip (v0.12).
 *
 * Pure decode: given the freshest sync facts, decide the pill's state and
 * label. Colors are the caller's business. No toasts anywhere — the pill and
 * the Sync settings screen are the only surfaces that show sync state.
 */
import type { PairedDevice } from "./types";

export type PillState = "synced" | "off-network" | "stale";

export type SyncPillInput = {
  /** None when no desktop is paired yet — the pill hides itself. */
  devices: PairedDevice[];
  /** Top-level settings.lastSyncAt, or undefined. */
  lastSyncAt: string | undefined;
  /** ms timestamp of the last failed attempt, or null when none failed. */
  lastFailedAt: number | null;
  now: number;
};

/** A day of failed or absent rounds is the brow-furrow threshold. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function freshLabel(lastGoodMs: number, now: number): string {
  const ms = now - lastGoodMs;
  if (ms < 90_000) return "Synced";
  if (ms < 3_600_000) return `Synced ${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `Synced ${Math.floor(ms / 3_600_000)}h ago`;
  return `Synced ${Math.floor(ms / 86_400_000)}d ago`;
}

/**
 * State order (locked decision):
 * - synced:        every pair rounded within the freshness window.
 * - off-network:   paired but out of touch (not synced yet this session or
 *                  the desktop is unheard from) — the amber wait state.
 * - stale:         last attempt failed ~a day ago (or never succeeded).
 */
export function decodePill(input: SyncPillInput): { state: PillState; label: string } {
  if (input.devices.length === 0) return { state: "off-network", label: "Pair a desktop" };
  const newest = input.devices.reduce((acc, d) => {
    const t = d.lastSyncAt ? Date.parse(d.lastSyncAt) : NaN;
    return Number.isNaN(t) ? acc : Math.max(acc, t);
  }, Number.NEGATIVE_INFINITY);
  const top = input.lastSyncAt ? Date.parse(input.lastSyncAt) : NaN;
  const lastGood = Math.max(Number.isNaN(top) ? Number.NEGATIVE_INFINITY : top, newest);
  if (!Number.isFinite(lastGood)) {
    // Never a successful round: a recent failure stays amber, otherwise wait.
    if (input.lastFailedAt !== null && input.now - input.lastFailedAt < STALE_AFTER_MS)
      return { state: "off-network", label: "Last attempt failed" };
    return { state: "off-network", label: "Not synced yet" };
  }
  if (input.now - lastGood < STALE_AFTER_MS) return { state: "synced", label: freshLabel(lastGood, input.now) };
  return { state: "stale", label: "Not synced in a day" };
}
