import { useEffect } from "react";
import { useStore } from "./store";
import { markFired, reminders } from "./rules";
import { billReminders } from "./moneyDesk";
import { allowLockScreenChannel, syncReminders } from "./notify";
import { moduleAlerts } from "./presets";

let syncedThisSession = false;

/**
 * Hands the current rule reminders to the OS once per app session.
 * No background work: if the app is never opened, nothing new gets scheduled.
 */
export function useReminderSync() {
  const { db, ready, update } = useStore();
  useEffect(() => {
    if (!ready) return;
    if (db.settings.homePreset === "adhd") {
      syncedThisSession = false;
      syncReminders([]).catch(() => {});
      return;
    }
    if (syncedThisSession) return;
    syncedThisSession = true;
    (async () => {
      const list = moduleAlerts(db, [...(db.settings.remindersEnabled ? reminders(db) : []), ...billReminders(db.txns, db.settings.quietHours)]);
      if (db.settings.lockAlerts) await allowLockScreenChannel();
      const keys = await syncReminders(list, db.settings.lockAlerts ? "nucleus-lock" : "nucleus-reminders");
      const once = list.filter((r) => r.once && keys.includes(r.key)).map((r) => r.key);
      if (once.length) update((d) => markFired(d, once));
    })();
  }, [ready, db, update]);
}
