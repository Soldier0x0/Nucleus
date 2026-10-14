import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useStore } from "@/src/core/store";
import { dismissNoticeAction, noticeKindFromId, noticePresentation } from "@/src/core/notices";
import { nextHeadsUp, dismissHeadsUp, rememberHeadsUp } from "@/src/core/proactive";
import { todayISO } from "@/src/core/format";

/** One quiet heads-up. No second notice, no sound. */
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
      if (kind !== "heads-up") return;
      const id = String((data as { id?: unknown }).id ?? "");
      if (!id) return;
      if (action === "Yes" || action === "No") update((current) => rememberHeadsUp(current, id, action));
      else if (action === "dismiss") {
        const identifier = response.notification.request.identifier;
        Notifications.dismissNotificationAsync(identifier).catch(() => {});
        Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
        update((current) => dismissHeadsUp(current, id));
      }
    });
    return () => sub.remove();
  }, [update]);

  useEffect(() => {
    if (!ready || session !== "real") return;
    const current = dbRef.current;
    // v0.9.8: ADHD mode is gone. Clear a leftover ADHD notice once.
    Notifications.cancelScheduledNotificationAsync("adhd:next").catch(() => {});
    Notifications.dismissNotificationAsync("adhd:next").catch(() => {});

    const heads = nextHeadsUp(current, todayISO());
    if (!heads) {
      Notifications.dismissNotificationAsync("heads-up").catch(() => {});
      Notifications.cancelScheduledNotificationAsync("heads-up").catch(() => {});
      return;
    }
    const presentation = noticePresentation(noticeKindFromId(heads.id) ?? "service");
    const buttons = [
      ...heads.actions.map((action) => ({ identifier: action, buttonTitle: action, options: { opensAppToForeground: false } })),
      dismissNoticeAction(),
    ];
    Notifications.setNotificationCategoryAsync("heads-up", buttons).catch(() => {});
    Notifications.scheduleNotificationAsync({
      identifier: "heads-up",
      content: {
        title: "Next",
        body: heads.line,
        sound: false,
        sticky: presentation.sticky,
        autoDismiss: presentation.dismissClears,
        categoryIdentifier: "heads-up",
        data: { kind: "heads-up", key: "heads-up", id: heads.id },
      },
      trigger: null,
    }).catch(() => {});
  }, [ready, session, db.settings.headsUp, db.settings.cloud, db.txns, db.trips, db.fuel, db.services, db.vehicles]);

  return null;
}
