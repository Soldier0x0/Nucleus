/**
 * FLAG_SECURE while anything paper-like is on screen. Screens stack, so the
 * module keeps one counter: the first viewer turns prevention on, and when the
 * last one unmounts it re-applies whatever the user picked in Settings
 * (screenshots allowed or always blocked). Docs lives in `paperFiles`.
 */
let depth = 0;

export type ShieldApplier = (mode: "secure" | "allow") => Promise<unknown>;

let apply: ShieldApplier | null = null;

/** Wires the Android window hook. Tests install their own note-taker. */
export function setShieldApplier(next: ShieldApplier | null) {
  apply = next;
}

export function shieldDepth(): number {
  return depth;
}

/** Test hook: forget every mounted viewer. */
export function resetShield() {
  depth = 0;
  apply = null;
}

export function shieldOn() {
  depth += 1;
  if (depth === 1) void apply?.("secure");
}

export function shieldOff(restoreBlock: boolean) {
  if (depth === 0) return;
  depth -= 1;
  if (depth === 0) void apply?.(restoreBlock ? "secure" : "allow");
}
