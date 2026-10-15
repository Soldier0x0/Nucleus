import React, { useEffect, useState } from "react";
import { AppState, Linking, Switch, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { bankAccessPrompt, bankInboxAfterReturn } from "@/src/core/bankAccess";
import { CHANNEL_NAMES, openChannelSettings, openNotificationSounds, permissionState, type PermissionState, requestPermission } from "@/src/core/notify";
import { enableFeature } from "@/src/native/enableFeature";
import { openNotificationListener, requestNotificationAccess } from "@/src/native/android";
import { allowLockScreenChannel } from "@/src/core/notify";
import { Icon, T } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { QuietHours } from "./QuietHours";
import { Row, Section, SettingsScreen, useSettingsAnchor, useSwitchColors } from "./parts";

/** Notifications: reminders, quiet hours, channels, bank texts, lock screen and the permission. */
export function NotificationsSettings() {
  const { db, setSettings } = useStore();
  const s = db.settings;
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const sw = useSwitchColors();
  const prompt = bankAccessPrompt();
  const [bankNote, setBankNote] = useState("");
  useEffect(() => {
    const apply = () => {
      if (!bankInboxAfterReturn({ asked: s.bankTextsAsked, accessOn: requestNotificationAccess(), inboxOn: s.smsInbox })) return;
      if (!s.smsInbox) setSettings({ smsInbox: true });
    };
    apply();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") apply();
    });
    return () => sub.remove();
  }, [s.bankTextsAsked, s.smsInbox, setSettings]);
  const [perm, setPerm] = useState<PermissionState | null>(null);
  useEffect(() => {
    let alive = true;
    permissionState().then((p) => {
      if (alive) setPerm(p);
    });
    return () => {
      alive = false;
    };
  }, []);
  const anchor = useSettingsAnchor();
  return (
    <SettingsScreen title="Notifications" testID="settings-notifications" anchor={anchor}>
      <Section title="Notifications" testID="settings-notifications-section" anchor="channels">
        <T muted style={{ paddingHorizontal: 16, paddingTop: 12 }}>Each kind of notice has its own Android channel, so you can give each its own sound.</T>
        {(["reminders", "water", "smsAsk", "cycle"] as const).map((key, i) => (
          <Row key={key} first={i === 0} icon="music-note-outline" label={`${CHANNEL_NAMES[key]} sound`} sub="Opens Android's settings for this channel" testID={`settings-channel-${key}`} onPress={() => openChannelSettings(key, Constants.expoConfig?.android?.package ?? "com.nucleus.app")} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        ))}
        <Row icon="tune-variant" label="Notification sounds" sub="Opens Android's settings where every Nucleus channel and its sound are listed" testID="settings-notification-sounds" onPress={() => openNotificationSounds(Constants.expoConfig?.android?.package ?? "com.nucleus.app")} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
      </Section>

      <Section title="Reminders" anchor="reminders">
        <Row first icon="bell-ring-outline" label="Reminders" sub="Alarms from your rules and dated records, scheduled on this phone" testID="settings-reminders" onPress={() => router.push("/reminders")} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
          <QuietHours idPrefix="settings" />
        </View>
      </Section>

      <Section title="Bank texts" anchor="bank-texts">
        <Row first icon="message-text-outline" label="Bank texts" sub="Debit, credit, and balance lines come from bank notifications on this phone. Codes are dropped. Opens notification access." right={<Switch testID="settings-sms" value={s.smsInbox} onValueChange={(v) => {
          if (!v) {
            setBankNote("");
            return setSettings({ smsInbox: false, bankTextsAsked: false, bankTextsOff: true });
          }
          const accessOn = requestNotificationAccess();
          setSettings({ bankTextsAsked: true, bankTextsOff: false, ...(accessOn ? { smsInbox: true } : {}) });
          if (accessOn) {
            setBankNote(prompt.line);
            return;
          }
          const opened = openNotificationListener();
          setBankNote(opened === "blocked" ? `${prompt.line} ${prompt.blockedLine}` : prompt.line);
        }} {...sw} />} />
        <T testID="settings-sms-note" style={{ paddingHorizontal: 16, paddingBottom: 12 }}>{bankNote || prompt.line}</T>
      </Section>

      <Section title="Lock screen" anchor="lock-screen">
        <Row first icon="bell-outline" label="Lock-screen alerts" sub="Reminders use the same permission and can show on the lock screen" right={<Switch testID="settings-lock-alerts" value={s.lockAlerts} onValueChange={async (v) => {
          if (!v) return setSettings({ lockAlerts: false });
          if (!(await enableFeature("lock-alerts"))) return toast("Allow notifications to show alerts on the lock screen", "alert-circle-outline");
          await allowLockScreenChannel();
          setSettings({ lockAlerts: true });
        }} {...sw} />} />
        <Row
          icon="bell-badge-outline"
          label="Notification permission"
          sub={perm ? (perm.granted ? "Allowed · reminders and bank questions can show" : perm.canAskAgain || perm.undetermined ? "Not allowed yet · tap to allow" : "Blocked · open Android settings to allow") : "Checking…"}
          testID="settings-post-notifications"
          onPress={async () => {
            if (perm?.granted) return;
            if (!perm || perm.canAskAgain || perm.undetermined) {
              const next = await requestPermission();
              setPerm(next);
              if (!next.granted) toast("Notifications stay off. Android may ask again later.", "bell-off-outline");
              return;
            }
            Linking.openSettings().catch(() => {});
          }}
          right={<Icon name={perm?.granted ? "check-circle-outline" : "chevron-right"} size={18} color={perm?.granted ? colors.success : colors.muted} />}
        />
        <T muted testID="settings-lockscreen-note" style={{ paddingHorizontal: 16, paddingBottom: 12 }}>Bank texts and reminder titles can show on the lock screen. To hide them, turn off Lock-screen alerts above, or set Android&apos;s lock-screen notifications to hide sensitive content.</T>
      </Section>
    </SettingsScreen>
  );
}
