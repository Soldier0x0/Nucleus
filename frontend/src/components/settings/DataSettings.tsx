import React, { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { withoutSampleData, withSampleData } from "@/src/core/sample";
import { BackupFile, decryptBackup, exportBackup, mergeDB, mergePreview, pickBackup } from "@/src/core/backup";
import { passwordStrength, type PasswordEnvelope } from "@/src/core/crypto";
import { biometricAvailable, biometricUnlock, hasPin, verifyPin } from "@/src/core/security";
import { EXPORTS, exportData, timeline } from "@/src/core/exports";
import { scheduledCount } from "@/src/core/notify";
import { forgetCloudFile } from "@/src/native/android";
import { storeLockedCopy } from "@/src/native/cloudFile";
import { secureStorage } from "@/src/utils/storage";
import { accessMode, cloudScope, describeContents, FILE_PASSPHRASE_KEY } from "@/src/core/vaultFile";
import { dataHealth } from "@/src/core/life";
import { buildDeveloperLog } from "@/src/core/devLogs";
import * as Sharing from "expo-sharing";
import { writeAsStringAsync } from "expo-file-system/legacy";
import { Paths } from "expo-file-system";
import { Button, Icon, Press, Segmented, T } from "@/src/components/ui";
import { Field } from "@/src/components/inputs";
import { Sheet } from "@/src/components/Sheet";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { PinPad } from "@/src/components/PinPad";
import { useToast } from "@/src/components/Toast";
import { Row, Section, SettingsScreen, settingsStyles, useSettingsAnchor } from "./parts";

/** Data and backup: your data, the locked file and cloud copy, sample data, logs and erase. */
export function DataSettings() {
  const { db, setSettings, replace, update, session, wipeVisible } = useStore();
  const s = db.settings;
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const sizeKb = (JSON.stringify(db).length / 1024).toFixed(1);
  const [restore, setRestore] = useState<BackupFile | null>(null);
  const [restoreMode, setRestoreMode] = useState<"replace" | "merge">("replace");
  const [encBackup, setEncBackup] = useState<{ env: PasswordEnvelope; exportedAt: string } | null>(null);
  const [restorePw, setRestorePw] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [eraseAuth, setEraseAuth] = useState(false);
  const [eraseError, setEraseError] = useState("");
  const [eraseReset, setEraseReset] = useState(0);
  const [eraseNoAuth, setEraseNoAuth] = useState(false);
  const [cloudPassOpen, setCloudPassOpen] = useState(false);
  const [cloudPass, setCloudPass] = useState("");
  const [cloudMessage, setCloudMessage] = useState("");
  const [exportWarn, setExportWarn] = useState(false);
  const [exportPw, setExportPw] = useState("");
  const [exportEncrypt, setExportEncrypt] = useState(true);
  const pwStrength = passwordStrength(exportPw);
  const [showDevLog, setShowDevLog] = useState(false);
  const [devLogPreview, setDevLogPreview] = useState("");
  const [showExports, setShowExports] = useState(false);
  const [diag, setDiag] = useState<null | { scheduled: number }>(null);
  const [confirmSampleRemove, setConfirmSampleRemove] = useState(false);

  async function storeCloud(passphrase: string) {
    const result = await storeLockedCopy(db, passphrase, s.cloud.provider);
    if (result.ok) {
      setCloudMessage("");
      setSettings({ cloud: { ...s.cloud, lastSyncAt: new Date().toISOString(), askedSinceUnlock: true } });
      toast("The locked file is stored", "cloud-check-outline");
      setCloudPassOpen(false);
      return;
    }
    const message = result.message.trim() || "The locked file is still only on this phone.";
    setCloudMessage(message);
    toast(message, "cloud-off-outline");
  }

  const restoreReadOnly = !!restore && accessMode(!restore.data.settings.installId || restore.data.settings.installId === s.installId) === "read-only";
  const restoreEffective = restoreMode === "merge" && !restoreReadOnly ? "merge" : "replace";
  const anchor = useSettingsAnchor();
  return (
    <SettingsScreen title="Data and backup" testID="settings-data" anchor={anchor}>
      <Section title="Your data" anchor="your-data">
        <Row first icon="database-outline" label="Local data" sub={`${db.vehicles.length} vehicles · ${db.fuel.length} fuel · ${db.txns.length} transactions · ${sizeKb} KB`} testID="settings-data-summary" />
        <Row icon="shield-lock-outline" label="Encrypted on this device" sub="AES-256-GCM · key held in the Android Keystore" testID="settings-encryption-row" />
        <Row icon="export-variant" label="Export everything" sub={s.lastBackupAt ? `Last backup ${new Date(s.lastBackupAt).toLocaleString()}` : "No backup saved from this device yet"} testID="settings-export-button" onPress={() => setExportWarn(true)} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        <Row
          icon="backup-restore"
          label="Restore from backup"
          sub="Merge a file from another phone, or replace this one"
          testID="settings-restore-button"
          right={<Icon name="chevron-right" size={18} color={colors.muted} />}
          onPress={async () => {
            try {
              const b = await pickBackup();
              if (!b) return;
              setRestoreMode("merge");
              if (b.kind === "encrypted") {
                setRestorePw("");
                setEncBackup({ env: b.env, exportedAt: b.exportedAt });
              } else setRestore(b.file);
            } catch (e: any) {
              toast(e?.message ?? "Couldn't read that file", "alert-circle-outline");
            }
          }}
        />
        <Row icon="file-export-outline" label="Export a table or calendar" sub="CSV per module · ICS for renewals and trips" testID="settings-exports-button" onPress={() => setShowExports(true)} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        <Row icon="timeline-text-outline" label="Timeline" sub={`${timeline(db).length} things have happened`} testID="settings-timeline-button" onPress={() => router.push("/timeline")} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        <Row icon="star-four-points-outline" label="Year in Review" sub="Your year, counted from your own records" testID="settings-review-button" onPress={() => router.push("/review")} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        <Row icon="stethoscope" label="Diagnostics" sub="Storage, reminders and network activity" testID="settings-diagnostics-button" onPress={async () => setDiag({ scheduled: await scheduledCount() })} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        <Row
          icon="file-download-outline"
          label="Download logs for developer"
          sub="Perf and errors only — no personal data"
          testID="settings-dev-logs"
          onPress={() => {
            setDevLogPreview(
              buildDeveloperLog({
                app: Constants.expoConfig?.version ?? "unknown",
                build: Constants.nativeBuildVersion ?? "dev",
                platform: `${Device.osName ?? "unknown"} ${Device.osVersion ?? ""}`.trim(),
                model: Device.modelName ?? "unknown",
              }),
            );
            setShowDevLog(true);
          }}
          right={<Icon name="chevron-right" size={18} color={colors.muted} />}
        />
        <Row icon="stethoscope" label="Run self-check" sub="Checks storage, lock, notifications and data, with fixes" testID="settings-self-check" onPress={() => router.push("/selfcheck")} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        <Row icon="flask-outline" label="Add sample data" sub="Explore insights with a demo workspace" testID="settings-sample-button" onPress={() => (update(withSampleData), toast("Sample data added", "flask-outline"))} right={<Icon name="plus" size={18} color={colors.muted} />} />
        <Row icon="flask-empty-outline" label="Remove sample data" sub="Takes out the demo rows. Entries you added stay." testID="settings-sample-remove-button" onPress={() => setConfirmSampleRemove(true)} right={<Icon name="minus" size={18} color={colors.muted} />} />
        <Row icon="delete-outline" label="Erase all data" sub="Cannot be undone" testID="settings-reset-button" onPress={() => setConfirmReset(true)} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
      </Section>

      <Section title="Locked file" anchor="locked-file">
        <View style={{ padding: 12, gap: 8 }}>
          <T muted style={{ fontSize: 12 }}>One file holds money, cycle, notes, settings, and trips. It opens with the passphrase. Biometrics stay on this phone and can stand in for that passphrase here. A copy to Drive or OneDrive stays off until you choose it. Sign in and store this file uploads the locked file to the account you choose. If sign-in or the upload does not finish, the screen says so.</T>
          <Segmented testID="settings-cloud" value={s.cloud.provider} onChange={(provider) => {
            if (provider !== s.cloud.provider) forgetCloudFile();
            setSettings({ cloud: { ...s.cloud, provider, lastSyncAt: provider === s.cloud.provider ? s.cloud.lastSyncAt : undefined, askedSinceUnlock: provider === s.cloud.provider ? s.cloud.askedSinceUnlock : false } });
          }} options={[{ value: "off", label: "Off" }, { value: "drive", label: "Drive" }, { value: "onedrive", label: "OneDrive" }]} />
          {s.cloud.provider !== "off" ? (
            <>
              <T style={{ fontSize: 12 }} testID="settings-cloud-scope">{cloudScope(s.cloud.provider)}</T>
              <Button small label="Sign in and store this file" testID="settings-cloud-upload" onPress={async () => {
                const saved = await secureStorage.getItem(FILE_PASSPHRASE_KEY);
                if (!saved) {
                  setCloudPass("");
                  setCloudMessage("");
                  setCloudPassOpen(true);
                  return;
                }
                await storeCloud(saved);
              }} />
              {cloudMessage ? <T testID="settings-cloud-message" style={{ fontSize: 12 }}>{cloudMessage}</T> : null}
            </>
          ) : null}
        </View>
      </Section>

      <Sheet visible={exportWarn} onClose={() => setExportWarn(false)} title="Export backup" testID="export-sheet">
        <Segmented
          testID="export-mode"
          value={exportEncrypt ? "enc" : "plain"}
          onChange={(v) => setExportEncrypt(v === "enc")}
          options={[{ value: "enc", label: "Password protected" }, { value: "plain", label: "Plain JSON" }]}
        />
        {exportEncrypt ? (
          <View style={{ marginTop: 12 }}>
            <T v="label" style={{ marginBottom: 6 }}>Backup password</T>
            <TextInput
              testID="export-password-input"
              value={exportPw}
              onChangeText={setExportPw}
              secureTextEntry
              autoCapitalize="none"
              placeholder="A phrase you'll remember"
              placeholderTextColor={colors.muted}
              style={{ height: 48, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 12, color: colors.onSurface }}
            />
            <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < pwStrength.score ? (pwStrength.score >= 3 ? colors.success : colors.warning) : colors.surfaceTertiary }} />
              ))}
            </View>
            <T muted style={{ fontSize: 12, marginTop: 6 }} testID="export-password-strength">
              {pwStrength.label} · {pwStrength.hint}
            </T>
          </View>
        ) : (
          <View style={[settingsStyles.warn, { backgroundColor: colors.brandTertiary, marginTop: 12 }]}>
            <Icon name="alert-outline" size={20} color={colors.onBrandTertiary} />
            <T color={colors.onBrandTertiary} style={{ flex: 1 }}>A plain file can be read by anything that opens it. Only use this if you need to inspect or convert your data.</T>
          </View>
        )}
        <T muted style={{ marginVertical: 12 }}>Includes all records, relationships, budgets, tiles and settings. Your PIN is never exported.</T>
        <Button
          label={busy ? "Encrypting…" : "Export now"}
          icon="export-variant"
          testID="export-confirm-button"
          disabled={busy || (exportEncrypt && pwStrength.score < 1)}
          onPress={async () => {
            setBusy(true);
            try {
              const name = await exportBackup(db, exportEncrypt ? exportPw : undefined);
              setExportWarn(false);
              setExportPw("");
              setSettings({ lastBackupAt: new Date().toISOString(), backupNudged: true });
              toast(`Backup ready · ${name}`, "check-circle-outline");
            } catch {
              toast("Export failed", "alert-circle-outline");
            } finally {
              setBusy(false);
            }
          }}
        />
      </Sheet>

      <Sheet visible={!!encBackup} onClose={() => setEncBackup(null)} title="Encrypted backup" testID="restore-password-sheet">
        <T muted style={{ marginBottom: 12 }}>Exported {encBackup ? new Date(encBackup.exportedAt).toLocaleString() : ""}. Enter the password you set when exporting.</T>
        <TextInput
          testID="restore-password-input"
          value={restorePw}
          onChangeText={setRestorePw}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Backup password"
          placeholderTextColor={colors.muted}
          style={{ height: 48, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 12, color: colors.onSurface }}
        />
        <Button
          style={{ marginTop: 12 }}
          label={busy ? "Decrypting…" : "Unlock backup"}
          icon="lock-open-outline"
          testID="restore-password-button"
          disabled={busy || !restorePw}
          onPress={async () => {
            if (!encBackup) return;
            setBusy(true);
            try {
              const file = await decryptBackup(encBackup.env, restorePw);
              setEncBackup(null);
              setRestorePw("");
              setRestore(file);
            } catch (e: any) {
              toast(e?.message ?? "Couldn't open that backup", "alert-circle-outline");
            } finally {
              setBusy(false);
            }
          }}
        />
      </Sheet>

      <Sheet visible={!!restore} onClose={() => setRestore(null)} title="Restore preview" testID="restore-sheet">
        {restore ? (
          <>
            <T style={{ marginBottom: 8 }} testID="restore-describe">{describeContents(restore.data)}</T>
            <T muted style={{ marginBottom: 10 }}>
              Exported {new Date(restore.exportedAt).toLocaleString()}
              {restore.encrypted ? " · password protected" : ""}. {accessMode(Boolean(!restore.data.settings.installId || restore.data.settings.installId === s.installId)) === "read-only" ? "This phone can open it read-only." : "This phone can edit it."}
            </T>
            <Segmented
              testID="restore-mode"
              value={restoreMode}
              onChange={(v) => {
                if (restoreReadOnly && v === "merge") return;
                setRestoreMode(v as "replace" | "merge");
              }}
              options={[{ value: "replace", label: "Replace" }, { value: "merge", label: "Merge" }]}
            />
            <View style={[settingsStyles.group, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, marginTop: 12 }]}>
              {Object.entries(restoreEffective === "merge" ? mergePreview(db, restore.data) : restore.counts).map(([k, v], i) => (
                <View key={k} style={[settingsStyles.row, { minHeight: 40 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                  <T style={{ flex: 1, textTransform: "capitalize" }}>{k}</T>
                  <T v="mono">{v}</T>
                </View>
              ))}
            </View>
            <View style={[settingsStyles.warn, { backgroundColor: colors.brandTertiary, marginTop: 12 }]}>
              <Icon name={restoreEffective === "merge" ? "merge" : "swap-horizontal"} size={20} color={colors.onBrandTertiary} />
              <T color={colors.onBrandTertiary} style={{ flex: 1 }}>
                {restoreEffective === "merge"
                  ? "Records are added to what you already have. If the same record exists in both, the one from the backup wins. Your settings stay as they are."
                  : "All current data on this device will be replaced. Your PIN and lock settings stay as they are."}
              </T>
            </View>
            <Button
              style={{ marginTop: 12 }}
              label={restoreEffective === "merge" ? "Merge into my data" : "Replace and restore"}
              icon={restoreEffective === "merge" ? "merge" : "backup-restore"}
              testID="restore-confirm-button"
              onPress={() => {
                if (restoreEffective === "merge") update((d) => mergeDB(d, restore.data));
                else replace({ ...restore.data, settings: { ...restore.data.settings, onboarded: true, lockEnabled: s.lockEnabled, unlockMethod: s.unlockMethod, biometricEnabled: s.biometricEnabled, moduleLocks: s.moduleLocks, installId: s.installId || restore.data.settings.installId, readOnly: restoreReadOnly } });
                setRestore(null);
                toast(restoreEffective === "merge" ? "Backup merged" : "Backup restored", "check-circle-outline");
              }}
            />
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={showDevLog}
        onClose={() => setShowDevLog(false)}
        title="Developer log"
        testID="devlog-sheet"
        footer={
          <Button
            label="Share log file"
            icon="share-variant-outline"
            testID="devlog-share"
            onPress={async () => {
              const path = `${Paths.cache}/nucleus-dev-log.txt`;
              await writeAsStringAsync(path, devLogPreview);
              if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: "text/plain", dialogTitle: "Nucleus developer log" });
              else toast("Log saved to app cache", "file-download-outline");
              setShowDevLog(false);
            }}
          />
        }
      >
        <T muted style={{ marginBottom: 8, fontSize: 12 }}>No names, amounts, odometer, capture text, or document contents. App, device, scrubbed errors, and timing breadcrumbs only.</T>
        <ScrollView style={{ maxHeight: 320 }}>
          <T v="mono" style={{ fontSize: 11 }}>{devLogPreview}</T>
        </ScrollView>
      </Sheet>

      <Sheet visible={showExports} onClose={() => setShowExports(false)} title="Export a table" testID="exports-sheet">
        <T muted style={{ marginBottom: 12 }}>CSV opens in any spreadsheet. The calendar file (.ics) adds your renewals, expiries and itinerary to a calendar app — one-way, nothing syncs back.</T>
        <View style={[settingsStyles.group, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          {EXPORTS.map((e, i) => (
            <Press
              key={e.kind}
              testID={`export-${e.kind}`}
              disabled={e.count(db) === 0}
              onPress={async () => {
                try {
                  const name = await exportData(db, e.kind);
                  toast(`Saved ${name}`, "check-circle-outline");
                } catch {
                  toast("Export failed", "alert-circle-outline");
                }
              }}
              style={[settingsStyles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }, e.count(db) === 0 && { opacity: 0.45 }]}
            >
              <Icon name={e.icon} size={20} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <T v="label">{e.label}</T>
                <T muted style={{ fontSize: 12 }}>{e.count(db)} row{e.count(db) === 1 ? "" : "s"} · .{e.ext}</T>
              </View>
              <Icon name="download-outline" size={18} color={colors.muted} />
            </Press>
          ))}
        </View>
      </Sheet>

      <Sheet visible={!!diag} onClose={() => setDiag(null)} title="Diagnostics" testID="diagnostics-sheet">
        {dataHealth(db).length ? (
          <View style={{ marginBottom: 12 }} testID="diagnostics-health">
            {dataHealth(db).map((issue) => (
              <T key={issue.id} style={{ marginBottom: 6 }}>{issue.title}. {issue.detail}</T>
            ))}
          </View>
        ) : <T muted style={{ marginBottom: 12 }}>No duplicate expenses or backwards odometer readings.</T>}
        <View style={[settingsStyles.group, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          {([
            ["Encrypted document", `${sizeKb} KB`],
            ["Transactions", String(db.txns.length)],
            ["Fuel + services", `${db.fuel.length} + ${db.services.length}`],
            ["Trips / appliances", `${db.trips.length} / ${db.appliances.length}`],
            ["Notes / rules", `${db.notes.length} / ${db.rules.length}`],
            ["Jars / debts / snapshots", `${db.funds.length} / ${db.debts.length} / ${db.netWorth.length}`],
            ["Custom tools", String(db.customTools.length)],
            ["Links between records", String(db.links.length)],
            ["Attention marks kept", String(Object.keys(db.attention).length)],
            ["Scheduled reminders", String(diag?.scheduled ?? 0)],
            ["Network requests ever", String(db.netlog.length)],
            ["Cached tool results", String(db.toolHistory.length)],
          ] as [string, string][]).map(([k, v], i) => (
            <View key={k} style={[settingsStyles.row, { minHeight: 40 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
              <T style={{ flex: 1 }}>{k}</T>
              <T v="mono">{v}</T>
            </View>
          ))}
        </View>
        <T muted style={{ fontSize: 12, marginTop: 12 }}>Reminders are counted from the phone&apos;s own scheduler. Nothing here is sent anywhere.</T>
      </Sheet>

      <Sheet visible={cloudPassOpen} onClose={() => setCloudPassOpen(false)} title="Passphrase for the locked file" testID="cloud-pass-sheet">
        <T style={{ marginBottom: 12 }}>This passphrase opens the file. It stays on this phone and can be unlocked with biometrics here. It is not written into the file.</T>
        <Field label="Passphrase" testID="cloud-pass" value={cloudPass} onChangeText={setCloudPass} secureTextEntry />
        <Button label="Sign in and store this file" testID="cloud-pass-save" disabled={!cloudPass.trim()} onPress={() => storeCloud(cloudPass)} />
        {cloudMessage ? <T testID="settings-cloud-message" style={{ fontSize: 12, marginTop: 8 }}>{cloudMessage}</T> : null}
      </Sheet>

      <Sheet visible={confirmReset} onClose={() => (setConfirmReset(false), setEraseAuth(false), setEraseError(""), setEraseNoAuth(false))} title="Erase everything?" testID="reset-sheet">
        <T style={{ marginBottom: 16 }}>{session === "real" ? "This removes every profile on this device, including the PIN. Export a backup first if you might want it back." : "This removes the records in the workspace you have open. Export a backup first if you might want them back."}</T>
        {eraseAuth ? (
          <>
            <T style={{ marginBottom: 12 }}>Enter the PIN or use biometrics. Being unlocked already is not enough.</T>
            <PinPad
              testID="reset-pin"
              error={eraseError}
              resetKey={eraseReset}
              onBiometric={async () => {
                const ok = await biometricUnlock("Confirm erase");
                if (!ok) {
                  setEraseError("Biometrics did not confirm.");
                  return;
                }
                await wipeVisible();
                setConfirmReset(false);
                setEraseAuth(false);
              }}
              onComplete={async (pin) => {
                const match = await verifyPin(pin);
                if (match !== "primary") {
                  setEraseError("That PIN does not erase this data.");
                  setEraseReset((n) => n + 1);
                  return;
                }
                await wipeVisible();
                setConfirmReset(false);
                setEraseAuth(false);
              }}
            />
          </>
        ) : eraseNoAuth ? (
          <>
            <T style={{ marginBottom: 12 }}>No PIN or biometrics are set, so there is nothing extra to check. This still cannot be undone.</T>
            <Button
              kind="danger"
              icon="delete-forever-outline"
              label="Erase everything now"
              testID="reset-confirm-final"
              onPress={async () => {
                await wipeVisible();
                setConfirmReset(false);
                setEraseNoAuth(false);
              }}
            />
          </>
        ) : (
          <Button
            kind="danger"
            icon="delete-forever-outline"
            label="Erase all data"
            testID="reset-confirm-button"
            onPress={async () => {
              const [pin, bio] = await Promise.all([hasPin(), biometricAvailable()]);
              if (!pin && !bio) {
                setEraseNoAuth(true);
                return;
              }
              setEraseError("");
              setEraseAuth(true);
            }}
          />
        )}
      </Sheet>

      <ConfirmSheet
        visible={confirmSampleRemove}
        id="settings-sample-remove"
        title="Remove sample data?"
        body="Every demo row added by Add sample data is dropped from this profile. Entries you added yourself stay."
        confirmLabel="Remove"
        icon="flask-empty-outline"
        onCancel={() => setConfirmSampleRemove(false)}
        onConfirm={() => {
          setConfirmSampleRemove(false);
          update(withoutSampleData);
          toast("Sample data removed", "flask-empty-outline");
        }}
      />
    </SettingsScreen>
  );
}
