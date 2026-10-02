import { createContext, useContext } from "react";

export const palettes = {
  light: {
    surface: "#F6F7F9",
    onSurface: "#111418",
    surfaceSecondary: "#FFFFFF",
    onSurfaceSecondary: "#111418",
    surfaceTertiary: "#EAECEF",
    onSurfaceTertiary: "#111418",
    surfaceInverse: "#111418",
    onSurfaceInverse: "#FFFFFF",
    brand: "#D68E42",
    brandPrimary: "#D68E42",
    onBrandPrimary: "#FFFFFF",
    brandSecondary: "#ECAE6A",
    onBrandSecondary: "#111418",
    brandTertiary: "#FCEBDC",
    onBrandTertiary: "#8E551B",
    success: "#378B5F",
    onSuccess: "#FFFFFF",
    warning: "#C27A2C",
    onWarning: "#FFFFFF",
    error: "#C94F4F",
    onError: "#FFFFFF",
    info: "#4A6E82",
    onInfo: "#FFFFFF",
    border: "#E2E4E8",
    borderStrong: "#C2C6CC",
    divider: "#E2E4E8",
    muted: "#687079",
    onBrand: "#FFFFFF",
    backdrop: "rgba(17,20,24,0.45)",
  },
  dark: {
    surface: "#101112",
    onSurface: "#F0F2F5",
    surfaceSecondary: "#1A1C1E",
    onSurfaceSecondary: "#F0F2F5",
    surfaceTertiary: "#25282B",
    onSurfaceTertiary: "#F0F2F5",
    surfaceInverse: "#F0F2F5",
    onSurfaceInverse: "#101112",
    brand: "#D68E42",
    brandPrimary: "#D68E42",
    onBrandPrimary: "#101112",
    brandSecondary: "#ECAE6A",
    onBrandSecondary: "#101112",
    brandTertiary: "#3E2B16",
    onBrandTertiary: "#FCEBDC",
    success: "#44AB75",
    onSuccess: "#101112",
    warning: "#ECAE6A",
    onWarning: "#101112",
    error: "#DE5C5C",
    onError: "#101112",
    info: "#5B879F",
    onInfo: "#101112",
    border: "#2A2D30",
    borderStrong: "#41464B",
    divider: "#2A2D30",
    muted: "#8A9198",
    onBrand: "#101112",
    backdrop: "rgba(0,0,0,0.6)",
  },
};

export type Colors = typeof palettes.light;
export const colors = palettes.light;

/** User-selectable accents. Each defines its light & dark tonal set. No blue/purple by design. */
export const accents: Record<string, { name: string; base: string; light2: string; tint: string; onTint: string; tintDark: string; onTintDark: string }> = {
  ochre: { name: "Ochre", base: "#D68E42", light2: "#ECAE6A", tint: "#FCEBDC", onTint: "#8E551B", tintDark: "#3E2B16", onTintDark: "#FCEBDC" },
  moss: { name: "Moss", base: "#5E8C61", light2: "#86B089", tint: "#E3EFE3", onTint: "#2F5532", tintDark: "#1F2E20", onTintDark: "#E3EFE3" },
  terracotta: { name: "Terracotta", base: "#C0643F", light2: "#DA8B6B", tint: "#F8E2D8", onTint: "#7A3519", tintDark: "#3A2016", onTintDark: "#F8E2D8" },
  teal: { name: "Teal", base: "#2F8F86", light2: "#5FB3AB", tint: "#DCF0EE", onTint: "#16524C", tintDark: "#15302D", onTintDark: "#DCF0EE" },
  graphite: { name: "Graphite", base: "#5A6068", light2: "#8A9098", tint: "#E6E8EB", onTint: "#2E3238", tintDark: "#24272B", onTintDark: "#E6E8EB" },
  rose: { name: "Rose", base: "#B85C72", light2: "#D58A9B", tint: "#F6E1E6", onTint: "#6E2A3A", tintDark: "#36202A", onTintDark: "#F6E1E6" },
};

export function buildColors(mode: "light" | "dark", accentKey: string): Colors {
  const base = palettes[mode];
  const a = accents[accentKey] ?? accents.ochre;
  return {
    ...base,
    brand: a.base,
    brandPrimary: a.base,
    brandSecondary: a.light2,
    brandTertiary: mode === "light" ? a.tint : a.tintDark,
    onBrandTertiary: mode === "light" ? a.onTint : a.onTintDark,
  };
}

export const fonts = {
  text: "Inter-Regular",
  textMedium: "Inter-Medium",
  textSemi: "Inter-SemiBold",
  textBold: "Inter-Bold",
  mono: "JetBrainsMono-Regular",
  monoMedium: "JetBrainsMono-Medium",
  monoBold: "JetBrainsMono-Bold",
};

export const type = { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 32 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 4, md: 8, lg: 12, pill: 999 };

export type Theme = {
  mode: "light" | "dark";
  colors: Colors;
  dense: boolean;
  /** density-aware spacing */
  sp: typeof spacing;
};

export function buildTheme(mode: "light" | "dark", accentKey: string, dense: boolean): Theme {
  const f = dense ? 0.75 : 1;
  const sp = Object.fromEntries(Object.entries(spacing).map(([k, v]) => [k, Math.round(v * f)])) as typeof spacing;
  return { mode, colors: buildColors(mode, accentKey), dense, sp };
}

export const ThemeContext = createContext<Theme>(buildTheme("light", "ochre", false));
export const useTheme = () => useContext(ThemeContext);
