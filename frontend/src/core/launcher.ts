/**
 * Which packaged picture the Android home screen shows.
 * The bitmap cannot be drawn at runtime, so each family and ground is an activity-alias.
 */
import type { IconFamily, IconVariant, LauncherChoice, ThemeKey } from "./types";

export const ICON_FAMILIES = ["paper", "metal", "glass", "tiles"] as const;
export const ICON_VARIANTS = ["paper", "midnight", "dune", "amoled"] as const;

export const ICON_FAMILY_LABEL: Record<IconFamily, string> = {
  paper: "Paper press",
  metal: "Metal ring",
  glass: "Glass core",
  tiles: "Tiles",
};

export const ICON_VARIANT_LABEL: Record<IconVariant, string> = {
  paper: "Paper",
  midnight: "Midnight",
  dune: "Dune",
  amoled: "AMOLED",
};

export const defaultLauncher = (): LauncherChoice => ({ family: "paper", variant: "paper" });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function launcherAlias(family: IconFamily, variant: IconVariant) {
  return `Icon${cap(family)}${cap(variant)}`;
}

export function themeToIconVariant(theme: ThemeKey, scheme?: "light" | "dark" | "unspecified" | null): IconVariant {
  switch (theme) {
    case "paper":
      return "paper";
    case "dune":
      return "dune";
    case "amoled":
      return "amoled";
    case "midnight":
    case "graphite":
      return "midnight";
    case "system":
      return scheme === "light" ? "paper" : "midnight";
    default: {
      const unreachable: never = theme;
      return unreachable;
    }
  }
}

export type ResolvedLauncher = { family: IconFamily; variant: IconVariant; alias: string };

export function resolveLauncher(choice: LauncherChoice, theme: ThemeKey, scheme?: "light" | "dark" | "unspecified" | null): ResolvedLauncher {
  const variant = choice.variant === "match" ? themeToIconVariant(theme, scheme) : choice.variant;
  return { family: choice.family, variant, alias: launcherAlias(choice.family, variant) };
}

export function parseLauncher(raw: unknown): LauncherChoice {
  const family = raw && typeof raw === "object" && "family" in raw ? (raw as { family?: unknown }).family : undefined;
  const variant = raw && typeof raw === "object" && "variant" in raw ? (raw as { variant?: unknown }).variant : undefined;
  const families: readonly string[] = ICON_FAMILIES;
  const variants: readonly string[] = [...ICON_VARIANTS, "match"];
  if (typeof family === "string" && families.includes(family) && typeof variant === "string" && variants.includes(variant)) {
    return { family: family as IconFamily, variant: variant as LauncherChoice["variant"] };
  }
  return defaultLauncher();
}

export type MarkPalette = { ground: string; ring: string; core: string; tick: string };

function groundFor(variant: IconVariant) {
  switch (variant) {
    case "paper":
      return "#F3EDE4";
    case "midnight":
      return "#0B0D12";
    case "dune":
      return "#E7D3B5";
    case "amoled":
      return "#000000";
    default: {
      const unreachable: never = variant;
      return unreachable;
    }
  }
}

function paperPalette(variant: IconVariant, ground: string): MarkPalette {
  switch (variant) {
    case "paper":
      return { ground, ring: "#1A1A1A", core: "#C9843A", tick: "#1A1A1A" };
    case "midnight":
      return { ground, ring: "#D68E42", core: "#F4EFE6", tick: "#D68E42" };
    case "dune":
      return { ground, ring: "#C4B5A0", core: "#C9843A", tick: "#C4B5A0" };
    case "amoled":
      return { ground, ring: "#3A3A3A", core: "#D68E42", tick: "#3A3A3A" };
    default: {
      const unreachable: never = variant;
      return unreachable;
    }
  }
}

export function markPalette(family: IconFamily, variant: IconVariant): MarkPalette {
  const ground = groundFor(variant);
  switch (family) {
    case "paper":
      return paperPalette(variant, ground);
    case "metal":
      return { ground, ring: "#C9843A", core: "#E0A15A", tick: "#C9843A" };
    case "glass":
      return { ground, ring: "#C9A15A", core: "#E8B86A", tick: "#C9A15A" };
    case "tiles":
      return { ground, ring: ground, core: "#D68E42", tick: ground };
    default: {
      const unreachable: never = family;
      return unreachable;
    }
  }
}

export const LAUNCHER_ALIASES = ICON_FAMILIES.flatMap((family) => ICON_VARIANTS.map((variant) => launcherAlias(family, variant)));

/** How PackageManager reports one activity-alias. "default" follows the manifest. */
export type AliasComponentState = "default" | "enabled" | "disabled" | "disabled-user" | "disabled-until-used";

export type LauncherIconPlan = {
  changed: boolean;
  enable: string[];
  disable: string[];
};

/** IconPaperPaper is the only alias the manifest enables. The rest start disabled. */
const MANIFEST_ENABLED_ALIAS = "IconPaperPaper";

function aliasIsEnabled(alias: string, state: AliasComponentState): boolean {
  switch (state) {
    case "enabled":
      return true;
    case "disabled":
    case "disabled-user":
    case "disabled-until-used":
      return false;
    case "default":
      return alias === MANIFEST_ENABLED_ALIAS;
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}

/** Writes only the aliases whose enabled state actually changes. An unchanged picture writes nothing. */
export function launcherIconChange(
  states: Readonly<Record<string, AliasComponentState | undefined>>,
  nextAlias: string,
): LauncherIconPlan {
  if (!LAUNCHER_ALIASES.includes(nextAlias)) return { changed: false, enable: [], disable: [] };
  const on = LAUNCHER_ALIASES.filter((alias) => aliasIsEnabled(alias, states[alias] ?? "default"));
  if (on.length === 1 && on[0] === nextAlias) return { changed: false, enable: [], disable: [] };
  const enable = on.includes(nextAlias) ? [] : [nextAlias];
  const disable = on.filter((alias) => alias !== nextAlias);
  return { changed: enable.length > 0 || disable.length > 0, enable, disable };
}
