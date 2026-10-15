import { useEffect } from "react";
import { useStore } from "./store";
import { todayISO } from "./format";
import { cycleNotices } from "./cycle";
import { syncCycleNotices } from "./notify";

/** Hands buddy-line alarms to the OS. A decoy session cancels them. */
export function useCycleNotify() {
  const { db, ready, session } = useStore();
  const enabled = db.settings.modules.find((m) => m.id === "cycle")?.enabled !== false;
  const hide = db.settings.privacyMode;
  const lockPublic = db.settings.lockAlerts && !hide;
  const key = [
    session,
    enabled ? "1" : "0",
    db.cycle.buddyName,
    db.cycle.periodNudge ? "1" : "0",
    db.cycle.changeNudge ? "1" : "0",
    db.cycle.changeEndsAt ?? "",
    db.cycle.paused ? "1" : "0",
    db.cycle.pinkCalendar ? "1" : "0",
    hide ? "1" : "0",
    lockPublic ? "1" : "0",
    String(db.settings.quietHours.enabled),
    String(db.settings.quietHours.from),
    String(db.settings.quietHours.to),
    db.settings.homePreset,
    db.cycle.days.map((d) => `${d.date}:${d.bleeding ?? ""}:${d.ended ? "e" : ""}`).join("|"),
  ].join("~");

  useEffect(() => {
    if (!ready) return;
    const notices = session === "real" && enabled ? cycleNotices(db.cycle, db.settings.quietHours, todayISO()) : [];
    syncCycleNotices(
      notices.map((notice) => ({ id: notice.id, title: notice.title, at: new Date(notice.at) })),
      { pink: db.cycle.pinkCalendar, hide, lockPublic },
    ).catch(() => {});
  }, [ready, key, session, enabled, hide, lockPublic, db.cycle, db.settings.quietHours, db.settings.homePreset]);
}
