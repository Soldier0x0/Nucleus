import React, { useEffect, useRef, useState } from "react";
import { Redirect } from "expo-router";
import { useStore } from "@/src/core/store";
import { useLockSignal } from "@/src/core/lockSignal";
import { reopenTarget } from "@/src/core/reopen";
import { usesNativeTabs } from "@/src/navigation";

export const FAVORITES_ROUTE = "/(tabs)/favorites";
const HOME_ROUTE = "/(tabs)";

/** One cold-start decision per app run. Later visits to "/" go straight home. */
let booted = false;
/** The remembered screen a cold start restores; the tabs layout pushes it once. */
let pendingReopen: string | null = null;

/** Hands the remembered screen to the tabs layout exactly once per app run. */
export function takePendingReopen(): string | null {
  const route = pendingReopen;
  pendingReopen = null;
  return route;
}

/**
 * Cold-start fork: onboarding, then wait for the lock gate, then the Favourites
 * landing. The last screen inside the reopen window rides on top of the tabs
 * (pushed by the tabs layout), so its back button always has a way home.
 */
export default function Index() {
  const { db } = useStore();
  const gate = useLockSignal();
  const [target, setTarget] = useState<string | null>(null);
  const decided = useRef(false);
  const onboarded = db.settings.onboarded;

  useEffect(() => {
    if (!onboarded || decided.current) return;
    if (booted) {
      decided.current = true;
      return;
    }
    if (gate === "unknown" || gate === "locked") return;
    decided.current = true;
    booted = true;
    pendingReopen = reopenTarget(db.settings, Date.now());
    setTarget(usesNativeTabs ? HOME_ROUTE : FAVORITES_ROUTE);
  }, [onboarded, gate, db.settings]);

  if (!onboarded) return <Redirect href="/onboarding" />;
  if (target) return <Redirect href={target as never} />;
  if (booted) return <Redirect href={HOME_ROUTE} />;
  return null;
}
