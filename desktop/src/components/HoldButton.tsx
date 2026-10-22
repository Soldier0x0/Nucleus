import { useEffect, useRef, useState } from "react";

/**
 * Hold-to-confirm (§7): the explicit path for costly destructive actions —
 * the undo snackbar is the forgiving path for common ones; the two never
 * share an action in one surface (the digest's pairing rule).
 *
 * Model kept whole from the rebuild: a linear 1100ms fill (the upstream
 * per-frame `p += rate·0.65` folded into the total) displayed through a soft
 * spring (k=0.016, d=0.78); commit fires at p ≥ 0.985 (≈1.08s of hold, just
 * beneath the "long" perception boundary). Releasing outside the control
 * counts because the session CAPTURES the pointer on down — mouse has no
 * implicit capture (that's a touch behaviour), so without setPointerCapture
 * an off-button release never reaches the button and the hold would keep
 * filling past the user's cancel (the verification agent's BLOCK); commit
 * then fires ≈1s after the user let go, on an irreversible delete. An early
 * release or pointercancel decays along the 0.65·HOLD_MS regress path. The
 * fill ring intensifies toward --error under the finger; commit
 * pops a check at 1.18 overshoot (cubic-bezier(.34,1.56,.64,1)) in --ok.
 * Keyboard is a full hold — Space/Enter down-up, key autorepeat ignored —
 * and a separate role="status" node narrates hold/cancel/commit. The rAF
 * lives only while motion exists, and the spring is written straight to the
 * DOM node (no per-frame React state).
 */

const HOLD_MS = 1100;
const REGRESS_MS = HOLD_MS * 0.65;
const COMMIT_AT = 0.985;

type Phase = "idle" | "holding" | "done";

export function HoldButton({
  onConfirm,
  label,
  confirmHint = "Hold to confirm",
  testid,
}: {
  /** Fired once at the commit threshold. */
  onConfirm: () => void;
  /** Idle label, e.g. "Delete board". */
  label: string;
  confirmHint?: string | undefined;
  testid?: string | undefined;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [say, setSay] = useState("");
  const btn = useRef<HTMLButtonElement | null>(null);
  const fill = useRef(0);
  const disp = useRef(0);
  const vel = useRef(0);
  const raf = useRef(0);
  const holding = useRef(false);
  const reduced = useRef(false);
  const doneTimer = useRef(0);

  useEffect(() => {
    reduced.current = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(doneTimer.current);
    },
    [],
  );

  const commit = () => {
    holding.current = false;
    cancelAnimationFrame(raf.current);
    fill.current = 0;
    disp.current = 0;
    vel.current = 0;
    btn.current?.style.removeProperty("--hp");
    setPhase("done");
    setSay("Confirmed");
    onConfirm();
    // the button stands down once the check has had its moment
    doneTimer.current = window.setTimeout(() => setPhase("idle"), 1600);
  };

  const start = () => {
    if (phase === "done") return;
    // A re-hold during the release decay supersedes the old chain: kill its
    // rAF and continue from the current fill level. Without this, a supersed-
    // ed chain keeps rescheduling itself and doubles the fill rate.
    cancelAnimationFrame(raf.current);
    holding.current = true;
    setPhase("holding");
    setSay("Holding… let go to cancel");
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      if (holding.current) {
        fill.current = Math.min(1, fill.current + dt / HOLD_MS);
        if (fill.current >= COMMIT_AT) {
          commit();
          return;
        }
      } else {
        // early release: the loop walks the fill back, then stops itself
        fill.current = Math.max(0, fill.current - dt / REGRESS_MS);
        if (fill.current <= 0) {
          cancelAnimationFrame(raf.current);
          setPhase("idle");
          return;
        }
      }
      if (reduced.current) {
        disp.current = fill.current;
        vel.current = 0;
      } else {
        vel.current += (fill.current - disp.current) * 0.016;
        vel.current *= 0.78;
        disp.current += vel.current;
      }
      btn.current?.style.setProperty("--hp", String(Math.max(0, Math.min(1, disp.current))));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const release = () => {
    if (!holding.current) return;
    holding.current = false;
    setSay("Cancelled — nothing changed");
  };

  return (
    <>
      <button
        ref={btn}
        className={`hold-btn ${phase === "done" ? "hold-done" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          // capture so a release anywhere counts — mouse has no implicit capture
          e.currentTarget.setPointerCapture(e.pointerId);
          start();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={(e) => {
          if (e.repeat) return; // autorepeat never counts
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") release();
        }}
        onBlur={release}
        data-testid={testid}
      >
        <span className="hold-fill" aria-hidden="true" />
        <span className="hold-label">{phase === "holding" ? confirmHint : label}</span>
        <svg className="hold-check" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8.5 6.6 12 13 4.5" />
        </svg>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {say}
      </span>
    </>
  );
}
