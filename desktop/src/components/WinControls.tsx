/**
 * Window traffic lights (Linux/webview builds): the dots macOS users expect.
 * Rendered only when running under Tauri; the browser preview drops them.
 * Glyphs appear only on hover, exactly like macOS. The dress: three 12px dots
 * in the toolbar's left edge — the toolbar itself drags the window and
 * double-click toggles the zoom, handled in App's shell handlers.
 */
import { Minus, X } from "lucide-react";
import { isTauri } from "../platform/env";

function glyph(edge: "min" | "max" | "close") {
  if (edge === "min") return <Minus size={9} strokeWidth={2.4} aria-hidden="true" />;
  if (edge === "close") return <X size={9} strokeWidth={2.4} aria-hidden="true" />;
  // the max glyph: two outward triangles, drawn to match the set's weight
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" style={{ width: 9, height: 9 }}>
      <path d="M1.6 4.2 4.4 1.4M1.3 1.2h3.2v3.2Z" fill="currentColor" stroke="none" opacity="0.9" />
      <path d="M8.4 5.8 5.6 8.6M8.7 8.8H5.5V5.6Z" fill="currentColor" stroke="none" opacity="0.9" />
    </svg>
  );
}

export function WinControls({ overlay = false }: { overlay?: boolean }) {
  if (!isTauri()) return null;
  const handlers = {
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
  };
  return (
    <div className={`win-controls ${overlay ? "win-overlay" : ""}`} {...handlers}>
      <button className="win-dot w-min" title="Minimize" aria-label="Minimize window" onClick={() => void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().minimize())}>
        {glyph("min")}
      </button>
      <button className="win-dot w-max" title="Zoom" aria-label="Zoom window" onClick={() => void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().toggleMaximize())}>
        {glyph("max")}
      </button>
      <button className="win-dot w-close" title="Close" aria-label="Close window" onClick={() => void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().close())}>
        {glyph("close")}
      </button>
    </div>
  );
}
