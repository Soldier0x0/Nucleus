/**
 * A labelled count stepper — what the Cycle stash (and any counter) should have
 * looked like: `Label  − count  +` in one 30px-tall control, minus and plus as
 * real squared keys, the number centred between them. Hold-to-repeat is on the
 * pointer (300ms delay), which the old ± buttons never had. A `min` floor and a
 * `warn-below` tint (the stash low mark) are opt-in.
 */
import { useEffect, useRef } from "react";

type Props = {
  label?: string;
  value: null | number; // null renders as "—" and disables minus (nothing tracked)
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** At or below this the count tints amber — the low-mark cue. */
  warnBelow?: number;
  /** Unit text shown quietly after the number, e.g. "h". */
  suffix?: string;
  testid?: string;
};

export function Stepper({ label, value, onChange, min = 0, max = 9999, warnBelow = 0, suffix, testid }: Props) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = useRef<() => void>(() => {});

  const dec = () => {
    if (value === null || value <= min) return;
    onChange(Math.max(min, value - 1));
  };
  const inc = () => {
    const from = value ?? 0;
    if (from >= max) return;
    onChange(Math.min(max, from + 1));
  };

  // Pointer hold: one 340ms arm then 8 ticks/sec down/up the same edge.
  const hold = (edge: "dec" | "inc") => {
    step(edge);
    delay.current = setTimeout(() => {
      timer.current = setInterval(() => step(edge), 120);
    }, 340);
    stop.current = () => {
      if (delay.current) clearTimeout(delay.current);
      if (timer.current) clearInterval(timer.current);
      delay.current = null;
      timer.current = null;
    };
  };
  const release = () => stop.current();

  useEffect(() => release, []);

  const step = (edge: "dec" | "inc") => (edge === "dec" ? dec() : inc());

  const tracked = value !== null;
  const warn = tracked && value <= warnBelow;

  return (
    <span className={`stepper ${warn ? "warn" : ""}`} data-testid={testid}>
      {label ? <span className="stepper-lab">{label}</span> : null}
      <span className="stepper-ctl">
        <button
          type="button"
          className="stepper-key"
          aria-label={`Decrease ${label ?? "count"}`}
          disabled={!tracked || (value ?? 0) <= min}
          onMouseDown={() => hold("dec")}
          onMouseUp={release}
          onMouseLeave={release}
          onTouchStart={() => hold("dec")}
          onTouchEnd={release}
        >
          −
        </button>
        <span className="stepper-val">{tracked ? value : "—"}{suffix ? <i className="stepper-suffix">{suffix}</i> : null}</span>
        <button
          type="button"
          className="stepper-key"
          aria-label={`Increase ${label ?? "count"}`}
          disabled={(value ?? 0) >= max}
          onMouseDown={() => hold("inc")}
          onMouseUp={release}
          onMouseLeave={release}
          onTouchStart={() => hold("inc")}
          onTouchEnd={release}
        >
          +
        </button>
      </span>
    </span>
  );
}
