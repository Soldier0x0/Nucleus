/**
 * Local notifications for rule reminders. Nothing is sent anywhere: these are one-off
 * alarms handed to Android/iOS, computed on-device from your own data.
 * Requires an installed build — local notifications do not fire in Expo Go.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { Reminder } from "./rules";

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

export async function requestPermission(): Promise<PermissionState> {
  if (!notificationsSupported) return { granted: false, canAskAgain: false, undetermined: false };
  ensureHandler();
  const p = await Notifications.requestPermissionsAsync();
  return { granted: p.status === "granted", canAskAgain: p.canAskAgain, undetermined: p.status === "undetermined" };
}

const CYCLE_PREFIX = "cycle:";

async function cancelScheduled(keepCycle: boolean) {
  let existing: Awaited<ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>> = [];
  try {
    existing = await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return;
  }
  await Promise.all(
    existing.map(async (item) => {
      const key = item.content?.data?.key;
      const cycle = typeof key === "string" && key.startsWith(CYCLE_PREFIX);
      if (keepCycle && cycle) return;
      if (!keepCycle && !cycle) return;
      await Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => {});
    }),
  );
}

/** Replace rule reminders. Cycle alarms use their own ids and are left in place. */
export async function syncReminders(list: Reminder[]): Promise<string[]> {
  if (!notificationsSupported) return [];
  const p = await permissionState();
  if (!p.granted) return [];
  ensureHandler();
  await cancelScheduled(true);
  const done: string[] = [];
  for (const r of list) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, data: { key: r.key } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: "nucleus-reminders" },
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

/**
 * Replace cycle alarms. The lock-screen text is the title only.
 * No body, and no separate notification icon — Android keeps the app icon.
 */
export async function syncCycleNotices(list: { id: string; title: string; at: Date }[]): Promise<void> {
  if (!notificationsSupported) return;
  ensureHandler();
  await cancelScheduled(false);
  for (const id of ["cycle:period", "cycle:change"]) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
  const p = await permissionState();
  if (!p.granted) return;
  for (const notice of list) {
    if (!notice.title || notice.at.getTime() <= Date.now()) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: notice.id,
        content: { title: notice.title, body: "", data: { key: notice.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: notice.at, channelId: "nucleus-reminders" },
      });
    } catch {
      /* one bad date must not block the other */
    }
  }
}
