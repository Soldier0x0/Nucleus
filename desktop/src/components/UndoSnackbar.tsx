import { useEffect, useRef, useState } from "react";
import { undoBus, type UndoRequest } from "../platform/undo";

/**
 * The undo snackbar (§7): the single reversed-destructive surface.
 * State machine from the rebuild digest — idle → counting → (restored |
 * committed) — with ONE rAF loop owning the countdown (no wall-clock timers
 * to desync), a visibilitychange rebasing so a hidden window never spends
 * its window, and no ambient loop when nothing is pending. Keyboard: focus
 * lands on UNDO at spawn; Esc commits, same as the timeout. Reduced motion:
 * the ring rests on a legible static frame, the timers still run.
 */

const WINDOW_MS = 6000;
const RED_AT = 0.28; // ring flips to --error under 28% remaining
const CIRC = 2 * Math.PI * 12.5;

export function UndoSnackbar() {
  const [req, setReq] = useState<UndoRequest | null>(null);
  const [frac, setFrac] = useState(1); // 1 → 0, ring drain
  const raf = useRef(0);
  const hiddenAt = useRef(0);

  useEffect(() => undoBus.subscribe((r) => {
    cancelAnimationFrame(raf.current);
    setReq(r);
    setFrac(1);
  }), []);

  // The countdown — the only place time advances.
  useEffect(() => {
    if (!req) return;
    let due = performance.now() + WINDOW_MS;

    const tick = (now: number) => {
      const rest = Math.max(0, due - now);
      setFrac(rest / WINDOW_MS);
      if (rest <= 0) {
        setReq(null); // committed for good
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    // Hidden-time never fast-forwards the window: rebase by the gap.
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        cancelAnimationFrame(raf.current);
        hiddenAt.current = performance.now();
      } else {
        due += performance.now() - hiddenAt.current;
        raf.current = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [req]);

  const undo = () => {
    try {
      req?.onUndo();
    } finally {
      setReq(null);
    }
  };

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setReq(null); // Esc commits, same as the timeout
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req]);

  if (!req) return null;
  const red = frac < RED_AT;

  return (
    <aside
      className="undo-bar no-print"
      data-danger={red ? "true" : undefined}
      role="status"
      aria-live="polite"
      data-testid="undo-bar"
    >
      <svg className="undo-ring" viewBox="0 0 28 28" aria-hidden="true">
        <circle className="track" cx="14" cy="14" r="12.5" />
        <circle
          className="drain"
          cx="14"
          cy="14"
          r="12.5"
          style={{ strokeDasharray: CIRC, strokeDashoffset: CIRC * (1 - frac) }}
        />
      </svg>
      <div className="undo-copy">
        <b>{req.title}</b>
        <span>{red ? "Deleting for good soon" : "You can bring it back"}</span>
      </div>
      <button className="undo-btn" onClick={undo} data-testid="undo-btn" autoFocus>
        Undo
      </button>
    </aside>
  );
}
