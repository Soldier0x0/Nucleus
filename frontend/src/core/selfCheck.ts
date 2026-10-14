import type { DB } from "./types";

export const SELF_CHECK_SCHEMA = "nucleus-self-check/1";

export type CheckStatus = "pass" | "warn" | "fail" | "skip";
/** In-app or screen fixes. Only fixes listed in DATA_FIXES change saved data, and those ask first. */
export type FixId = "notify-permission" | "notification-access" | "bank-switch-on" | "open-settings" | "open-vehicles" | "app-settings";
export const DATA_FIXES: readonly FixId[] = ["bank-switch-on"];

export type CheckResult = { id: string; label: string; status: CheckStatus; detail: string; fix?: FixId; fixLabel?: string };

/** Everything the checks read. Gathered by the screen, so the checks stay pure and testable. */
export type Probes = {
  platform: string;
  dbReadable: boolean;
  db: DB;
  pinSet: boolean;
  biometricAvailable: boolean;
  /** null where the platform has no notification permission (web). */
  notifyGranted: boolean | null;
  /** null where the platform has no notification listener (web, iOS, Expo Go). */
  notificationAccess: boolean | null;
  scheduledReminders: number | null;
  version: string;
  docBytes: number;
  now: string;
};

const DAY = 86400000;
const n = (x: number, one: string, many = `${one}s`) => `${x} ${x === 1 ? one : many}`;

export function runChecks(p: Probes): CheckResult[] {
  const s = p.db.settings;
  const out: CheckResult[] = [];
  const add = (r: CheckResult) => out.push(r);

  add(p.dbReadable ? { id: "storage", label: "Saved data opens", status: "pass", detail: "Decrypted and read" } : { id: "storage", label: "Saved data opens", status: "fail", detail: "The saved file could not be read" });

  if (s.readOnly) add({ id: "access", label: "This phone can edit", status: "warn", detail: "Opened read-only from another phone" });
  else add({ id: "access", label: "This phone can edit", status: s.installId ? "pass" : "warn", detail: s.installId ? "Device id set" : "Device id not set yet" });

  if (!s.lockEnabled) add({ id: "lock", label: "App lock", status: "warn", detail: "App lock is off", fix: "open-settings", fixLabel: "Open Settings" });
  else add(p.pinSet ? { id: "lock", label: "App lock", status: "pass", detail: "On, PIN saved" } : { id: "lock", label: "App lock", status: "fail", detail: "On, but no PIN is saved", fix: "open-settings", fixLabel: "Set a PIN" });

  if (!s.lockEnabled || !s.biometricEnabled) add({ id: "biometric", label: "Biometric unlock", status: "skip", detail: "Not in use" });
  else add(p.biometricAvailable ? { id: "biometric", label: "Biometric unlock", status: "pass", detail: "Available on this phone" } : { id: "biometric", label: "Biometric unlock", status: "fail", detail: "Turned on, but the phone has no enrolled biometrics", fix: "open-settings", fixLabel: "Open Settings" });

  if (p.notifyGranted === null) add({ id: "notify", label: "Notifications allowed", status: "skip", detail: "Not on this platform" });
  else add(p.notifyGranted ? { id: "notify", label: "Notifications allowed", status: "pass", detail: "Allowed" } : { id: "notify", label: "Notifications allowed", status: "fail", detail: "Reminders cannot show", fix: "notify-permission", fixLabel: "Allow" });

  if (p.scheduledReminders === null) add({ id: "reminders", label: "Scheduled reminders", status: "skip", detail: "Not on this platform" });
  else add({ id: "reminders", label: "Scheduled reminders", status: "pass", detail: `${n(p.scheduledReminders, "reminder")} scheduled` });

  if (p.notificationAccess === null) add({ id: "bank-access", label: "Notification access (bank texts)", status: "skip", detail: "Not on this platform" });
  else if (!s.smsInbox && !p.notificationAccess) add({ id: "bank-access", label: "Notification access (bank texts)", status: "skip", detail: "Bank texts are off" });
  else if (!p.notificationAccess) add({ id: "bank-access", label: "Notification access (bank texts)", status: "fail", detail: "Bank texts are on, but access is off. On a sideloaded APK, allow restricted settings first", fix: "notification-access", fixLabel: "Open access" });
  else add({ id: "bank-access", label: "Notification access (bank texts)", status: "pass", detail: "Granted" });

  if (p.notificationAccess && !s.smsInbox) add({ id: "bank-switch", label: "Bank texts switch", status: "warn", detail: "Access is granted but bank texts are off", fix: "bank-switch-on", fixLabel: "Turn on" });
  else add({ id: "bank-switch", label: "Bank texts switch", status: s.smsInbox ? "pass" : "skip", detail: s.smsInbox ? "On" : "Off" });

  const badVehicles = p.db.vehicles.filter((v) => !(v.serviceIntervalKm > 0) || !(v.initialOdometer >= 0)).length;
  add(badVehicles ? { id: "vehicles", label: "Vehicle service data", status: "warn", detail: `${n(badVehicles, "vehicle")} with a missing service interval or odometer`, fix: "open-vehicles", fixLabel: "Open Vehicles" } : { id: "vehicles", label: "Vehicle service data", status: "pass", detail: `${n(p.db.vehicles.length, "vehicle")} checked` });

  const badFuel = p.db.fuel.filter((f) => !f.date || !Number.isFinite(f.odometer) || f.odometer < 0).length;
  add(badFuel ? { id: "fuel", label: "Fuel log", status: "warn", detail: `${n(badFuel, "entry", "entries")} with no date or a bad odometer`, fix: "open-vehicles", fixLabel: "Open Vehicles" } : { id: "fuel", label: "Fuel log", status: "pass", detail: `${n(p.db.fuel.length, "entry", "entries")} checked` });

  const files = p.db.papers.filter((x) => x.file);
  const oddFiles = files.filter((x) => !/^(data:|file:|content:)/.test(x.file ?? "")).length;
  add(oddFiles ? { id: "papers", label: "Document files", status: "warn", detail: `${n(oddFiles, "file")} saved in a form the viewer may not open` } : { id: "papers", label: "Document files", status: "pass", detail: `${n(files.length, "file")} of ${n(p.db.papers.length, "paper")} attached` });

  const last = s.lastBackupAt ? Date.parse(s.lastBackupAt) : NaN;
  const age = Number.isFinite(last) ? Math.floor((Date.parse(p.now) - last) / DAY) : null;
  if (age === null) add({ id: "backup", label: "Backup", status: "warn", detail: "Never backed up", fix: "open-settings", fixLabel: "Back up" });
  else add({ id: "backup", label: "Backup", status: age > 30 ? "warn" : "pass", detail: `Last backup ${n(age, "day")} ago`, ...(age > 30 ? { fix: "open-settings" as const, fixLabel: "Back up" } : {}) });

  const mb = p.docBytes / 1048576;
  add({ id: "size", label: "Data size", status: mb > 20 ? "warn" : "pass", detail: `${mb.toFixed(1)} MB${mb > 20 ? ". Large photos or PDFs slow saving" : ""}` });

  add({ id: "sync", label: "Delete markers", status: "pass", detail: `${n(p.db.tombstones?.length ?? 0, "marker")} kept for sync` });

  add(p.version ? { id: "version", label: "App version", status: "pass", detail: p.version } : { id: "version", label: "App version", status: "warn", detail: "Version stamp missing" });

  return out;
}

