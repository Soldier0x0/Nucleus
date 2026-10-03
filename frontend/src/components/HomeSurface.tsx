import { useEffect } from "react";
import { useStore } from "@/src/core/store";
import { widgetSnapshot } from "@/src/core/widgets";
import { publishShortcuts, publishWidgets } from "@/src/native/android";

/** Keeps the Android home screen in step with the open document. */
export function HomeSurface() {
  const { db, ready, unreadable } = useStore();
  useEffect(() => {
    if (!ready || unreadable) return;
    const updated = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    publishWidgets(widgetSnapshot(db, undefined, updated));
    publishShortcuts(db.settings.shortcuts ?? []);
  }, [db, ready, unreadable]);
  return null;
}
