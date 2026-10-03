/** A feature that needs a permission stays off until that permission is granted. */
export type GatedFeature = "lock-alerts" | "emergency-card" | "sms-inbox" | "reminders" | "cloud-file" | "look";

export type FeatureAsk = { permission: string | null; lockScreen: boolean };

export function askToEnable(feature: GatedFeature): FeatureAsk {
  switch (feature) {
    case "lock-alerts":
    case "emergency-card":
      return { permission: "android.permission.POST_NOTIFICATIONS", lockScreen: true };
    case "reminders":
      return { permission: "android.permission.POST_NOTIFICATIONS", lockScreen: false };
    case "sms-inbox":
      return { permission: "android.permission.READ_SMS", lockScreen: false };
    case "cloud-file":
    case "look":
      return { permission: null, lockScreen: false };
    default: {
      const unreachable: never = feature;
      return unreachable;
    }
  }
}

export function staysEnabled(ask: FeatureAsk, granted: boolean): boolean {
  if (ask.permission == null) return true;
  return granted;
}

/** Lock-screen cards use a public notification, so the shade and the lock screen can show them. */
export function lockScreenVisibility(): "public" {
  return "public";
}
