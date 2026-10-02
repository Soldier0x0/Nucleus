import { useEffect } from "react";
import { useStore } from "./store";
import { markFired, reminders } from "./rules";
import { syncReminders } from "./notify";

let syncedThisSession = false;

/**
 * Hands the current rule reminders to the OS once per app session.
 * No background work: if the app is never opened, nothing new gets scheduled.
 */
export function useReminderSync() {
  const { db, ready, update } = useStore();
  useEffect(() => {
    if (!ready || syncedThisSession || !db.settings.remindersEnabled) return;
    syncedThisSession = true;
    (async () => {
      const list = reminders(db);
      const keys = await syncReminders(list);
      const once = list.filter((r) => r.once && keys.includes(r.key)).map((r) => r.key);
      if (once.length) update((d) => markFired(d, once));
    })();
  }, [ready, db, update]);
}
