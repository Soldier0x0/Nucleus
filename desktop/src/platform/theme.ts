import { localPrefs } from "./storage";

export const THEME_KEY = "nucleus.desktop.theme";

export function applyThemePref(pref: string) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function storedThemePref(): string {
  return localPrefs.get(THEME_KEY) ?? "dark";
}

export function applyStoredTheme() {
  applyThemePref(storedThemePref());
}
