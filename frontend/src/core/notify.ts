/**
 * Local notifications for rule reminders. Nothing is sent anywhere: these are one-off
 * alarms handed to Android/iOS, computed on-device from your own data.
 * Requires an installed build — local notifications do not fire in Expo Go.
 */
import { Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { Reminder } from "./rules";
import { waterNoticeCopy } from "./water";

export const notificationsSupported = Platform.OS !== "web";

/**
 * v0.9.8 channels. Android does not let an app change the sound of a channel it already made,
 * so the old silent ids are deleted and these new ids carry a sound (plan Q9).
 * Each type is its own channel, so its sound can be changed in Android's channel settings.
 */
export const CHANNELS = {
  reminders: "nucleus-reminders-v2",
  water: "nucleus-water-v2",
  smsAsk: "nucleus-sms-ask",
  cycle: "nucleus-cycle-v2",
  lock: "nucleus-lock-v2",
} as const;
export type ChannelKey = keyof typeof CHANNELS;
export const OLD_CHANNELS = ["nucleus-reminders", "nucleus-water", "nucleus-cycle", "nucleus-lock"];
export const CHANNEL_NAMES: Record<ChannelKey, string> = {
  reminders: "Reminders",
  water: "Water",
  smsAsk: "Bank text questions",
  cycle: "Cycle",
  lock: "Lock screen",
};

let handlerSet = false;
function ensureHandler() {
  if (handlerSet || !notificationsSupported) return;
  handlerSet = true;
  // Quiet hours move the scheduled time (rules.ts), so a notice that does arrive may play its sound.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === "android") {
    for (const id of OLD_CHANNELS) Notifications.deleteNotificationChannelAsync(id).catch(() => {});
    Notifications.setNotificationChannelAsync(CHANNELS.reminders, {
      name: CHANNEL_NAMES.reminders,
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    }).catch(() => {});
    Notifications.setNotificationChannelAsync(CHANNELS.smsAsk, {
      name: CHANNEL_NAMES.smsAsk,
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    }).catch(() => {});
    // Every channel must exist before the Sound rows in Settings are tapped:
    // Android's channel-settings deep link goes nowhere for a channel id that was never made.
    Notifications.setNotificationChannelAsync(CHANNELS.water, {
      name: CHANNEL_NAMES.water,
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    }).catch(() => {});
    Notifications.setNotificationChannelAsync(CHANNELS.cycle, {
      name: CHANNEL_NAMES.cycle,
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    }).catch(() => {});
  }
}

/** Creates the channels now, so they exist before the first notice. */
export function prepareChannels() {
  ensureHandler();
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
  await Notifications.setNotificationChannelAsync(CHANNELS.lock, {
    name: CHANNEL_NAMES.lock,
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
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
  return key.startsWith(CYCLE_PREFIX) || key.startsWith(WATER_PREFIX) || key.startsWith("heads-up");
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
    sound: "default",
    lockscreenVisibility: opts.lockPublic ? Notifications.AndroidNotificationVisibility.PUBLIC : Notifications.AndroidNotificationVisibility.PRIVATE,
    ...(opts.color ? { lightColor: opts.color, enableLights: true } : {}),
  }).catch(() => {});
}

/** Replace rule reminders. Cycle alarms use their own ids and are left in place. */
export async function syncReminders(list: Reminder[], channelId: string = CHANNELS.reminders, keepKeys: string[] = []): Promise<string[]> {
  if (!notificationsSupported) return [];
  const p = await permissionState();
  if (!p.granted) return [];
  ensureHandler();
  if (channelId === CHANNELS.lock) await allowLockScreenChannel();
  // `keepKeys`: one-shot nudges already handed to the OS; cancelling them now would lose them.
  await cancelMatching((key) => !keptAlarm(key) && !keepKeys.includes(key));
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
  const channelId = CHANNELS.cycle;
  await ensureChannel(channelId, CHANNEL_NAMES.cycle, { color: pink ? CYCLE_NOTICE_PINK : undefined, lockPublic: options.lockPublic === true });
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
  const channelId = CHANNELS.water;
  await ensureChannel(channelId, CHANNEL_NAMES.water, { lockPublic: options.lockPublic === true });
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

/** Opens Android's settings page for one Nucleus channel (sound, vibration). Falls back to app settings. */
export async function openChannelSettings(key: ChannelKey, androidPackage: string) {
  if (Platform.OS !== "android") return Linking.openSettings();
  ensureHandler();
  try {
    await Linking.sendIntent("android.settings.CHANNEL_NOTIFICATION_SETTINGS", [
      { key: "android.provider.extra.APP_PACKAGE", value: androidPackage },
      { key: "android.provider.extra.CHANNEL_ID", value: CHANNELS[key] },
    ]);
  } catch {
    await Linking.openSettings().catch(() => {});
  }
}

/** Opens Android's notification settings for this app, where every channel and its sound are listed. */
export async function openNotificationSounds(androidPackage: string) {
  if (Platform.OS !== "android") return Linking.openSettings();
  ensureHandler();
  try {
    await Linking.sendIntent("android.settings.APP_NOTIFICATION_SETTINGS", [{ key: "android.provider.extra.APP_PACKAGE", value: androidPackage }]);
  } catch {
    await Linking.openSettings().catch(() => {});
  }
}

/** The channel a rule or bill reminder uses. Lock alerts use the public lock-screen channel. */
export function reminderChannel(lockAlerts: boolean): string {
  return lockAlerts ? CHANNELS.lock : CHANNELS.reminders;
}
