import { Redirect } from "expo-router";
import { useStore } from "@/src/core/store";

export default function Index() {
  const { db } = useStore();
  return <Redirect href={db.settings.onboarded ? "/(tabs)" : "/onboarding"} />;
}
