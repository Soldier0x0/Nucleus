import type { Settings } from "./types";

/** Hours the last screen is remembered. 0 and null both mean "do not reopen". */
export const REOPEN_DEFAULT_HOURS = 3;
const MAX_REOPEN_HOURS = 24 * 30;
const MAX_ROUTE = 120;
const MAX_STAMP = 40;

/**
 * Routes that are not worth remembering: the boot redirect, onboarding,
 * capture sheets, and one-shot pickers.
 */
const BLOCKED_PREFIXES = ["/onboarding", "/capture", "/open", "/record"];

/** True for a screen the person can come back to: not a sheet, picker, or the boot redirect. */
export function isContentRoute(path: unknown): path is string {
  if (typeof path !== "string" || path.length < 2 || !path.startsWith("/")) return false;
  return !BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export type ReopenPatch = { lastRoute: string; lastRouteAt: string };

/** The settings patch that remembers `path` at `at`, or null when nothing changed. */
export function recordRoute(settings: Pick<Settings, "lastRoute" | "lastRouteAt">, path: string, at: string): ReopenPatch | null {
  if (!isContentRoute(path)) return null;
  const stamp = typeof at === "string" && !Number.isNaN(Date.parse(at)) ? at.slice(0, MAX_STAMP) : null;
  if (settings.lastRoute === path && settings.lastRouteAt === stamp) return null;
  return { lastRoute: path.slice(0, MAX_ROUTE), lastRouteAt: stamp ?? new Date().toISOString().slice(0, MAX_STAMP) };
}

/**
 * The route a cold start inside the reopen window lands on, or null when the
 * window expired, reopen is off, or the saved route cannot be trusted.
 */
export function reopenTarget(
  settings: Pick<Settings, "reopenHours" | "lastRoute" | "lastRouteAt">,
  nowMs: number,
): string | null {
  if (typeof settings.reopenHours !== "number" || !Number.isFinite(settings.reopenHours) || settings.reopenHours <= 0) return null;
  if (!isContentRoute(settings.lastRoute)) return null;
  const saved = typeof settings.lastRouteAt === "string" ? Date.parse(settings.lastRouteAt) : NaN;
  if (Number.isNaN(saved) || !Number.isFinite(nowMs) || nowMs < saved) return null;
  const windowMs = Math.min(settings.reopenHours, MAX_REOPEN_HOURS) * 3_600_000;
  return nowMs - saved <= windowMs ? settings.lastRoute : null;
}

/** Load-time value: null (off) stays off, any sane number is kept, anything else turns reopen back on. */
export function normalizeReopenHours(raw: unknown): number | null {
  if (raw === null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.min(raw, MAX_REOPEN_HOURS);
  return REOPEN_DEFAULT_HOURS;
}
