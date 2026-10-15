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

function landingRoute(settings: Parameters<typeof reopenTarget>[0]): string {
  const target = reopenTarget(settings, Date.now());
  if (target) return target;
  return usesNativeTabs ? HOME_ROUTE : FAVORITES_ROUTE;
}

/**
 * Cold-start fork: onboarding, then wait for the lock gate, then the last
 * screen inside the reopen window or the Favourites landing.
 */
export default function Index() {
  const { db } = useStore();
  const gate = useLockSignal();
  const [target, setTarget] = useState<string | null>(null);
  const decided = useRef(false);
  const onboarded = db.settings.onboarded;

  useEffect(() => {
    if (!onboarded || decided.current) return;
    if (gate === "unknown" || gate === "locked") return;
    decided.current = true;
    booted = true;
    setTarget(landingRoute(db.settings));
  }, [onboarded, gate, db.settings]);

  if (!onboarded) return <Redirect href="/onboarding" />;
  if (target) return <Redirect href={target as never} />;
  if (booted) return <Redirect href={HOME_ROUTE} />;
  return null;
}
