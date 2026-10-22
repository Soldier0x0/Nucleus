import { useEffect, useState } from "react";
import { BMC_URL, NUDGE_SEEN_KEY, openExternal } from "../platform/support";

/**
 * The one-time support nudge. Shown once, ~35s into a session, never again —
 * the localStorage flag is permanent on any interaction (open, close or
 * dismiss, including Escape). A quiet bottom-right card, one entrance, no
 * loop; reduced motion skips the slide.
 *
 * String glyphs, not emoji, per the app's icon language — the cup is text
 * ("buymeacoffee.com/soldier0x0" is the honest label), so screen readers get
 * the real address too.
 */
export function SupportNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(NUDGE_SEEN_KEY)) return;
    const t = setTimeout(() => setShow(true), 35_000);
    return () => clearTimeout(t);
  }, []);

  const settle = (open: boolean) => {
    localStorage.setItem(NUDGE_SEEN_KEY, "1");
    setShow(false);
    if (open) void openExternal(BMC_URL);
  };

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  return (
    <aside className="support-nudge" role="status" aria-live="polite" data-testid="support-nudge">
      <div className="nudge-copy">
        <b>Nucleus stays free, offline and yours.</b>
        <p>
          If it earns its place on your screen, a coffee keeps the builds and updates coming.
        </p>
      </div>
      <div className="nudge-actions">
        <button
          className="small-btn nudge-open"
          onClick={() => settle(true)}
          data-testid="support-nudge-open"
        >
          buymeacoffee.com/soldier0x0
        </button>
        <button className="small-btn nudge-later" onClick={() => settle(false)}>
          Not now
        </button>
      </div>
      <button
        className="nudge-x"
        onClick={() => settle(false)}
        aria-label="Dismiss, and don't ask again"
        data-testid="support-nudge-dismiss"
      >
        ×
      </button>
    </aside>
  );
}
