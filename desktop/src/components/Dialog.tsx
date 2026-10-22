/**
 * Native-feeling confirm sheet (design plan §3/§4) — replaces window.confirm,
 * which the plan calls out as "jarring and unstyled". Small and centered, never
 * modal-stacked: blur(20px) saturate(180%) window material at ~62% tint over a
 * dimming layer, 11px radius, 8px elevation, red confirm for destructive verbs.
 *
 * Promise-based so call sites read like the old guard they replace:
 *   if (await confirmDialog({ title, body, confirmLabel, danger })) ...
 *
 * Self-mounts into its own host div (createRoot) instead of a provider, so every
 * caller — LockScreen, screens, components, even App's error branch — can reach
 * it without plumbing. Requests while a sheet is open queue, one at a time.
 * Focus: destructive sheets open on Cancel (the safe button), Tab is trapped
 * inside, Esc cancels, and focus returns to the trigger on close (same pattern
 * as CommandPalette). Reduced motion opts out of the entrance animations.
 */
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

export interface ConfirmOptions {
  /** Short sheet heading, e.g. `Delete "Error log tool"?` */
  title: string;
  /** What confirming does; carries the copy the old window.confirm held. */
  body?: string;
  /** The verb on the confirm button: "Erase", "Delete", "Replace", "Remove"… */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red filled confirm for destructive actions. */
  danger?: boolean;
}

interface Job {
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
}

const queue: Job[] = [];
let current: Job | null = null;
let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function ensureHost() {
  if (host) return;
  host = document.createElement("div");
  host.setAttribute("data-dialog-host", "");
  document.body.appendChild(host);
  root = createRoot(host);
}

function show(job: Job) {
  current = job;
  ensureHost();
  const settle = (value: boolean) => {
    job.resolve(value);
    root!.render(null);
    current = null;
    const next = queue.shift();
    if (next) show(next);
  };
  root!.render(<ConfirmSheet opts={job.opts} onResolve={settle} />);
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const job: Job = { opts, resolve };
    if (current) {
      queue.push(job);
      return;
    }
    show(job);
  });
}

function ConfirmSheet({ opts, onResolve }: { opts: ConfirmOptions; onResolve: (value: boolean) => void }) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    // destructive sheets open on Cancel — Enter must not be the verb by surprise
    (opts.danger ? cancelRef : primaryRef).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onResolve(false);
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = cardRef.current?.querySelectorAll<HTMLElement>("button");
      if (!focusables || !focusables.length) return;
      e.preventDefault();
      const list = Array.from(focusables);
      const idx = list.indexOf(document.activeElement as HTMLElement);
      list[(idx + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      prior?.focus?.();
    };
  }, [opts.danger, onResolve]);

  return (
    <div
      className="dialog-overlay"
      data-testid="dialog-overlay"
      // clicking the dimming layer (not the card) cancels, like the palette
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onResolve(false);
      }}
    >
      <div
        className="dialog-card"
        data-testid="dialog"
        role={opts.danger ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby="dialog-title"
        ref={cardRef}
      >
        <h2 id="dialog-title">{opts.title}</h2>
        {opts.body ? <p>{opts.body}</p> : null}
        <div className="dialog-actions">
          <button
            ref={cancelRef}
            className="dialog-btn"
            data-testid="dialog-cancel"
            onClick={() => onResolve(false)}
          >
            {opts.cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={primaryRef}
            className={`dialog-btn ${opts.danger ? "is-danger" : "is-accent"}`}
            data-testid="dialog-confirm"
            onClick={() => onResolve(true)}
          >
            {opts.confirmLabel ?? "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
