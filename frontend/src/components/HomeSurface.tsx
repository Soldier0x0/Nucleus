import { useEffect } from "react";
import { useStore } from "@/src/core/store";
import { widgetSnapshot } from "@/src/core/widgets";
import { cycleHomeWidget } from "@/src/core/cycleWidget";
import { forecast } from "@/src/core/cycle";
import { todayISO } from "@/src/core/format";
import { publishCycleWidget, publishShortcuts, publishWidgets } from "@/src/native/android";

/** Keeps the Android home screen in step with the open document. */
export function HomeSurface() {
  const { db, ready, unreadable, session } = useStore();
  useEffect(() => {
    if (!ready || unreadable) return;
    const updated = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    publishWidgets(widgetSnapshot(db, undefined, updated));
    publishShortcuts(db.settings.shortcuts ?? []);
    const cycleOn = session === "real" && db.settings.modules.some((mod) => mod.id === "cycle" && mod.enabled);
    const next = cycleOn ? forecast(db.cycle, todayISO()) : null;
    publishCycleWidget(cycleHomeWidget(next ? { line: next.line, paused: next.paused } : null));
  }, [db, ready, unreadable, session]);
  return null;
}
