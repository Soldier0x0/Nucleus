import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { accents, radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { usesNativeTabs } from "@/src/navigation";
import { CURRENCIES } from "@/src/core/format";
import { emptyDB } from "@/src/core/defaults";
import { withSampleData } from "@/src/core/sample";
import { BackupFile, exportBackup, pickBackup } from "@/src/core/backup";
import { biometricAvailable, clearPin, setPin } from "@/src/core/security";
import { Button, Chip, ChipRow, Eyebrow, Icon, Press, Segmented, T } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { PinPad } from "@/src/components/PinPad";
import { useToast } from "@/src/components/Toast";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Eyebrow style={{ marginBottom: 8 }}>{title}</Eyebrow>
      <View style={[styles.group, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function Row({ icon, label, sub, right, first, testID, onPress }: { icon: string; label: string; sub?: string; right?: React.ReactNode; first?: boolean; testID?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const inner = (
    <>
      <Icon name={icon} size={20} color={colors.muted} />
      <View style={{ flex: 1 }}>
        <T v="label">{label}</T>
        {sub ? <T muted style={{ fontSize: 12 }}>{sub}</T> : null}
      </View>
      {right}
    </>
  );
  const st = [styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.divider }];
  return onPress ? (
    <Press testID={testID} onPress={onPress} style={st}>
      {inner}
    </Press>
  ) : (
    <View testID={testID} style={st}>
      {inner}
    </View>
  );
}

export default function Settings() {
  const { db, setSettings, replace, update } = useStore();
  const s = db.settings;
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const sw = { trackColor: { true: colors.brandPrimary, false: colors.surfaceTertiary }, thumbColor: colors.surfaceSecondary };
  const [pinFlow, setPinFlow] = useState<null | "enter" | "confirm">(null);
  const [first, setFirst] = useState("");
  const [pinErr, setPinErr] = useState<string>();
  const [pinKey, setPinKey] = useState(0);
  const [restore, setRestore] = useState<BackupFile | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [exportWarn, setExportWarn] = useState(false);
  const sizeKb = (JSON.stringify(db).length / 1024).toFixed(1);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: sp.lg, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Eyebrow>Everything stays on this device</Eyebrow>
        <T v="title" testID="settings-title">Settings</T>
      </View>
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: bottomChrome + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <Section title="Appearance">
          <View style={{ padding: 12, gap: 12 }}>
            <Segmented testID="settings-theme" value={s.theme} onChange={(v) => setSettings({ theme: v })} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
            <Segmented testID="settings-density" value={s.density} onChange={(v) => setSettings({ density: v })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "dense", label: "Dense" }]} />
          </View>
          <View style={{ marginHorizontal: -4, paddingBottom: 4 }}>
            <ChipRow testID="settings-accent-row">
              {Object.entries(accents).map(([k, a]) => (
                <Press key={k} testID={`settings-accent-${k}`} onPress={() => setSettings({ accent: k })} accessibilityLabel={`${a.name} accent`} accessibilityState={{ selected: s.accent === k }} style={[styles.swatchWrap, { borderColor: s.accent === k ? colors.onSurface : colors.border }]}>
                  <View style={[styles.swatch, { backgroundColor: a.base }]}>{s.accent === k ? <Icon name="check" size={14} color="#FFFFFF" /> : null}</View>
                  <T v="caption">{a.name}</T>
                </Press>
              ))}
            </ChipRow>
          </View>
        </Section>

        <Section title="Defaults">
          <View style={{ paddingVertical: 4 }}>
            <ChipRow testID="settings-currency-row">
              {CURRENCIES.map((c) => (
                <Chip key={c} label={c} selected={s.currency === c} onPress={() => setSettings({ currency: c })} testID={`settings-currency-${c}`} />
              ))}
            </ChipRow>
          </View>
          <View style={{ padding: 12, paddingTop: 4, gap: 10 }}>
            <Segmented testID="settings-distance" value={s.distanceUnit} onChange={(v) => setSettings({ distanceUnit: v })} options={[{ value: "km", label: "km" }, { value: "mi", label: "miles" }]} />
            <Segmented testID="settings-volume" value={s.volumeUnit} onChange={(v) => setSettings({ volumeUnit: v })} options={[{ value: "L", label: "Litres" }, { value: "gal", label: "Gallons" }]} />
            <Segmented testID="settings-temp" value={s.tempUnit} onChange={(v) => setSettings({ tempUnit: v })} options={[{ value: "C", label: "°C" }, { value: "F", label: "°F" }]} />
            <Segmented testID="settings-time" value={s.timeFormat} onChange={(v) => setSettings({ timeFormat: v })} options={[{ value: "12h", label: "12-hour" }, { value: "24h", label: "24-hour" }]} />
          </View>
          <Row icon="link-variant" label="Auto-link vehicle costs to Money" sub="Fuel & service costs create linked expenses" right={<Switch testID="settings-autolink-switch" value={s.autoLinkExpenses} onValueChange={(v) => setSettings({ autoLinkExpenses: v })} {...sw} />} />
        </Section>

        <Section title="Security & privacy">
          <Row
            first
            icon="lock-outline"
            label="App lock (PIN)"
            sub={s.lockEnabled ? "On · locks on launch and after background timeout" : "Off"}
            right={
              <Switch
                testID="settings-lock-switch"
                value={s.lockEnabled}
                onValueChange={async (v) => {
                  if (v) {
                    setPinErr(undefined);
                    setPinFlow("enter");
                  } else {
                    await clearPin();
                    setSettings({ lockEnabled: false, biometricEnabled: false });
                    toast("App lock turned off", "lock-open-outline");
                  }
                }}
                {...sw}
              />
            }
          />
          {s.lockEnabled ? (
            <>
              <Row
                icon="fingerprint"
                label="Biometric unlock"
                sub={Platform.OS === "web" ? "Available in the installed app" : "Fingerprint or face, PIN as fallback"}
                right={
                  <Switch
                    testID="settings-biometric-switch"
                    value={s.biometricEnabled}
                    onValueChange={async (v) => {
                      if (v && !(await biometricAvailable())) return toast("No enrolled biometrics on this device", "alert-circle-outline");
                      setSettings({ biometricEnabled: v });
                    }}
                    {...sw}
                  />
                }
              />
              <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
                <T v="label" style={{ marginBottom: 8 }}>Re-lock after background</T>
                <Segmented testID="settings-lock-timeout" value={String(s.lockTimeoutSec)} onChange={(v) => setSettings({ lockTimeoutSec: Number(v) })} options={[{ value: "0", label: "Instantly" }, { value: "30", label: "30 s" }, { value: "300", label: "5 min" }]} />
              </View>
            </>
          ) : null}
          <Row icon="eye-off-outline" label="Privacy mode" sub="Mask every amount until tapped" right={<Switch testID="settings-privacy-switch" value={s.privacyMode} onValueChange={(v) => setSettings({ privacyMode: v })} {...sw} />} />
          <Row icon="cellphone-screenshot" label="Block screenshots & hide in recents" sub="Installed app only" right={<Switch testID="settings-screenshot-switch" value={s.blockScreenshots} onValueChange={(v) => setSettings({ blockScreenshots: v })} {...sw} />} />
        </Section>

        <Section title="Your data">
          <Row first icon="database-outline" label="Local data" sub={`${db.vehicles.length} vehicles · ${db.fuel.length} fuel · ${db.txns.length} transactions · ${sizeKb} KB`} testID="settings-data-summary" />
          <Row icon="export-variant" label="Export everything" sub="One backup file you save or share yourself" testID="settings-export-button" onPress={() => setExportWarn(true)} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
          <Row
            icon="backup-restore"
            label="Restore from backup"
            sub="Preview before anything is replaced"
            testID="settings-restore-button"
            right={<Icon name="chevron-right" size={18} color={colors.muted} />}
            onPress={async () => {
              try {
                const b = await pickBackup();
                if (b) setRestore(b);
              } catch (e: any) {
                toast(e?.message ?? "Couldn't read that file", "alert-circle-outline");
              }
            }}
          />
          <Row icon="flask-outline" label="Add sample data" sub="Explore insights with a demo workspace" testID="settings-sample-button" onPress={() => (update(withSampleData), toast("Sample data added", "flask-outline"))} right={<Icon name="plus" size={18} color={colors.muted} />} />
          <Row icon="delete-outline" label="Erase all data" sub="Cannot be undone" testID="settings-reset-button" onPress={() => setConfirmReset(true)} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        </Section>

        <Section title="About">
          <Row first icon="view-grid-outline" label="Tessera 1.0 · MVP" sub="Local-first. No account, no cloud, no AI. Insights are rules + your history." />
          <Row icon="wifi-off" label="Network" sub="Tessera makes no network requests with your data." />
        </Section>
      </ScrollView>

      <Sheet visible={!!pinFlow} onClose={() => setPinFlow(null)} title={pinFlow === "confirm" ? "Confirm PIN" : "Choose a 4-digit PIN"} testID="settings-pin-sheet">
        <PinPad
          testID="settings-pin"
          resetKey={pinKey}
          error={pinErr}
          onComplete={async (p) => {
            if (pinFlow === "enter") {
              setFirst(p);
              setPinErr(undefined);
              setPinFlow("confirm");
              setPinKey((k) => k + 1);
            } else if (p === first) {
              await setPin(p);
              setSettings({ lockEnabled: true });
              setPinFlow(null);
              toast("App lock is on", "lock-outline");
            } else {
              setPinErr("PINs didn't match");
              setPinFlow("enter");
              setPinKey((k) => k + 1);
            }
          }}
        />
      </Sheet>

      <Sheet visible={exportWarn} onClose={() => setExportWarn(false)} title="Export backup" testID="export-sheet">
        <View style={[styles.warn, { backgroundColor: colors.brandTertiary }]}>
          <Icon name="alert-outline" size={20} color={colors.onBrandTertiary} />
          <T color={colors.onBrandTertiary} style={{ flex: 1 }}>This backup file is not encrypted yet (password-protected backups arrive in Phase 2). Store it somewhere private.</T>
        </View>
        <T muted style={{ marginVertical: 12 }}>Includes all records, relationships, budgets, tiles and settings. Your PIN is never exported.</T>
        <Button
          label="Export now"
          icon="export-variant"
          testID="export-confirm-button"
          onPress={async () => {
            try {
              const name = await exportBackup(db);
              setExportWarn(false);
              toast(`Backup ready · ${name}`, "check-circle-outline");
            } catch {
              toast("Export failed", "alert-circle-outline");
            }
          }}
        />
      </Sheet>

      <Sheet visible={!!restore} onClose={() => setRestore(null)} title="Restore preview" testID="restore-sheet">
        {restore ? (
          <>
            <T muted style={{ marginBottom: 10 }}>Exported {new Date(restore.exportedAt).toLocaleString()}</T>
            <View style={[styles.group, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
              {Object.entries(restore.counts).map(([k, v], i) => (
                <View key={k} style={[styles.row, { minHeight: 40 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                  <T style={{ flex: 1, textTransform: "capitalize" }}>{k}</T>
                  <T v="mono">{v}</T>
                </View>
              ))}
            </View>
            <View style={[styles.warn, { backgroundColor: colors.brandTertiary, marginTop: 12 }]}>
              <Icon name="swap-horizontal" size={20} color={colors.onBrandTertiary} />
              <T color={colors.onBrandTertiary} style={{ flex: 1 }}>All current data on this device will be replaced. Your PIN and lock settings stay as they are.</T>
            </View>
            <Button
              style={{ marginTop: 12 }}
              label="Replace and restore"
              icon="backup-restore"
              testID="restore-confirm-button"
              onPress={() => {
                replace({ ...restore.data, settings: { ...restore.data.settings, onboarded: true, lockEnabled: s.lockEnabled, biometricEnabled: s.biometricEnabled } });
                setRestore(null);
                toast("Backup restored", "check-circle-outline");
              }}
            />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={confirmReset} onClose={() => setConfirmReset(false)} title="Erase everything?" testID="reset-sheet">
        <T style={{ marginBottom: 16 }}>This removes every vehicle, transaction, subscription, link and setting from this device. Export a backup first if you might want it back.</T>
        <Button
          kind="danger"
          icon="delete-forever-outline"
          label="Erase all data"
          testID="reset-confirm-button"
          onPress={async () => {
            await clearPin();
            replace(emptyDB());
            setConfirmReset(false);
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, minHeight: 56, paddingVertical: 8 },
  swatchWrap: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingLeft: 4, paddingRight: 12, borderRadius: radius.pill, borderWidth: 1.5 },
  swatch: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  warn: { flexDirection: "row", gap: 10, padding: 12, borderRadius: radius.md },
});
