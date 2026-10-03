import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useStore } from "@/src/core/store";
import { adhdReminder, snoozeAdhdReminder } from "@/src/core/presets";
import { nextHeadsUp, dismissHeadsUp, rememberHeadsUp } from "@/src/core/proactive";
import { addDays, todayISO } from "@/src/core/format";

/** One ADHD reminder line, and one quiet heads-up. No second notice, no sound. */
export function QuietSync() {
  const { db, ready, session, update } = useStore();
  const dbRef = useRef(db);
  dbRef.current = db;

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!data || typeof data !== "object") return;
      const kind = (data as { kind?: unknown }).kind;
      const action = response.actionIdentifier;
      if (kind === "adhd" && action === "snooze") {
        update((current) => snoozeAdhdReminder(current, addDays(todayISO(), 1)));
        return;
      }
      if (kind !== "heads-up") return;
      const id = String((data as { id?: unknown }).id ?? "");
      if (!id) return;
      if (action === "Yes" || action === "No") update((current) => rememberHeadsUp(current, id, action));
      else if (action === "dismiss" || action === Notifications.DEFAULT_ACTION_IDENTIFIER) update((current) => dismissHeadsUp(current, id));
    });
    return () => sub.remove();
  }, [update]);

  useEffect(() => {
    if (!ready || session !== "real") return;
    const current = dbRef.current;
    const line = current.settings.adhd.reminder.line;
    const until = current.settings.adhd.reminder.snoozedUntil;
    const showReminder = current.settings.homePreset === "adhd" && !!line && !(until && until > todayISO());
    if (!showReminder) {
      Notifications.cancelScheduledNotificationAsync("adhd:next").catch(() => {});
    } else {
      const reminder = adhdReminder(line);
      Notifications.setNotificationCategoryAsync("adhd-remind", [{ identifier: "snooze", buttonTitle: "Snooze" }]).catch(() => {});
      Notifications.scheduleNotificationAsync({
        identifier: "adhd:next",
        content: {
          title: "Next",
          body: reminder.body,
          sound: false,
          categoryIdentifier: "adhd-remind",
          data: { kind: "adhd", key: "adhd:next", line: reminder.line },
        },
        trigger: null,
      }).catch(() => {});
    }

    const heads = nextHeadsUp(current, todayISO());
    if (!heads) {
      Notifications.cancelScheduledNotificationAsync("heads-up").catch(() => {});
      return;
    }
    const buttons = [
      ...heads.actions.map((action) => ({ identifier: action, buttonTitle: action })),
      { identifier: "dismiss", buttonTitle: "Dismiss" },
    ];
    Notifications.setNotificationCategoryAsync("heads-up", buttons).catch(() => {});
    Notifications.scheduleNotificationAsync({
      identifier: "heads-up",
      content: {
        title: "Next",
        body: heads.line,
        sound: false,
        categoryIdentifier: "heads-up",
        data: { kind: "heads-up", key: "heads-up", id: heads.id },
      },
      trigger: null,
    }).catch(() => {});
  }, [ready, session, db.settings.homePreset, db.settings.adhd.reminder.line, db.settings.adhd.reminder.snoozedUntil, db.settings.headsUp, db.settings.cloud, db.txns, db.trips, db.fuel, db.services, db.vehicles]);

  return null;
}
