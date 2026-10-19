import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

/**
 * Tapping a notification body opens the screen the notice came from.
 * Action buttons keep their own listeners (QuietSync, BankTextSync); this
 * covers the plain tap, whose action identifier on Android is "default".
 */
export function NotificationTaps() {
  const response = Notifications.useLastNotificationResponse();
  const router = useRouter();

  useEffect(() => {
    if (!response || response.actionIdentifier !== "default") return;
    const data = response.notification.request.content.data;
    if (!data || typeof data !== "object") return;
    const key = typeof (data as { key?: unknown }).key === "string" ? (data as { key: string }).key : "";
    if (key.startsWith("rule:") || key.startsWith("heads-up")) {
      router.replace("/reminders");
    } else if (key.startsWith("water:")) {
      router.replace("/health");
    } else if (key.startsWith("cycle:")) {
      router.replace("/cycle");
    } else if ((data as { kind?: unknown }).kind === "sms-ask") {
      router.replace("/money");
    }
  }, [response, router]);

  return null;
}
