/**
 * Support surfaces (v0.17): where Nucleus gratefully accepts help.
 * One source of truth for the URLs so the sidebar row, the About card and
 * the one-time nudge can never drift apart.
 */

export const BMC_URL = "https://buymeacoffee.com/soldier0x0";
export const SPONSORS_URL = "https://github.com/sponsors/Soldier0x0";

/** localStorage flag: the one-time support nudge is shown exactly once. */
export const NUDGE_SEEN_KEY = "nucleus.support.nudge.seen";

/** Open an external page in the system browser (falls back in plain web). */
export async function openExternal(url: string): Promise<void> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
