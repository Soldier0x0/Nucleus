import { useEffect, useRef, useState } from "react";
import { subscribeToast, type ToastKind, type ToastPayload } from "../platform/toast";

/**
 * The bottom toast rail (§7). Zero rAF: entrance/exit/drain are CSS; the
 * component only owns deadlines. Each pending deadline rebases by hidden-
 * time (health: the same rule as the undo snackbar) while the drain
 * animation pauses under html[data-hidden], so JS and CSS finish together.
 * Rail is role="status" with aria-relevant="additions text" — exits never
 * re-announce; err toasts carry role="alert" themselves.
 */

const MAX = 3;
const LIFE_MS_DEFAULT = 4200;
const EXIT_MS = 160;

type Item = ToastPayload & { id: number; kind: ToastKind; leaving: boolean; ms: number };

export function ToastStack() {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, number>());
  const hiddenAt = useRef(0);
  const deadlines = useRef(new Map<number, number>());

  const retire = (id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    deadlines.current.delete(id);
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), EXIT_MS);
  };

  const arm = (id: number, ms: number) => {
    const deadline = Date.now() + ms;
    deadlines.current.set(id, deadline);
    const t = window.setTimeout(() => retire(id), ms);
    timers.current.set(id, t);
  };

  useEffect(() => {
    const off = subscribeToast((p) => {
      const id = ++seq.current;
      const ms = p.ms ?? LIFE_MS_DEFAULT;
      setItems((xs) => {
        let next: Item[] = [...xs, { id, kind: p.kind ?? "neutral", title: p.title, sub: p.sub, ms, leaving: false }];
        // MAX 3, oldest retires — through the same animated exit, not a cut
        while (next.filter((x) => !x.leaving).length > MAX) {
          const drop = next.find((x) => !x.leaving);
          if (!drop) break;
          const dropId = drop.id;
          next = next.map((x) => (x.id === dropId ? { ...x, leaving: true } : x));
          window.setTimeout(() => setItems((xs2) => xs2.filter((x) => x.id !== dropId)), EXIT_MS);
        }
        return next;
      });
      arm(id, ms);
    });

    // hidden time never spends a toast's life; CSS pauses its drain in sync
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        document.documentElement.setAttribute("data-hidden", "true");
        for (const [id, t] of timers.current) {
          window.clearTimeout(t);
          timers.current.delete(id); // deadline survives in deadlines.current
        }
      } else {
        document.documentElement.removeAttribute("data-hidden");
        const gap = Date.now() - hiddenAt.current;
        for (const [id, deadline] of deadlines.current) {
          const rest = Math.max(400, deadline + gap - Date.now());
          const t = window.setTimeout(() => retire(id), rest);
          timers.current.set(id, t);
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      off();
      document.removeEventListener("visibilitychange", onVis);
      for (const t of timers.current.values()) window.clearTimeout(t);
      document.documentElement.removeAttribute("data-hidden");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="toast-rail no-print" role="status" aria-live="polite" aria-relevant="additions text" data-testid="toast-rail">
      {items.map((x) => (
        <div
          key={x.id}
          className={`toast toast-${x.kind} ${x.leaving ? "toast-leave" : ""}`}
          role={x.kind === "err" ? "alert" : undefined}
          data-testid={`toast-${x.kind}`}
        >
          <span className="toast-glyph" aria-hidden="true">{glyph(x.kind)}</span>
          <span className="toast-copy">
            <b>{x.title}</b>
            {x.sub ? <span className="toast-sub">{x.sub}</span> : null}
          </span>
          <i className="toast-drain" style={{ animationDuration: `${x.ms}ms` }} aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

function glyph(kind: ToastKind): string {
  switch (kind) {
    case "ok":
      return "✓";
    case "err":
      return "✕";
    case "warn":
      return "!";
    default:
      return "•";
  }
}
