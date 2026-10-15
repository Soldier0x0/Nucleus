import { useEffect, useRef } from "react";
import { useStore } from "./store";
import { markFired, reminders } from "./rules";
import { billReminders } from "./moneyDesk";
import { allowLockScreenChannel, notificationsSupported, permissionState, reminderChannel, syncReminders } from "./notify";
import { moduleAlerts } from "./presets";
import { plainReminders } from "./reminders";
import { medicineNotices } from "./medicines";
import { REMINDER_SYNC_DEBOUNCE_MS, reminderInputs, shouldWarnDenied } from "./reminderSync";

/**
 * Hands rule, bill, plain and medicine reminders to the OS whenever their data changes
 * (v0.9.8: no longer once per session). Debounced so a burst of saves schedules once.
 * No background work: if the app is never opened, nothing new gets scheduled.
 */
export function useReminderSync(onDenied?: () => void) {
  const { db, ready, update } = useStore();
  const dbRef = useRef(db);
  dbRef.current = db;
  const inputs = ready ? reminderInputs(db) : "";
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(async () => {
      const current = dbRef.current;
      const list = moduleAlerts(current, [
        ...(current.settings.remindersEnabled ? reminders(current) : []),
        ...billReminders(current.txns, current.settings.quietHours),
        ...plainReminders(current),
        ...medicineNotices(current),
      ]);
      if (notificationsSupported && list.length) {
        const p = await permissionState().catch(() => null);
        if (p && shouldWarnDenied({ pending: list.length, granted: p.granted, canAskAgain: p.canAskAgain, warned: current.settings.postNotificationsWarned })) {
          update((d) => ({ ...d, settings: { ...d.settings, postNotificationsWarned: true } }));
          onDenied?.();
        }
      }
      if (current.settings.lockAlerts) await allowLockScreenChannel();
      // One-shot nudges fired in the last 2 minutes are already with the OS; leave them alone.
      const recent = Object.entries(current.ruleFires).filter(([, at]) => Date.now() - Date.parse(at) < 120_000).map(([key]) => key);
      const keys = await syncReminders(list, reminderChannel(current.settings.lockAlerts), recent);
      const once = list.filter((r) => r.once && keys.includes(r.key)).map((r) => r.key);
      const fresh = once.filter((key) => !current.ruleFires[key]);
      if (fresh.length) update((d) => markFired(d, fresh));
    }, REMINDER_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, inputs, update]);
}
