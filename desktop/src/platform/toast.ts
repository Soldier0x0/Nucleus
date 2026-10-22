/**
 * The toast rail (§7): transient notices — backups written, exports saved,
 * clipboard confirmed. Scheduling is all this module does: the visuals ride
 * CSS keyframes (enter 320ms with spring overshoot, 160ms ease-in exit) and
 * the drain hairline is a linear scaleX whose lifetime matches the JS
 * deadline (TOAST_MS) — one shared visibility rebase keeps them from
 * drifting apart, via `animation-play-state: paused` under `html[data-hidden]`.
 * MAX 3 stacked bottom-rail, oldest retires first; kind decides the glyph
 * and whether the rail announces politely (`status`) or urgently (`alert`).
 */

export type ToastKind = "ok" | "err" | "warn" | "neutral";

export type ToastPayload = {
  kind?: ToastKind | undefined;
  title: string;
  sub?: string | undefined;
  ms?: number | undefined;
};

type Listener = (p: ToastPayload) => void;

const listeners = new Set<Listener>();

export const toast = (p: ToastPayload) => {
  for (const l of listeners) l(p);
};

export const subscribeToast = (l: Listener): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
