import type { ReactNode } from "react";

/**
 * The empty-state vessel (§7): one inline SVG (no canvas from upstream — the
 * drift-scaping motes were correctly NOT ported) with a single settle on
 * first paint: a 5px drop-in and the front rim brightening from 25% to full
 * accent, then the page is still. Copy and action are real HTML announced
 * naturally; the vessel itself is aria-hidden (the headline carries the
 * meaning). Used where a module is genuinely empty — a filter that merely
 * found nothing stays a quiet line.
 */
export function EmptyState({
  title,
  hint,
  action,
  testid,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
  testid?: string;
}) {
  return (
    <section className="empty-state card" data-testid={testid}>
      <div className="fig" aria-hidden="true">
        <svg viewBox="0 0 168 112">
          <line className="v-ground" x1="24" y1="88" x2="144" y2="88" />
          <ellipse className="v-void" cx="84" cy="40" rx="47" ry="12.5" />
          <path className="v-walls" d="M37 40 C37 62, 55 70, 84 70 C113 70, 131 62, 131 40" />
          <ellipse className="v-back" cx="84" cy="40" rx="47" ry="12.5" />
          <ellipse className="v-rim" cx="84" cy="40" rx="47" ry="12.5" pathLength={100} />
        </svg>
      </div>
      <h3 className="es-title">{title}</h3>
      <p className="es-hint">{hint}</p>
      {action ? <div className="es-action">{action}</div> : null}
    </section>
  );
}
