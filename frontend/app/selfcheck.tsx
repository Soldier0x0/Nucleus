import React, { useCallback, useEffect, useState } from "react";
import { Linking, Platform, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import * as Device from "expo-device";
import { File, Paths } from "expo-file-system";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { biometricAvailable, hasPin } from "@/src/core/security";
import { notificationsSupported, permissionState, requestPermission, scheduledCount } from "@/src/core/notify";
import { androidReady, installedVersion, openNotificationListener, requestNotificationAccess } from "@/src/native/android";
import { buildReport, DATA_FIXES, reportText, runSelfCheck, type CheckResult, type FixId, type Progress } from "@/src/core/selfCheck";
import { Header } from "@/src/components/Header";
import { Button, Icon, T } from "@/src/components/ui";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { useToast } from "@/src/components/Toast";

const ICON: Record<CheckResult["status"], string> = { pass: "check-circle-outline", warn: "alert-outline", fail: "close-circle-outline", skip: "minus-circle-outline" };

export default function SelfCheck() {
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { db, ready, unreadable, setSettings } = useStore();
  const [results, setResults] = useState<CheckResult[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [confirmFix, setConfirmFix] = useState<FixId | null>(null);
  const platform = `${Platform.OS} ${Device.osVersion ?? ""}`.trim();
  const tone = { pass: colors.success, warn: colors.warning, fail: colors.error, skip: colors.muted };

  const run = useCallback(async () => {
    setRunning(true);
    setResults([]);
    const native = Platform.OS === "android" && androidReady();
    const [pinSet, bio, perm, scheduled] = await Promise.all([
      hasPin().catch(() => false),
      biometricAvailable().catch(() => false),
      notificationsSupported ? permissionState().catch(() => null) : Promise.resolve(null),
      notificationsSupported ? scheduledCount().catch(() => null) : Promise.resolve(null),
    ]);
    const probes = {
      platform,
      dbReadable: ready && !unreadable,
      db,
      pinSet,
      biometricAvailable: bio,
      notifyGranted: perm ? perm.granted : null,
      notificationAccess: native ? requestNotificationAccess() : null,
      scheduledReminders: typeof scheduled === "number" ? scheduled : null,
      version: installedVersion(),
      docBytes: JSON.stringify(db).length,
      now: new Date().toISOString(),
    };
    await runSelfCheck(probes, (p, latest) => {
      setProgress(p);
      setResults((r) => [...r, latest]);
    });
    setRunning(false);
  }, [db, platform, ready, unreadable]);

  useEffect(() => {
    // Run once when the screen opens; Run again repeats it.
    const id = setTimeout(run, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFix = async (fix: FixId) => {
    if (DATA_FIXES.includes(fix) && confirmFix !== fix) return setConfirmFix(fix);
    setConfirmFix(null);
    if (fix === "bank-switch-on") {
      setSettings({ smsInbox: true });
      toast("Bank texts turned on", "bank-outline");
    } else if (fix === "notify-permission") {
      const p = await requestPermission();
      if (!p.granted && !p.canAskAgain) Linking.openSettings();
    } else if (fix === "notification-access") {
      if (openNotificationListener() === "blocked") Linking.openSettings();
    } else if (fix === "open-settings") router.push("/settings");
    else if (fix === "open-vehicles") router.push("/vehicles");
    else Linking.openSettings();
  };

  const download = async (kind: "json" | "txt") => {
    const report = buildReport(results, { at: new Date().toISOString(), version: installedVersion(), platform });
    const text = kind === "json" ? JSON.stringify(report, null, 2) : reportText(report);
    if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
      await Clipboard.setStringAsync(text);
      return toast("Report copied", "content-copy");
    }
    const file = new File(Paths.cache, `nucleus-self-check.${kind}`);
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    await Sharing.shareAsync(file.uri, { mimeType: kind === "json" ? "application/json" : "text/plain", dialogTitle: "Self-check report" });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="self-check-screen">
      <Header title="Self-check" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <T v="h2" testID="self-check-progress">
          {progress ? `${progress.done} of ${progress.total} checked · ${progress.passed} passed · ${progress.failed} failed` : "Starting…"}
        </T>
        <T muted>The report holds statuses and counts only. No names, amounts, notes, file names or message text.</T>
        {results.map((r) => (
          <View key={r.id} testID={`self-check-${r.id}`} style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}>
            <Icon name={ICON[r.status]} size={22} color={tone[r.status]} />
            <View style={{ flex: 1 }}>
              <T v="label">{r.label}</T>
              <T muted style={{ marginTop: 2 }}>{r.detail}</T>
            </View>
            {r.fix && r.status !== "pass" ? <Button small kind="secondary" label={r.fixLabel ?? "Fix"} testID={`self-check-fix-${r.id}`} onPress={() => applyFix(r.fix!)} /> : null}
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Button style={{ flex: 1 }} kind="secondary" icon="code-json" label="Report (JSON)" disabled={running || !results.length} testID="self-check-download-json" onPress={() => download("json")} />
          <Button style={{ flex: 1 }} kind="secondary" icon="text-box-outline" label="Report (text)" disabled={running || !results.length} testID="self-check-download-text" onPress={() => download("txt")} />
        </View>
        <Button icon="refresh" label={running ? "Checking…" : "Run again"} disabled={running} testID="self-check-run" onPress={run} />
      </ScrollView>
      <ConfirmSheet
        visible={confirmFix === "bank-switch-on"}
        id="self-check-fix"
        title="Turn bank texts on?"
        body="Nucleus will save bank and UPI notices it reads from your notifications. Nothing leaves this phone."
        confirmLabel="Turn on"
        icon="bank-outline"
        danger={false}
        onCancel={() => setConfirmFix(null)}
        onConfirm={() => applyFix("bank-switch-on")}
      />
    </View>
  );
}
