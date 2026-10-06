/**
 * A look is a small set of choices. Screens read the resolved metrics
 * (shape, space, type, cards, pop). A new look is a new preset here,
 * not a restyle of each screen. Color sets stay separate.
 */
import type { LookId } from "./types";

export type LookShape = "standard" | "round" | "sharp";
export type LookSpace = "standard" | "roomy" | "tight";
export type LookType = "standard" | "soft" | "plain";
export type LookCards = "flat" | "shadow";
export type LookPop = "none" | "ink" | "signal" | "poster";

export type LookChoices = {
  shape: LookShape;
  space: LookSpace;
  type: LookType;
  cards: LookCards;
  pop: LookPop;
};

export type LookMetrics = {
  sm: number;
  base: number;
  lg: number;
  xl: number;
  "2xl": number;
  "3xl": number;
};

export type ResolvedLook = {
  id: LookId;
  choices: LookChoices;
  radius: { sm: number; md: number; lg: number; pill: number };
  type: LookMetrics;
  /** 1 keeps the current type sizes. */
  typeScale: number;
  /** 1 keeps the current spacing. */
  space: number;
  /** Settings-style row height. 56 is the current row. */
  row: number;
  plain: boolean;
};

const BASE_TYPE: LookMetrics = { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 32 };

export const LOOK_CHOICES: Record<LookId, LookChoices> = {
  current: { shape: "standard", space: "standard", type: "standard", cards: "flat", pop: "none" },
  soft: { shape: "round", space: "roomy", type: "soft", cards: "flat", pop: "none" },
  tight: { shape: "sharp", space: "tight", type: "standard", cards: "flat", pop: "none" },
  plain: { shape: "sharp", space: "roomy", type: "plain", cards: "flat", pop: "none" },
  cards: { shape: "standard", space: "standard", type: "standard", cards: "shadow", pop: "none" },
  ink: { shape: "sharp", space: "standard", type: "standard", cards: "flat", pop: "ink" },
  signal: { shape: "round", space: "standard", type: "standard", cards: "flat", pop: "signal" },
  poster: { shape: "round", space: "roomy", type: "soft", cards: "flat", pop: "poster" },
  blush: { shape: "round", space: "roomy", type: "soft", cards: "shadow", pop: "none" },
};

export const LOOK_LIST: { id: LookId; name: string; line: string }[] = [
  { id: "current", name: "Current", line: "The look this app already uses." },
  { id: "soft", name: "Soft", line: "Rounder corners, slightly larger type, more air between rows." },
  { id: "tight", name: "Tight", line: "Sharper corners and closer rows." },
  { id: "plain", name: "Plain", line: "Big type, and very little decoration." },
  { id: "cards", name: "Cards", line: "The same shapes, with a soft shadow under each card." },
  { id: "ink", name: "Ink", line: "Strong edges and a heavier mark." },
  { id: "signal", name: "Signal", line: "Quiet pages, with the accent on buttons and marks." },
  { id: "poster", name: "Poster", line: "Large titles and one accent, with room around them." },
  { id: "blush", name: "Blush", line: "A soft pink skin for pills, tiles, and sheets." },
];

function choicesFor(id: LookId): LookChoices {
  switch (id) {
    case "current":
    case "soft":
    case "tight":
    case "plain":
    case "cards":
    case "ink":
    case "signal":
    case "poster":
    case "blush":
      return LOOK_CHOICES[id];
    default: {
      const unknown: never = id;
      return unknown;
    }
  }
}

function radiusFor(shape: LookShape): ResolvedLook["radius"] {
  switch (shape) {
    case "standard":
      return { sm: 4, md: 8, lg: 12, pill: 999 };
    case "round":
      return { sm: 10, md: 18, lg: 26, pill: 999 };
    case "sharp":
      return { sm: 2, md: 4, lg: 6, pill: 999 };
    default: {
      const unknown: never = shape;
      return unknown;
    }
  }
}

function spaceFor(space: LookSpace): number {
  switch (space) {
    case "standard":
      return 1;
    case "roomy":
      return 1.24;
    case "tight":
      return 0.78;
    default: {
      const unknown: never = space;
      return unknown;
    }
  }
}

function typeFor(type: LookType): { scale: number; plain: boolean } {
  switch (type) {
    case "standard":
      return { scale: 1, plain: false };
    case "soft":
      return { scale: 1.08, plain: false };
    case "plain":
      return { scale: 1.32, plain: true };
    default: {
      const unknown: never = type;
      return unknown;
    }
  }
}

function scaleType(scale: number): LookMetrics {
  return {
    sm: Math.round(BASE_TYPE.sm * scale),
    base: Math.round(BASE_TYPE.base * scale),
    lg: Math.round(BASE_TYPE.lg * scale),
    xl: Math.round(BASE_TYPE.xl * scale),
    "2xl": Math.round(BASE_TYPE["2xl"] * scale),
    "3xl": Math.round(BASE_TYPE["3xl"] * scale),
  };
}

export function resolveLook(id: LookId): ResolvedLook {
  const choices = choicesFor(id);
  const typed = typeFor(choices.type);
  const space = spaceFor(choices.space);
  return {
    id,
    choices,
    radius: radiusFor(choices.shape),
    type: scaleType(typed.scale),
    typeScale: typed.scale,
    space,
    row: Math.round(56 * space * (typed.plain ? 1.12 : 1)),
    plain: typed.plain,
  };
}

export function parseLook(value: unknown): LookId {
  switch (value) {
    case "current":
    case "soft":
    case "tight":
    case "plain":
    case "cards":
    case "ink":
    case "signal":
    case "poster":
    case "blush":
      return value;
    default:
      return "current";
  }
}

function channel(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(from: string, to: string, t: number): string {
  const [ar, ag, ab] = channel(from);
  const [br, bg, bb] = channel(to);
  const n = (a: number, b: number) => Math.round(a + (b - a) * t).toString(16).padStart(2, "0");
  return `#${n(ar, br)}${n(ag, bg)}${n(ab, bb)}`;
}

/** Second color for type, buttons, and marks. The background stays the color set. */
export function dualToneInk(mode: "light" | "dark"): string {
  return mode === "light" ? "#2A1C12" : "#F4E4D0";
}

export function dualTonePatch(surface: string, mode: "light" | "dark") {
  const ink = dualToneInk(mode);
  return {
    onSurface: ink,
    onSurfaceSecondary: ink,
    onSurfaceTertiary: ink,
    surfaceInverse: ink,
    onSurfaceInverse: surface,
    border: mix(surface, ink, 0.28),
    borderStrong: mix(surface, ink, 0.62),
    divider: mix(surface, ink, 0.22),
    muted: mix(surface, ink, 0.58),
  };
}
