import { memo, useEffect, useRef, useState } from "react";

/**
 * The §7 hero motion (odometer-countup home): KPI numbers chase their target
 * with a frame-rate-independent exponential decay — τ ≈ 360ms, δt clamped at
 * 100ms after a hidden tab — and the rAF loop STOPS the moment |cur − tgt| <
 * 0.5 (the calm rule: it wakes only when new data arrives, never idles).
 * Reduced motion snaps straight to the target. The formatted string renders
 * each frame, so the currency/grouping is the app's own.
 */

const TAU_MS = 360;
const SETTLE_AT = 0.5;
const DT_CLAMP_MS = 100;

function reduceMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const CountUp = memo(function CountUp({
  to,
  format,
  testid,
}: {
  to: number;
  format: (n: number) => string;
  testid?: string;
}) {
  const snap = reduceMotion();
  const [shown, setShown] = useState(() => (snap ? to : 0));
  const cur = useRef(snap ? to : 0);
  const raf = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    if (reduceMotion()) {
      cur.current = to;
      setShown(to);
      return;
    }
    cancelAnimationFrame(raf.current);
    last.current = performance.now();
    const step = (now: number) => {
      const dt = Math.min(now - last.current, DT_CLAMP_MS);
      last.current = now;
      cur.current = to + (cur.current - to) * Math.exp(-dt / TAU_MS);
      if (Math.abs(to - cur.current) < SETTLE_AT) {
        cur.current = to;
        setShown(to);
        return; // settle: the loop stops here, idle is free
      }
      setShown(cur.current);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [to]);

  return (
    <span data-testid={testid} aria-label={format(to)} role="text">
      {format(Math.round(shown))}
    </span>
  );
});
