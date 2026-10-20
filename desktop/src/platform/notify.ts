/**
 * Desktop reminders: an in-process scheduler over the webview's own
 * Notification API. Nothing is sent anywhere — alarms are computed from
 * your own data and fire while the app is running. The phone keeps its
 * own OS-level schedules, so closing this window loses nothing.
 */
import type { Reminder } from "@core/rules";
import { waterNoticeCopy } from "@core/water";

type Alarm = { id: string; title: string; body: string; at: number };

export const notificationsSupported = typeof Notification !== "undefined" && typeof window !== "undefined";

export const CYCLE_NOTICE_PINK = "#C48998";
const CYCLE_PREFIX = "cycle:";
const WATER_PREFIX = "water:";

const alarms = new Map<string, Alarm>();
const fired = new Set<string>();
let ticker: ReturnType<typeof setInterval> | null = null;

export type PermissionState = { granted: boolean; canAskAgain: boolean; undetermined: boolean };

export async function permissionState(): Promise<PermissionState> {
  if (!notificationsSupported) return { granted: false, canAskAgain: false, undetermined: false };
  const granted = Notification.permission === "granted";
  const undetermined = Notification.permission === "default";
  return { granted, canAskAgain: undetermined, undetermined };
}

export async function requestPermission(): Promise<PermissionState> {
  if (!notificationsSupported) return { granted: false, canAskAgain: false, undetermined: false };
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      /* a silent webview keeps the switch off */
    }
  }
  return permissionState();
}

/** A "no" keeps the toggle off and the reason visible. */
export async function allowNotify(): Promise<boolean> {
  const p = await requestPermission();
  return p.granted;
}

function show(alarm: Alarm) {
  if (!notificationsSupported) return;
  try {
    const n = new Notification(alarm.title, { body: alarm.body });
    n.onclick = () => {
      try {
        window.focus();
        n.close();
      } catch {
        /* the window may already be focused */
      }
    };
  } catch {
    /* one blocked notice must not stop the rest */
  }
}

function tick() {
  const now = Date.now();
  for (const alarm of alarms.values()) {
    if (alarm.at <= now && !fired.has(alarm.id)) {
      fired.add(alarm.id);
      alarms.delete(alarm.id);
      show(alarm);
    }
  }
}

function ensureTicker() {
  if (ticker || !notificationsSupported) return;
  ticker = setInterval(tick, 30_000);
}

function replaceWith(prefix: string, list: Alarm[]) {
  ensureTicker();
  for (const id of [...alarms.keys()]) if (id.startsWith(prefix)) alarms.delete(id);
  for (const alarm of list) {
    alarms.set(alarm.id, alarm);
    fired.delete(alarm.id);
  }
}

/** One local notification. A failed upload uses this once. */
export async function notifyOnce(title: string, body: string) {
  show({ id: `once:${Date.now()}`, title, body, at: 0 });
}

export function prepareChannels() {}

/** Replace rule reminders, keeping cycle / water / heads-up alarms (phone parity). */
export async function syncReminders(list: Reminder[]): Promise<string[]> {
  const p = await permissionState();
  if (!p.granted) return [];
  replaceWith(
    "rule:",
    list.map((r) => ({ id: r.key, title: r.title, body: r.body, at: r.at.getTime() })),
  );
  return list.map((r) => r.key);
}

export async function scheduledCount() {
  return alarms.size;
}

export async function cancelAll() {
  alarms.clear();
}

export type CycleNoticeOptions = { pink?: boolean; hide?: boolean; lockPublic?: boolean };

/** Replace cycle alarms (table of {id,title,at}); the desktop version shows the plain line. */
export async function syncCycleNotices(list: { id: string; title: string; at: Date }[], options: CycleNoticeOptions = {}): Promise<void> {
  const p = await permissionState();
  if (!p.granted) return;
  replaceWith(
    CYCLE_PREFIX,
    list.map((n) => ({ id: n.id, title: options.hide ? "Reminder" : n.title, body: "", at: n.at.getTime() })),
  );
}

/** Daily water reminders at the set times; each becomes the next occurrence. */
export async function syncWaterNotices(
  list: { id: string; hour: number; minute: number }[],
  options: { hide?: boolean; lockPublic?: boolean } = {},
): Promise<void> {
  const p = await permissionState();
  if (!p.granted) return;
  const copy = waterNoticeCopy(options.hide === true);
  const listAlarms: Alarm[] = list.map((n) => {
    const at = new Date();
    at.setHours(n.hour, n.minute, 0, 0);
    if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
    return { id: n.id, title: copy.title, body: copy.body, at: at.getTime() };
  });
  replaceWith(WATER_PREFIX, listAlarms);
}
