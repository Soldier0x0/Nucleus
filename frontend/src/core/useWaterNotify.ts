import { useEffect } from "react";
import { useStore } from "./store";
import { shiftWaterClock } from "./water";
import { syncWaterNotices } from "./notify";

/** Daily reminders at the times the person set. A decoy session clears them. */
export function useWaterNotify() {
  const { db, ready, session } = useStore();
  const enabled = db.settings.modules.find((m) => m.id === "health")?.enabled !== false;
  const hide = db.settings.privacyMode;
  const lockPublic = db.settings.lockAlerts && !hide;
  const key = [
    session,
    enabled ? "1" : "0",
    hide ? "1" : "0",
    lockPublic ? "1" : "0",
    String(db.settings.quietHours.enabled),
    String(db.settings.quietHours.from),
    String(db.settings.quietHours.to),
    db.water.times.map((time) => `${time.id}:${time.hour}:${time.minute}`).join("|"),
  ].join("~");

  useEffect(() => {
    if (!ready) return;
    const notices =
      session === "real" && enabled
        ? db.water.times.map((time) => {
            const at = shiftWaterClock(time.hour, time.minute, db.settings.quietHours);
            return { id: `water:${time.id}`, hour: at.hour, minute: at.minute };
          })
        : [];
    syncWaterNotices(notices, { hide, lockPublic }).catch(() => {});
  }, [ready, key, session, enabled, hide, lockPublic, db.water, db.settings.quietHours]);
}
