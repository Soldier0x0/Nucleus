/**
 * Local notifications for rule reminders. Nothing is sent anywhere: these are one-off
 * alarms handed to Android/iOS, computed on-device from your own data.
 * Requires an installed build — local notifications do not fire in Expo Go.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { Reminder } from "./rules";
import { waterNoticeCopy } from "./water";

export const notificationsSupported = Platform.OS !== "web";

let handlerSet = false;
function ensureHandler() {
  if (handlerSet || !notificationsSupported) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === "android")
    Notifications.setNotificationChannelAsync("nucleus-reminders", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
    }).catch(() => {});
}

export type PermissionState = { granted: boolean; canAskAgain: boolean; undetermined: boolean };

export async function permissionState(): Promise<PermissionState> {
  if (!notificationsSupported) return { granted: false, canAskAgain: false, undetermined: false };
  const p = await Notifications.getPermissionsAsync();
  return { granted: p.status === "granted", canAskAgain: p.canAskAgain, undetermined: p.status === "undetermined" };
}

/** One local notification. A failed upload uses this once. */
export async function notifyOnce(title: string, body: string) {
  if (!notificationsSupported) return;
  ensureHandler();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { key: "once" } },
    trigger: null,
  }).catch(() => {});
}

/** Public lock-screen visibility. The card is allowed to show before the phone is unlocked. */
export async function allowLockScreenChannel() {
  if (!notificationsSupported || Platform.OS !== "android") return;
  ensureHandler();
  await Notifications.setNotificationChannelAsync("nucleus-lock", {
    name: "Lock screen",
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: null,
  }).catch(() => {});
}

export async function requestPermission(): Promise<PermissionState> {
  if (!notificationsSupported) return { granted: false, canAskAgain: false, undetermined: false };
  ensureHandler();
  const p = await Notifications.requestPermissionsAsync();
  return { granted: p.status === "granted", canAskAgain: p.canAskAgain, undetermined: p.status === "undetermined" };
}

const CYCLE_PREFIX = "cycle:";
const WATER_PREFIX = "water:";

function keptAlarm(key: string): boolean {
  return key.startsWith(CYCLE_PREFIX) || key.startsWith(WATER_PREFIX) || key.startsWith("heads-up") || key.startsWith("adhd:");
}

async function cancelMatching(match: (key: string) => boolean) {
  let existing: Awaited<ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>> = [];
  try {
    existing = await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return;
  }
  await Promise.all(
    existing.map(async (item) => {
      const key = item.content?.data?.key;
      if (typeof key !== "string" || !match(key)) return;
      await Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => {});
    }),
  );
}

async function ensureChannel(id: string, name: string, opts: { color?: string; lockPublic: boolean }) {
  if (!notificationsSupported || Platform.OS !== "android") return;
  ensureHandler();
  await Notifications.setNotificationChannelAsync(id, {
    name,
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    lockscreenVisibility: opts.lockPublic ? Notifications.AndroidNotificationVisibility.PUBLIC : Notifications.AndroidNotificationVisibility.PRIVATE,
    ...(opts.color ? { lightColor: opts.color, enableLights: true } : {}),
  }).catch(() => {});
}

/** Replace rule reminders. Cycle alarms use their own ids and are left in place. */
export async function syncReminders(list: Reminder[], channelId = "nucleus-reminders"): Promise<string[]> {
  if (!notificationsSupported) return [];
  const p = await permissionState();
  if (!p.granted) return [];
  ensureHandler();
  if (channelId === "nucleus-lock") await allowLockScreenChannel();
  await cancelMatching((key) => !keptAlarm(key));
  const done: string[] = [];
  for (const r of list) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, data: { key: r.key } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId },
      });
      done.push(r.key);
    } catch {
      /* a single bad date must not break the rest */
    }
  }
  return done;
}

export async function scheduledCount() {
  if (!notificationsSupported) return 0;
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch {
    return 0;
  }
}

export async function cancelAll() {
  if (!notificationsSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export const CYCLE_NOTICE_PINK = "#C48998";

export type CycleNoticeOptions = { pink?: boolean; hide?: boolean; lockPublic?: boolean };

/**
 * Replace cycle alarms. The lock-screen text is the title only.
 * A pink tint applies to these reminders only.
 */
export async function syncCycleNotices(list: { id: string; title: string; at: Date }[], options: CycleNoticeOptions = {}): Promise<void> {
  if (!notificationsSupported) return;
  ensureHandler();
  await cancelMatching((key) => key.startsWith(CYCLE_PREFIX));
  for (const id of ["cycle:period", "cycle:change", "cycle:rematch"]) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
  const p = await permissionState();
  if (!p.granted) return;
  const pink = options.pink === true;
  const channelId = "nucleus-cycle";
  await ensureChannel(channelId, "Cycle", { color: pink ? CYCLE_NOTICE_PINK : undefined, lockPublic: options.lockPublic === true });
  for (const notice of list) {
    const title = options.hide ? "Reminder" : notice.title;
    if (!title || notice.at.getTime() <= Date.now()) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: notice.id,
        content: {
          title,
          body: "",
          data: { key: notice.id },
          ...(pink ? { color: CYCLE_NOTICE_PINK } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: notice.at, channelId },
      });
    } catch {
      /* one bad date must not block the other */
    }
  }
}

/** Daily water reminders at the times the person set. These stay untinted. */
export async function syncWaterNotices(
  list: { id: string; hour: number; minute: number }[],
  options: { hide?: boolean; lockPublic?: boolean } = {},
): Promise<void> {
  if (!notificationsSupported) return;
  ensureHandler();
  await cancelMatching((key) => key.startsWith(WATER_PREFIX));
  const p = await permissionState();
  if (!p.granted) return;
  const copy = waterNoticeCopy(options.hide === true);
  const channelId = "nucleus-water";
  await ensureChannel(channelId, "Water", { lockPublic: options.lockPublic === true });
  for (const notice of list) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: notice.id,
        content: { title: copy.title, body: copy.body, data: { key: notice.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: notice.hour, minute: notice.minute, channelId },
      });
    } catch {
      /* one bad time must not block the others */
    }
  }
}
