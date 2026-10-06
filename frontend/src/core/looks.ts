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
  { id: "current", name: "Current", line: "The shapes you already have, on the color set you picked." },
  { id: "soft", name: "Soft", line: "Warm surfaces, rounder corners, and a little more air." },
  { id: "tight", name: "Tight", line: "Cooler surfaces, sharper corners, and closer rows." },
  { id: "plain", name: "Plain", line: "Flat surfaces and big type, with very little decoration." },
  { id: "cards", name: "Cards", line: "Lifted cards and pills on the same page color." },
  { id: "ink", name: "Ink", line: "Paper and ink. Strong edges on cards and pills." },
  { id: "signal", name: "Signal", line: "Quiet surfaces, with the accent kept for marks." },
  { id: "poster", name: "Poster", line: "Warm blocks, a strong accent, and large titles." },
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

type Paintable = {
  surface: string;
  onSurface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  border: string;
  borderStrong: string;
  divider: string;
  brand: string;
  brandPrimary: string;
  brandSecondary: string;
  brandTertiary: string;
  onBrandTertiary: string;
  muted: string;
};

function wash<T extends Paintable>(colors: T, mode: "light" | "dark", hue: string, amount: number, accent = 0): T {
  const lift = mode === "light" ? "#FFFCF8" : "#000000";
  return {
    ...colors,
    surface: mix(colors.surface, hue, amount),
    surfaceSecondary: mix(mix(colors.surface, hue, amount * 0.65), lift, mode === "light" ? 0.5 : 0.08),
    surfaceTertiary: mix(colors.surfaceTertiary, hue, Math.min(0.75, amount + 0.2)),
    border: mix(colors.border, hue, 0.5),
    divider: mix(colors.divider, hue, 0.4),
    borderStrong: mix(colors.borderStrong, hue, 0.45),
    brandTertiary: mix(colors.brandTertiary, hue, 0.45),
    muted: mix(colors.muted, hue, 0.18),
    ...(accent > 0
      ? {
          brand: mix(colors.brand, hue, accent),
          brandPrimary: mix(colors.brandPrimary, hue, accent),
          brandSecondary: mix(colors.brandSecondary, hue, accent),
        }
      : {}),
  };
}

/**
 * A look paints surfaces, cards, pills, and a little of the accent.
 * Current leaves the color set alone. Blush already replaced the whole palette.
 * Cards keeps the page color so Paper stays Paper.
 */
export function paintLook<T extends Paintable>(colors: T, lookId: LookId, mode: "light" | "dark"): T {
  switch (lookId) {
    case "current":
    case "blush":
      return colors;
    case "soft":
      return wash(colors, mode, mode === "light" ? "#E7D3C1" : "#3A2C22", mode === "light" ? 0.42 : 0.34, 0.22);
    case "tight":
      return wash(colors, mode, mode === "light" ? "#C5CDD6" : "#8AA0B4", mode === "light" ? 0.28 : 0.22, 0.12);
    case "plain":
      return {
        ...colors,
        surfaceSecondary: colors.surface,
        surfaceTertiary: mix(colors.surface, mode === "light" ? "#000000" : "#FFFFFF", mode === "light" ? 0.04 : 0.06),
        border: mix(colors.surface, colors.onSurface, 0.12),
        divider: mix(colors.surface, colors.onSurface, 0.08),
        brandTertiary: mix(colors.surface, colors.brandTertiary, 0.2),
      };
    case "cards":
      return {
        ...colors,
        surfaceSecondary: mode === "light" ? mix(colors.surface, "#FFFFFF", 0.82) : mix(colors.surface, "#FFFFFF", 0.07),
        surfaceTertiary: mode === "light" ? mix(colors.surface, "#E6DDD0", 0.45) : mix(colors.surface, "#FFFFFF", 0.12),
        border: mix(colors.border, mode === "light" ? "#D4CBBE" : "#FFFFFF", mode === "light" ? 0.35 : 0.12),
        brandTertiary: mix(colors.brandTertiary, mode === "light" ? "#F4E7D4" : colors.brandPrimary, mode === "light" ? 0.35 : 0.2),
      };
    case "ink":
      return {
        ...colors,
        surface: mode === "light" ? mix(colors.surface, "#F4F1EA", 0.55) : mix(colors.surface, "#000000", 0.4),
        surfaceSecondary: mode === "light" ? "#FFFCF6" : mix(colors.surface, "#FFFFFF", 0.05),
        surfaceTertiary: mode === "light" ? "#E7E2D8" : "#161616",
        border: mode === "light" ? "#1C1A17" : "#F4F1EA",
        borderStrong: mode === "light" ? "#1C1A17" : "#F4F1EA",
        divider: mode === "light" ? "#1C1A17" : "#3A3834",
        brandTertiary: mode === "light" ? "#1C1A17" : "#F4F1EA",
        onBrandTertiary: mode === "light" ? "#FFFCF6" : "#1C1A17",
      };
    case "signal":
      return wash(colors, mode, mode === "light" ? "#D5D8DE" : "#1C2430", mode === "light" ? 0.2 : 0.28, 0);
    case "poster":
      return wash(colors, mode, mode === "light" ? "#F0D7B8" : "#4A3018", mode === "light" ? 0.48 : 0.36, 0.28);
    default: {
      const unknown: never = lookId;
      return unknown;
    }
  }
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
