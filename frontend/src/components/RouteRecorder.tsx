import { useEffect, useRef } from "react";
import { usePathname } from "expo-router";
import { useStore } from "@/src/core/store";
import { useLockSignal } from "@/src/core/lockSignal";
import { isContentRoute, recordRoute } from "@/src/core/reopen";

/**
 * Remembers the last content route, so the next cold start inside the reopen
 * window can land there again. Skips while locked, onboarding, and one-shot
 * pickers, and only writes when the route changes.
 */
export function RouteRecorder() {
  const { db, ready, setSettings } = useStore();
  const gate = useLockSignal();
  const path = usePathname();
  const recorded = useRef<string | null>(null);
  const onboarded = db.settings.onboarded;

  useEffect(() => {
    if (!ready || !onboarded) {
      recorded.current = null;
      return;
    }
    if (gate !== "unlocked" || !isContentRoute(path)) return;
    if (recorded.current === path) return;
    recorded.current = path;
    const patch = recordRoute(db.settings, path, new Date().toISOString());
    if (patch) setSettings(patch);
  }, [ready, onboarded, gate, path, db.settings, setSettings]);

  return null;
}
