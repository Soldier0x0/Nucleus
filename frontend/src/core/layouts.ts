import type { LayoutId, LookId, ThemeKey } from "./types";
import { resolveLook, type ResolvedLook } from "./looks";
import { rowsFor, type PresetItem } from "./presets";

export type { LayoutId };

/** A layout sits on a look and a color set. It does not replace either. */

export type ResolvedLayout = {
  layout: LayoutId;
  frost: boolean;
  bento: boolean;
  look: ResolvedLook;
  theme: ThemeKey;
};

export const LAYOUT_LIST: { id: LayoutId; name: string; line: string }[] = [
  { id: "stack", name: "Stack", line: "Rows, as the app is now." },
  { id: "glass", name: "Glass", line: "Frosted cards on this look." },
  { id: "bento", name: "Bento", line: "Short cards share a row. A fuller card keeps the row." },
];

export function resolveLayout(layout: LayoutId, look: LookId, theme: ThemeKey): ResolvedLayout {
  const resolved = resolveLook(look);
  switch (layout) {
    case "glass":
      return { layout, frost: true, bento: false, look: resolved, theme };
    case "bento":
      return { layout, frost: false, bento: true, look: resolved, theme };
    case "stack":
      return { layout, frost: false, bento: false, look: resolved, theme };
    default: {
      const unreachable: never = layout;
      return unreachable;
    }
  }
}

export type HomePresentation = {
  frost: boolean;
  cardMin: number;
  rows: { items: PresetItem[] }[];
};

/** How the home screen arranges the tiles for this layout. */
export function presentHome(layout: LayoutId, items: PresetItem[]): HomePresentation {
  switch (layout) {
    case "bento":
      return { frost: false, cardMin: 0, rows: rowsFor(items) };
    case "glass":
      return { frost: true, cardMin: 0, rows: rowsFor(items) };
    case "stack":
      return { frost: false, cardMin: 0, rows: rowsFor(items) };
    default: {
      const unreachable: never = layout;
      return unreachable;
    }
  }
}

export function parseLayout(raw: unknown): LayoutId {
  switch (raw) {
    case "glass":
    case "bento":
    case "stack":
      return raw;
    default:
      return "stack";
  }
}
