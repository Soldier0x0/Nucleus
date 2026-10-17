/**
 * Start with the computer (v0.14). The plugin registers a launch-agent /
 * run-key entry; the toggle lives in Settings → General. Browser preview
 * reports false and refuses.
 */
import { isTauri } from "./env";

export async function autostartEnabled(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { isEnabled } = await import("@tauri-apps/plugin-autostart");
    return await isEnabled();
  } catch {
    return false;
  }
}

export async function autostartSet(on: boolean): Promise<void> {
  if (!isTauri()) return;
  const { enable, disable } = await import("@tauri-apps/plugin-autostart");
  await (on ? enable() : disable());
}
