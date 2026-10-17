/** One line, shared by the phone (Today) and the desktop (sidebar). */
export function syncStatusLine(lastSyncAt: string | undefined, now: string): string {
  if (!lastSyncAt) return "Desktop sync: not paired yet";
  const mins = Math.max(0, Math.round((Date.parse(now) - Date.parse(lastSyncAt)) / 60000));
  if (!Number.isFinite(mins)) return "Desktop sync: not paired yet";
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `Synced ${h} h ago`;
  const d = Math.round(h / 24);
  return `Synced ${d} day${d === 1 ? "" : "s"} ago`;
}

/**
 * The desktop's side of the same clock (v0.12 reverse freshness): from the
 * desktop the interesting fact is when the phone was last here, not the
 * desktop's own sync.
 */
export function lastSeenLine(lastSyncAt: string | undefined, now: string): string {
  if (!lastSyncAt) return "Phone not paired yet";
  const mins = Math.max(0, Math.round((Date.parse(now) - Date.parse(lastSyncAt)) / 60000));
  if (!Number.isFinite(mins)) return "Phone not paired yet";
  if (mins < 2) return "Phone last seen just now";
  if (mins < 60) return `Phone last seen ${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `Phone last seen ${h}h ago`;
  const d = Math.round(h / 24);
  return `Phone last seen ${d}d ago`;
}
