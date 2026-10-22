import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ToolbarHostContext = createContext<HTMLElement | null>(null);

export const ToolbarHostProvider = ToolbarHostContext.Provider;

/**
 * The per-screen title bar (§1): a screen renders its title, count line and
 * actions THROUGH this portal into the shell's one sticky `.toolbar-shell`,
 * instead of in the content flow. Every screen then shares the same 52px
 * material while the hairline (scroll-edge cue) is owned by the shell.
 */
export function ScreenToolbar({ children }: { children: ReactNode }) {
  const host = useContext(ToolbarHostContext);
  if (!host) return null;
  return <>{createPortal(children, host)}</>;
}