export type Progress = { done: number; total: number; passed: number; failed: number };

/** Runs the checks one by one so the screen can show a live counter. */
export async function runSelfCheck(probes: Probes, onProgress: (p: Progress, latest: CheckResult) => void, pause: () => Promise<void> = () => new Promise((r) => setTimeout(r, 60))): Promise<CheckResult[]> {
  const all = runChecks(probes);
  const shown: CheckResult[] = [];
  for (const r of all) {
    await pause();
    shown.push(r);
    onProgress({ done: shown.length, total: all.length, passed: shown.filter((x) => x.status === "pass").length, failed: shown.filter((x) => x.status === "fail").length }, r);
  }
  return shown;
}

export type SelfCheckReport = {
  schema: string;
  at: string;
  version: string;
  platform: string;
  summary: Record<CheckStatus, number>;
  checks: { id: string; status: CheckStatus; detail: string }[];
};

/** Statuses and counts only. Never names, amounts, notes, file names or message text. */
export function buildReport(results: CheckResult[], meta: { at: string; version: string; platform: string }): SelfCheckReport {
  const summary: Record<CheckStatus, number> = { pass: 0, warn: 0, fail: 0, skip: 0 };
  for (const r of results) summary[r.status] += 1;
  return { schema: SELF_CHECK_SCHEMA, ...meta, summary, checks: results.map(({ id, status, detail }) => ({ id, status, detail })) };
}

export function reportText(report: SelfCheckReport): string {
  const head = [`Nucleus self-check · ${report.at}`, `Version ${report.version || "unknown"} · ${report.platform}`, `${report.summary.pass} passed, ${report.summary.warn} to look at, ${report.summary.fail} failed, ${report.summary.skip} skipped`, ""];
  return [...head, ...report.checks.map((c) => `[${c.status.toUpperCase()}] ${c.id}: ${c.detail}`)].join("\n");
}
