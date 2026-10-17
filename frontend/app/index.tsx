import React from "react";
import { Redirect } from "expo-router";
import { useStore } from "@/src/core/store";
import { useLockSignal } from "@/src/core/lockSignal";

/** Cold start lands on the Favourites tab (v0.12: four real tabs, no hidden ones). */
export const FAVORITES_ROUTE = "/(tabs)/favorites";

export default function Index() {
  const { db } = useStore();
  const gate = useLockSignal();

  if (!db.settings.onboarded) return <Redirect href="/onboarding" />;
  if (gate === "unlocked") return <Redirect href={FAVORITES_ROUTE as never} />;
  return null;
}
