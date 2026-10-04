import { PermissionsAndroid, Platform } from "react-native";
import { askToEnable, staysEnabled, type GatedFeature } from "@/src/core/featureAccess";
import { requestPermission } from "@/src/core/notify";
import { requestNotificationAccess } from "@/src/native/android";

/** Turning a feature on asks for the permission that feature needs. Denied stays off. */
export async function enableFeature(feature: GatedFeature): Promise<boolean> {
  const ask = askToEnable(feature);
  if (!ask.permission) return staysEnabled(ask, true);
  if (ask.permission === "android.permission.POST_NOTIFICATIONS") {
    const perm = await requestPermission();
    return staysEnabled(ask, perm.granted);
  }
  if (ask.permission === "notification-listener") return staysEnabled(ask, requestNotificationAccess());
  if (Platform.OS !== "android") return staysEnabled(ask, false);
  const result = await PermissionsAndroid.request(ask.permission as (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS]);
  return staysEnabled(ask, result === PermissionsAndroid.RESULTS.GRANTED);
}
