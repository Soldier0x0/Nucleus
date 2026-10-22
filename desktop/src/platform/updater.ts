/**
 * Desktop self-update over the Tauri updater plugin (endpoint: the latest.json
 * that the release workflow attaches to every release).
 *
 * The manifest carries a target per install flavour — `linux-x86_64-deb`,
 * `linux-x86_64-appimage`, `linux-x86_64` and `windows-x86_64[-nsis]` — and the
 * plugin picks the one matching how this copy was installed, so a deb install
 * pays with `dpkg -i` (pkexec/terminal password prompt) while an AppImage
 * rewrites itself and Windows hands over to its installer.
 *
 * - `startupAutoUpdate()` — silent check shortly after launch: download, install,
 *   relaunch. Errors stay in the console; the user is never blocked.
 * - `checkForUpdateNow()` — the manual Settings flow, with progress messages.
 * - `friendlyUpdateError()` — maps plugin errors to plain language, including
 *   the one-time manual reinstall the pre-fix deb releases need.
 */
import { isTauri } from "./env";

const CHECK_TIMEOUT = 30_000;

const runsOnWindows = () => navigator.userAgent.includes("Windows");

/** Relaunch is not fired on Windows: its installer exits and restarts the app itself. */
async function relaunchAfterInstall() {
  if (runsOnWindows()) return;
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

/** The startup path: anything failing here must never surface in the UI. */
export async function startupAutoUpdate(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check({ timeout: CHECK_TIMEOUT });
    if (!update) return;
    await update.downloadAndInstall();
    await relaunchAfterInstall();
  } catch (err) {
    console.warn("[nucleus] automatic update did not run:", err);
  }
}

/** The manual path behind the Settings "Check for updates" button. */
export async function checkForUpdateNow(setMsg: (msg: string) => void): Promise<void> {
  if (!isTauri()) return;
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check({ timeout: CHECK_TIMEOUT });
  if (!update) {
    setMsg("You are on the newest release.");
    return;
  }
  setMsg(`Downloading v${update.version}…`);
  await update.downloadAndInstall();
  if (runsOnWindows()) {
    setMsg("Installed. Nucleus will reopen on its own.");
    return;
  }
  setMsg("Installed. Reopening Nucleus.");
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

export function friendlyUpdateError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/not a valid deb|invalid updater format/i.test(raw)) {
    return "This install predates the deb update feed: install the newest .deb from Releases once — after that updates install themselves.";
  }
  if (/TargetNotFound|TargetsNotFound|no entry/i.test(raw)) {
    return "No signed package for this install in the current release. Grab the newest installer from Releases.";
  }
  if (/signature|InvalidEncoding|checksum/i.test(raw)) {
    return "The update failed its signature check, so nothing was installed.";
  }
  return raw || "The update check failed.";
}
