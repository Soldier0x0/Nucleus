/**
 * The one menu this app owns. Native <select> looked barebones in the webview,
 * and its OS-drawn dropdown never even composites into screenshots. This is the
 * replacement: an anchored popover menu with spring entrance, keyboard support
 * (arrows, Home/End, Enter, Esc, first-letter cycling), a check on the current
 * item, outside-click and scroll/resize dismissal, and ARIA listbox roles.
 *
 * Usage mirrors the old select closely enough to swap in place:
 *   <Select value={theme} onChange={setTheme} options={[
 *     { value: "system", label: "Follow the system" },
 *   ]} />
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  /** Quiet text under the label, e.g. a unit or a hint. */
  hint?: ReactNode;
  /** Leading lucide icon render if a picker wants images in the menu. */
  icon?: ReactNode;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  /** Small ghost select (filter capsules), or the standard field control. */
  look?: "field" | "filter";
  placeholder?: string;
  className?: string;
  testid?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

const POP_GAP = 6; // px between trigger and menu
const ROW_H = 30; // must match --sel-row in styles.css

export function Select<T extends string>({
  value,
  onChange,
  options,
  look = "field",
  placeholder,
  className,
  testid,
  disabled,
  ariaLabel,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(value);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; up: boolean; maxHeight: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const current = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const place = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < 180 && r.top > below;
    setRect({
      left: r.left,
      top: up ? r.top - POP_GAP : r.bottom + POP_GAP,
      width: Math.max(r.width, 120),
      up,
      maxHeight: Math.max(140, (up ? r.top : below) - POP_GAP * 2),
    });
  };

  // Layout sizing note: the menu portals to <body> so no transformed/filterable
// ancestor can hijack its fixed positioning, and it sizes to the widest row
// (max-content) while never rendering narrower than the trigger.
  useEffect(() => {
    if (!open) return;
    const dismiss = () => setOpen(false);
    window.addEventListener("scroll", dismiss, { capture: true, passive: true });
    window.addEventListener("resize", dismiss, { passive: true });
    // The menu renders inside .select-wrap, so one containment check covers both
    // the trigger and the open rows; anything else dismisses the menu.
    const onDocDown = (e: MouseEvent) => {
      if (e.target instanceof Node && wrapRef.current?.contains(e.target)) return;
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => {
      window.removeEventListener("scroll", dismiss, { capture: true });
      window.removeEventListener("resize", dismiss);
      document.removeEventListener("mousedown", onDocDown);
    };
  }, [open]);

  // Open: anchor, then focus the current row so arrows land immediately; closing
  // returns focus to the trigger.
  useLayoutEffect(() => {
    if (!open) {
      setActive(null);
      return;
    }
    place();
    const start = options.find((o) => o.value === value)?.value ?? options[0]?.value ?? null;
    setActive(start);
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-v="${start}"]`)?.focus();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keyboard: the whole widget behaves like a native listbox when driving with keys,
  // whether focus sits on the trigger (closed) or inside the menu (open).
  const commit = (v: T | null) => {
    if (!v) return;
    const opt = options.find((o) => o.value === v);
    if (!opt) return;
    if (v !== value) onChange(v);
  };

  const move = (dir: 1 | -1) => {
    const i = options.findIndex((o) => o.value === active);
    const next = options.length
      ? options[(Math.max(i, 0) + dir + options.length) % options.length]
      : null;
    if (next) setActive(next.value);
  };

  const onBtnKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      if (e.key === "ArrowDown") setActive(options[Math.min(options.findIndex((o) => o.value === value) + 1, options.length - 1)]?.value ?? null);
      return;
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // first-letter cycling from the current selection, like a native select
      e.preventDefault();
      const ch = e.key.toLowerCase();
      const start = options.findIndex((o) => o.value === value);
      for (let step = 1; step <= options.length; step++) {
        const opt = options[(start + step) % options.length];
        if (opt && opt.label.toLowerCase().startsWith(ch)) {
          if (opt.value !== value) onChange(opt.value);
          return;
        }
      }
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(options[0]?.value ?? null);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options[options.length - 1]?.value ?? null);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (active) commit(active as T);
      setOpen(false);
      btnRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  // Keep the highlighted row in view while arrowing.
  useEffect(() => {
    if (!open || !active) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-v="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <div className={`select-wrap ${className ?? ""}`} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open || undefined}
        aria-label={ariaLabel}
        data-open={open || undefined}
        data-testid={testid}
        className={`select look-${look}`}
        disabled={disabled}
        onKeyDown={(e) => { if (!open) onBtnKeyDown(e); }}
        onClick={() => setOpen((p) => !p)}
      >
        <span className={`select-value ${current ? "" : "placeholder"}`}>
          {current ? current.label : (placeholder ?? "Select…")}
        </span>
        <ChevronDown size={15} strokeWidth={2.2} className="select-chev" aria-hidden="true" />
      </button>
      {open && rect
        ? createPortal(
            <div
              ref={menuRef}
              className="select-menu"
              role="presentation"
              data-up={rect.up || undefined}
              style={{
                position: "fixed",
                left: rect.left,
                top: rect.top,
                minWidth: rect.width,
                width: "max-content",
                maxWidth: `calc(100vw - ${rect.left}px - 10px)`,
                maxHeight: rect.maxHeight,
              }}
            >
              <ul
                role="listbox"
                data-select-menu=""
                className="select-menu-list"
                style={{ ["--sel-max" as string]: `${rect.maxHeight}px` }}
                ref={listRef}
                onKeyDown={onListKeyDown}
              >
                {options.map((o) => (
                  <li
                    key={o.value}
                    role="option"
                    aria-selected={o.value === value}
                    data-v={o.value}
                    tabIndex={-1}
                    className={`select-row ${o.value === value ? "sel" : ""} ${o.value === active ? "hl" : ""}`}
                    onMouseEnter={() => setActive(o.value)}
                    onClick={() => {
                      commit(o.value as T);
                      setOpen(false);
                      btnRef.current?.focus();
                    }}
                  >
                    {o.icon ? <span className="select-ic">{o.icon}</span> : null}
                    <span className="select-row-copy">
                      {o.label}
                      {o.hint ? <span className="select-hint">{o.hint}</span> : null}
                    </span>
                    <Check size={14} strokeWidth={2.4} className="select-check" aria-hidden="true" />
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Convenience for the extremely common string[] → options shape. */
export const selectOptions = (values: { value: string; label: string }[]) => values;
