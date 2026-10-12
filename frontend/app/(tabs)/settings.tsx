import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { accents, radius, THEMES, useTheme, bindLookStyles } from "@/src/theme";
import { geocode } from "@/src/core/online";
import { locationPhase, placeFromFix } from "@/src/core/locationAsk";
import * as Location from "expo-location";
import type { ModuleId, Place } from "@/src/core/types";
import { useStore } from "@/src/core/store";
import { usesNativeTabs } from "@/src/navigation";
import { CURRENCIES } from "@/src/core/format";
import { aboutTitle } from "@/src/core/about";
import { withoutSampleData, withSampleData } from "@/src/core/sample";
import { BackupFile, decryptBackup, exportBackup, mergeDB, mergePreview, pickBackup } from "@/src/core/backup";
import { passwordStrength, type PasswordEnvelope } from "@/src/core/crypto";
import { biometricAvailable, biometricUnlock, clearFailures, clearPin, hasDecoyPin, hasPin, setDecoyPin, setPin, verifyPin } from "@/src/core/security";
import { LOCK_TIMEOUT_OPTIONS, lockTimeoutLabel, unlockSettingsForNewLock } from "@/src/core/lockSettings";
import { MODULES } from "@/src/core/modules";
import { EXPORTS, exportData, timeline } from "@/src/core/exports";
import { allowLockScreenChannel, notifyOnce, scheduledCount } from "@/src/core/notify";
import { shownInDecoy } from "@/src/core/profiles";
import { emergencyLockCard } from "@/src/core/featureAccess";
import { enableFeature } from "@/src/native/enableFeature";
import { openNotificationListener, requestNotificationAccess } from "@/src/native/android";
import { bankAccessPrompt, bankInboxAfterReturn } from "@/src/core/bankAccess";
import { forgetCloudFile, hideLockCard, installedVersion, showLockCard } from "@/src/native/android";
import { storeLockedCopy } from "@/src/native/cloudFile";
import { secureStorage } from "@/src/utils/storage";
import { accessMode, cloudScope, describeContents, FILE_PASSPHRASE_KEY } from "@/src/core/vaultFile";
import { dataHealth } from "@/src/core/life";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button, Chip, ChipRow, Eyebrow, Icon, Press, Segmented, T } from "@/src/components/ui";
import { LauncherPicker } from "@/src/components/LauncherPicker";
import { LookPicker } from "@/src/components/LookPicker";
import { cleanCallName } from "@/src/core/greeting";
import { Field } from "@/src/components/inputs";
import { Sheet } from "@/src/components/Sheet";
import { PinPad } from "@/src/components/PinPad";
import { useToast } from "@/src/components/Toast";
import * as Sharing from "expo-sharing";
import { writeAsStringAsync } from "expo-file-system/legacy";
import { Paths } from "expo-file-system";
import { buildDeveloperLog } from "@/src/core/devLogs";
import Constants from "expo-constants";
import * as Device from "expo-device";

function Section({ title, children, testID, onLayout }: { title: string; children: React.ReactNode; testID?: string; onLayout?: (y: number) => void }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} onLayout={(event) => onLayout?.(event.nativeEvent.layout.y)} style={{ marginBottom: 20 }}>
      <Eyebrow style={{ marginBottom: 8 }}>{title}</Eyebrow>
      <View style={[styles.group, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function Row({ icon, label, sub, right, first, testID, onPress }: { icon: string; label: string; sub?: string; right?: React.ReactNode; first?: boolean; testID?: string; onPress?: () => void }) {
  const { colors, look } = useTheme();
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
  const st = [styles.row, { minHeight: look.row, paddingVertical: look.space === 1 ? 8 : Math.round(8 * look.space) }, !first && { borderTopWidth: 1, borderTopColor: colors.divider }];
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
  const { db, setSettings, replace, update, session, profiles, activeProfileId, addProfile, switchProfile, renameProfile, deleteProfile, prepareDecoy, wipeVisible } = useStore();
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
  const [profileName, setProfileName] = useState("");
  const [rename, setRename] = useState("");
  const [delProfile, setDelProfile] = useState<string | null>(null);
  const [switchTo, setSwitchTo] = useState<string | null>(null);
  const [sampleFlow, setSampleFlow] = useState<null | "add" | "remove">(null);
  const [decoyFlow, setDecoyFlow] = useState<null | "enter" | "confirm">(null);
  const [decoyFirst, setDecoyFirst] = useState("");
  const [decoyOn, setDecoyOn] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  useEffect(() => {
    if (session === "real" && s.lockEnabled) hasDecoyPin().then(setDecoyOn);
    else setDecoyOn(false);
  }, [session, s.lockEnabled, pinKey]);
  useEffect(() => {
    if (session === "real") biometricAvailable().then(setBioEnrolled);
    else setBioEnrolled(false);
  }, [session, pinKey]);
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
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencies = [...CURRENCIES].sort((a, b) => a.localeCompare(b, "en"));
  const [cloudPassOpen, setCloudPassOpen] = useState(false);
  const [cloudPass, setCloudPass] = useState("");
  const [cloudMessage, setCloudMessage] = useState("");
  const [exportWarn, setExportWarn] = useState(false);
  const [exportPw, setExportPw] = useState("");
  const [exportEncrypt, setExportEncrypt] = useState(true);
  const pwStrength = passwordStrength(exportPw);
  const sizeKb = (JSON.stringify(db).length / 1024).toFixed(1);
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
  const [city, setCity] = useState("");
  const [cityMatches, setCityMatches] = useState<Place[]>([]);
  const locationOnce = locationPhase({ asked: s.locationAsked, granted: s.locationGranted, read: !!s.locationRead });
  useEffect(() => {
    if (locationOnce !== "read") return;
    let cancelled = false;
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }).then((pos) => {
      if (cancelled) return;
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setSettings({ locationRead: { lat, lon }, homeCity: placeFromFix({ lat, lon }, "This phone"), locationAsked: true, locationGranted: true });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locationOnce, setSettings]);
  const [showLog, setShowLog] = useState(false);
  const [showDevLog, setShowDevLog] = useState(false);
  const [devLogPreview, setDevLogPreview] = useState("");
  const [showExports, setShowExports] = useState(false);
  const [diag, setDiag] = useState<null | { scheduled: number }>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const weatherY = useRef(0);
  const scrollToWeather = useCallback(() => {
    if (params.section === "weather") scrollRef.current?.scrollTo({ y: weatherY.current, animated: false });
  }, [params.section]);
  useEffect(() => {
    scrollToWeather();
  }, [scrollToWeather]);
  useFocusEffect(scrollToWeather);

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
    await notifyOnce("Backup did not upload", message);
    toast(message, "cloud-off-outline");
  }

  const restoreReadOnly = !!restore && accessMode(!restore.data.settings.installId || restore.data.settings.installId === s.installId) === "read-only";
  const restoreEffective = restoreMode === "merge" && !restoreReadOnly ? "merge" : "replace";
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: sp.lg, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Eyebrow>Everything stays on this device</Eyebrow>
        <T v="title" testID="settings-title">Settings</T>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: sp.lg, paddingBottom: bottomChrome + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {session === "real" ? (
          <Section title="You">
            <View style={{ padding: 12 }}>
              <Field label="What should I call you?" testID="settings-call-name" value={s.givenName ?? ""} onChangeText={(v) => setSettings({ givenName: cleanCallName(v) || undefined, nameAsked: true })} placeholder="Harsha" autoCapitalize="words" hint="Shown on Today. A decoy PIN does not see this." />
            </View>
          </Section>
        ) : null}

        <Section title="Appearance">
          <View style={{ padding: 12, gap: 12 }}>
            <T v="label">Color</T>
            <View style={{ marginHorizontal: -12 }}>
              <ChipRow testID="settings-theme-row">
                {[["system", "System", undefined], ...Object.entries(THEMES).map(([k, t]) => [k, t.name, t.swatch])].map(([k, n, sw]) => (
                  <Press key={k} testID={`settings-theme-${k}`} onPress={() => setSettings({ theme: k as any, appearanceChosen: true })} accessibilityState={{ selected: s.theme === k }} style={[styles.swatchWrap, { borderColor: s.theme === k ? colors.onSurface : colors.border }]}>
                    <View style={[styles.swatch, { backgroundColor: sw ?? colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong }]}>{s.theme === k ? <Icon name="check" size={14} color={k === "paper" ? "#111418" : "#FFFFFF"} /> : null}</View>
                    <T v="caption">{n}</T>
                  </Press>
                ))}
              </ChipRow>
            </View>
            <LookPicker />
            <Segmented testID="settings-density" value={s.density} onChange={(v) => setSettings({ density: v })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "dense", label: "Dense" }]} />
            <LauncherPicker />
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

        <Section title="Online (optional)" testID="settings-weather" onLayout={(y) => { weatherY.current = y; if (params.section === "weather") scrollRef.current?.scrollTo({ y, animated: false }); }}>
          <Row first icon="web" label="Online features" sub={s.online ? "On · rates, weather, holidays. Only queries leave the device." : "Off · no network requests at all"} right={<Switch testID="settings-online-switch" value={s.online} onValueChange={(v) => setSettings({ online: v })} {...sw} />} />
          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
            <T v="label" style={{ marginBottom: 6 }}>Home city (weather)</T>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput testID="settings-city-input" value={city} onChangeText={setCity} placeholder={s.homeCity?.name ?? "e.g. Bengaluru"} placeholderTextColor={colors.muted} style={{ flex: 1, height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
              <Button small label="Find" testID="settings-city-find" disabled={!s.online || !city.trim()} onPress={async () => setCityMatches(await geocode(s.online, (e) => update((d) => ({ ...d, netlog: [e, ...d.netlog].slice(0, 300) })), city))} />
            </View>
            {cityMatches.map((m, i) => (
              <Press key={i} testID={`settings-city-result-${i}`} onPress={() => (setSettings({ homeCity: m }), setCityMatches([]), setCity(""), toast(`Home city: ${m.name}`, "map-marker-outline"))} style={{ paddingVertical: 10 }}>
                <T numberOfLines={1}>{m.name}</T>
              </Press>
            ))}
            {s.homeCity ? <T muted style={{ fontSize: 12, marginTop: 6 }}>Current: {s.homeCity.name}. The forecast uses about 1 km, not your street, and prefers a land reading.</T> : null}
            {locationPhase({ asked: s.locationAsked, granted: s.locationGranted, read: !!s.locationRead }) === "ask" ? (
              <Button small label="Use this phone's location once" testID="settings-location-once" onPress={async () => {
                const result = await Location.requestForegroundPermissionsAsync();
                if (!result.granted) setSettings({ locationAsked: true, locationGranted: false });
                else setSettings({ locationAsked: true, locationGranted: true });
              }} style={{ marginTop: 8 }} />
            ) : null}
            {locationPhase({ asked: s.locationAsked, granted: s.locationGranted, read: !!s.locationRead }) === "stop" && s.locationAsked && !s.locationGranted ? (
              <T muted style={{ fontSize: 12, marginTop: 6 }}>Location stays off. Nucleus cannot turn the phone's location switch on or off.</T>
            ) : null}
            {!s.online ? <T muted style={{ fontSize: 12, marginTop: 6 }}>Turn Online on to search for a city.</T> : null}
          </View>
          <Row icon="format-list-bulleted" label="Network log" sub={`${db.netlog.length} request${db.netlog.length === 1 ? "" : "s"} ever made`} testID="settings-netlog-button" onPress={() => setShowLog(true)} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        </Section>

        <Section title="Defaults">
          <View style={{ padding: 12 }}>
            <Press testID="settings-currency-row" onPress={() => setCurrencyOpen(true)} style={{ height: 46, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 16, justifyContent: "center", backgroundColor: colors.surfaceTertiary }}>
              <T>{s.currency}</T>
            </Press>
          </View>
          <View style={{ padding: 12, paddingTop: 4, gap: 10 }}>
            <Segmented testID="settings-distance" value={s.distanceUnit} onChange={(v) => setSettings({ distanceUnit: v })} options={[{ value: "km", label: "km" }, { value: "mi", label: "miles" }]} />
            <Segmented testID="settings-volume" value={s.volumeUnit} onChange={(v) => setSettings({ volumeUnit: v })} options={[{ value: "L", label: "Litres" }, { value: "gal", label: "Gallons" }]} />
            <Segmented testID="settings-temp" value={s.tempUnit} onChange={(v) => setSettings({ tempUnit: v })} options={[{ value: "C", label: "°C" }, { value: "F", label: "°F" }]} />
            <Segmented testID="settings-time" value={s.timeFormat} onChange={(v) => setSettings({ timeFormat: v })} options={[{ value: "12h", label: "12-hour" }, { value: "24h", label: "24-hour" }]} />
            <T muted style={{ fontSize: 12 }}>Distance, fuel volume, temperature and time are what your records use. Length, weight, cooking measures, speed, area, data, pressure and energy are in Tools.</T>
          </View>
          <Row icon="link-variant" label="Auto-link vehicle costs to Money" sub="Fuel & service costs create linked expenses" right={<Switch testID="settings-autolink-switch" value={s.autoLinkExpenses} onValueChange={(v) => setSettings({ autoLinkExpenses: v })} {...sw} />} />
        </Section>

        {session === "real" ? (
          <Section title="Profiles">
            <View style={{ padding: 12, gap: 8 }}>
              <T muted style={{ fontSize: 12 }}>Each profile keeps its own records, theme and boards. Hold is for tiles — tap a profile to switch.</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {profiles.map((p) => (
                  <Chip key={p.id} label={p.id === activeProfileId && s.givenName ? s.givenName : p.name} selected={p.id === activeProfileId} testID={`profile-${p.id}`} onPress={() => { if (p.id !== activeProfileId) setSwitchTo(p.id); }} />
                ))}
              </View>
              <TextInput testID="profile-name-input" value={profileName} onChangeText={setProfileName} placeholder="New profile name" placeholderTextColor={colors.muted} style={{ height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
              <Button
                small
                kind="secondary"
                icon="plus"
                label="Add profile"
                testID="profile-add-button"
                onPress={async () => {
                  const ok = await addProfile(profileName);
                  if (!ok) toast("Six profiles is the limit", "alert-circle-outline");
                  else {
                    setProfileName("");
                    toast("Profile added", "account-outline");
                  }
                }}
              />
              <TextInput testID="profile-rename-input" value={rename} onChangeText={setRename} placeholder="Rename the open profile" placeholderTextColor={colors.muted} style={{ height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
              <Button small kind="ghost" label="Rename" testID="profile-rename-button" onPress={() => renameProfile(activeProfileId, rename).then(() => setRename(""))} />
              {profiles.filter((p) => p.id !== activeProfileId).map((p) => (
                <Button key={p.id} small kind="danger" label={`Delete ${p.name}`} testID={`profile-delete-${p.id}`} onPress={() => setDelProfile(p.id)} />
              ))}
            </View>
          </Section>
        ) : null}

        <Section title="Security & privacy">
          <View style={{ padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}>
              <Icon name="lock-outline" size={20} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <T v="label">App lock</T>
                <T muted style={{ fontSize: 12 }}>
                  {s.lockEnabled
                    ? `On · asks on open, after the phone locks, and after ${lockTimeoutLabel(s.lockTimeoutSec ?? 30).toLowerCase()} away`
                    : "Off · fingerprint or face unlock is available once lock is on and a PIN is set"}
                </T>
              </View>
              <Switch
                testID="settings-lock-switch"
                value={s.lockEnabled}
                onValueChange={async (v) => {
                  if (v) {
                    setPinErr(undefined);
                    setPinFlow("enter");
                  } else {
                    await clearPin();
                    await clearFailures();
                    setSettings({ lockEnabled: false, biometricEnabled: false, moduleLocks: [] });
                    toast("App lock turned off", "lock-open-outline");
                  }
                }}
                {...sw}
              />
            </View>
            <View style={{ opacity: s.lockEnabled ? 1 : 0.45 }} pointerEvents={s.lockEnabled ? "auto" : "none"}>
              <T v="label" style={{ marginBottom: 4 }}>How you unlock</T>
              <T muted style={{ fontSize: 12, marginBottom: 8 }}>Your PIN always works as a fallback.</T>
              <Segmented
                testID="settings-unlock-method"
                value={s.unlockMethod}
                onChange={async (v) => {
                  if (!s.lockEnabled) return;
                  if (v !== "pin" && !(await biometricAvailable())) return toast("No fingerprint or face enrolled on this device", "alert-circle-outline");
                  setSettings({ unlockMethod: v, biometricEnabled: v !== "pin" });
                }}
                options={[
                  { value: "pin", label: "PIN" },
                  { value: "biometric", label: "Fingerprint or face" },
                  { value: "both", label: "Both" },
                ]}
              />
              {!bioEnrolled && s.lockEnabled ? (
                <T muted style={{ fontSize: 12, marginTop: 6 }} testID="settings-bio-hint">Enroll a fingerprint or face in Android settings to use biometrics here.</T>
              ) : null}
            </View>
            {s.lockEnabled ? (
              <View>
                <T v="label" style={{ marginBottom: 6 }}>Lock again after switching away</T>
                <Segmented
                  testID="settings-lock-timeout"
                  value={String(s.lockTimeoutSec ?? 30)}
                  onChange={(v) => setSettings({ lockTimeoutSec: Number(v) })}
                  options={LOCK_TIMEOUT_OPTIONS.map((o) => ({ value: String(o.sec), label: o.label }))}
                />
              </View>
            ) : null}
          </View>
          {s.lockEnabled ? (
            <>
              <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
                <T v="label" style={{ marginBottom: 8 }}>When the lock asks</T>
                <T muted style={{ fontSize: 12 }} testID="settings-lock-policy">
                  It asks when you open the app, when the phone was locked or the screen turned off, and when you return after longer than {lockTimeoutLabel(s.lockTimeoutSec ?? 30).toLowerCase()}. Short trips to the photo picker or share sheet do not ask again.
                </T>
              </View>
              <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
                <T v="label" style={{ marginBottom: 4 }}>Ask again for these modules</T>
                <T muted style={{ fontSize: 12, marginBottom: 8 }}>Opening them needs your PIN or biometrics again.</T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {MODULES.filter((m) => m.status === "available" && (session === "real" || shownInDecoy(m.id))).map((m) => {
                    const on = (s.moduleLocks ?? []).includes(m.id as ModuleId);
                    return (
                      <Chip
                        key={m.id}
                        label={m.name}
                        icon={on ? "lock-outline" : "lock-open-variant-outline"}
                        selected={on}
                        testID={`settings-module-lock-${m.id}`}
                        onPress={() => setSettings({ moduleLocks: on ? (s.moduleLocks ?? []).filter((x) => x !== m.id) : [...(s.moduleLocks ?? []), m.id as ModuleId] })}
                      />
                    );
                  })}
                </View>
              </View>
              {session === "real" ? (
                <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
                  <T v="label">Decoy PIN</T>
                  <T muted style={{ fontSize: 12, marginTop: 4, marginBottom: 8 }}>
                    {decoyOn ? "Set. It only works on the lock screen, and the app looks the same afterwards." : "A second PIN opens a sample workspace. Nothing on screen marks it as different. It only works on the lock screen."}
                  </T>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Button small kind="secondary" label={decoyOn ? "Change decoy PIN" : "Set decoy PIN"} testID="settings-decoy-button" onPress={() => (setPinErr(undefined), setDecoyFlow("enter"))} />
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
          <Row icon="content-copy" label="Clear clipboard after copying" sub="Wipes copied amounts after a minute" right={<Switch testID="settings-clipboard-switch" value={s.clipboardAutoClear} onValueChange={(v) => setSettings({ clipboardAutoClear: v })} {...sw} />} />
          <Row icon="eye-off-outline" label="Privacy mode" sub="Mask every amount until tapped" right={<Switch testID="settings-privacy-switch" value={s.privacyMode} onValueChange={(v) => setSettings({ privacyMode: v })} {...sw} />} />
          <Row icon="shield-account-outline" label="Privacy and usage" sub="What stays on this phone" testID="settings-privacy-usage" onPress={() => router.push("/privacy")} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
          <Row
            icon="cellphone-screenshot"
            label="Allow screen sharing"
            sub="Off by default. When on, Discord, WhatsApp, and screenshots can show this screen. Turn off after demos."
            right={
              <Switch
                testID="settings-screenshot-switch"
                value={!s.blockScreenshots}
                onValueChange={(v) => setSettings({ blockScreenshots: !v })}
                {...sw}
              />
            }
          />
        </Section>

        <Section title="Emergency card">
          <View style={{ padding: 12, gap: 8 }}>
            <T muted style={{ fontSize: 12 }}>Blood group and one phone number. The plate of your default vehicle is added on the lock screen. Leave the switch off and none of this shows before the PIN.</T>
            <TextInput testID="emergency-blood" value={s.emergency.bloodGroup} onChangeText={(t) => setSettings({ emergency: { ...s.emergency, bloodGroup: t } })} placeholder="Blood group" placeholderTextColor={colors.muted} style={{ height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
            <TextInput testID="emergency-name" value={s.emergency.contactName} onChangeText={(t) => setSettings({ emergency: { ...s.emergency, contactName: t } })} placeholder="Contact name" placeholderTextColor={colors.muted} style={{ height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
            <TextInput testID="emergency-phone" value={s.emergency.contactPhone} onChangeText={(t) => setSettings({ emergency: { ...s.emergency, contactPhone: t } })} placeholder="Phone" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={{ height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
            <TextInput testID="emergency-note" value={s.emergency.note} onChangeText={(t) => setSettings({ emergency: { ...s.emergency, note: t } })} placeholder="Note, such as an allergy" placeholderTextColor={colors.muted} style={{ height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
          </View>
          <Row icon="card-account-details-outline" label="Show on the lock screen" sub="Asks for notification permission, then the card can show before unlock" right={<Switch testID="emergency-lock-switch" value={s.emergency.showOnLock} onValueChange={async (v) => {
            if (!v) {
              setSettings({ emergency: { ...s.emergency, showOnLock: false } });
              hideLockCard();
              return;
            }
            if (!(await enableFeature("emergency-card"))) return toast("Allow notifications so the card can show on the lock screen", "alert-circle-outline");
            await allowLockScreenChannel();
            const plate = (db.vehicles.find((vehicle) => vehicle.id === s.defaultVehicleId) ?? db.vehicles[0])?.plate ?? "";
            const card = emergencyLockCard({ showOnLock: true, bloodGroup: s.emergency.bloodGroup, phone: s.emergency.contactPhone, plate });
            setSettings({ emergency: { ...s.emergency, showOnLock: true }, lockAlerts: true });
            if (card) showLockCard(card.title, card.body);
            else hideLockCard();
          }} {...sw} />} />
          <Row icon="bell-outline" label="Lock-screen alerts" sub="Reminders use the same permission and can show on the lock screen" right={<Switch testID="settings-lock-alerts" value={s.lockAlerts} onValueChange={async (v) => {
            if (!v) return setSettings({ lockAlerts: false });
            if (!(await enableFeature("lock-alerts"))) return toast("Allow notifications to show alerts on the lock screen", "alert-circle-outline");
            await allowLockScreenChannel();
            setSettings({ lockAlerts: true });
          }} {...sw} />} />
          <Row icon="message-text-outline" label="Bank texts" sub="Debit, credit, and balance lines come from bank notifications on this phone. Codes are dropped. Opens notification access." right={<Switch testID="settings-sms" value={s.smsInbox} onValueChange={(v) => {
            if (!v) {
              setBankNote("");
              return setSettings({ smsInbox: false, bankTextsAsked: false });
            }
            const accessOn = requestNotificationAccess();
            setSettings({ bankTextsAsked: true, ...(accessOn ? { smsInbox: true } : {}) });
            if (accessOn) {
              setBankNote(prompt.line);
              return;
            }
            const opened = openNotificationListener();
            setBankNote(opened === "blocked" ? `${prompt.line} ${prompt.blockedLine}` : prompt.line);
          }} {...sw} />} />
          <T testID="settings-sms-note" style={{ paddingHorizontal: 16, paddingBottom: 12 }}>{bankNote || prompt.line}</T>
        </Section>

        <Section title="Home screen">
          <Row first icon="widgets-outline" label="Widgets and shortcuts" sub="Countdown, budget, trip, maintenance, battery, the next cycle window, and a long-press on the icon" testID="settings-shortcuts" onPress={() => router.push("/shortcuts")} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
          <Row icon="package-variant-closed" label="Packs" sub="Share templates, tools, checklists and rules by file" testID="settings-packs" onPress={() => router.push("/packs")} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        </Section>

        <Section title="Accessibility">
          <Row first icon="contrast-circle" label="High contrast" sub="Stronger text, borders and dividers" right={<Switch testID="settings-contrast-switch" value={s.highContrast} onValueChange={(v) => setSettings({ highContrast: v })} {...sw} />} />
          <Row icon="gesture-tap-button" label="Large touch targets" sub="Bigger buttons and chips" right={<Switch testID="settings-largetouch-switch" value={s.largeTouch} onValueChange={(v) => setSettings({ largeTouch: v })} {...sw} />} />
          <Row icon="motion-outline" label="Reduce motion" sub="Skip tile animations and press effects" right={<Switch testID="settings-motion-switch" value={s.reducedMotion} onValueChange={(v) => setSettings({ reducedMotion: v })} {...sw} />} />
        </Section>

        <Section title="Locked file">
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

        <Section title="Your data">
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
          <Row icon="flask-outline" label="Add sample data" sub="Explore insights with a demo workspace" testID="settings-sample-button" onPress={() => setSampleFlow("add")} right={<Icon name="plus" size={18} color={colors.muted} />} />
          <Row icon="flask-empty-outline" label="Remove sample data" sub="Takes out the demo rows. Entries you added stay." testID="settings-sample-remove-button" onPress={() => setSampleFlow("remove")} right={<Icon name="minus" size={18} color={colors.muted} />} />
          <Row icon="delete-outline" label="Erase all data" sub="Cannot be undone" testID="settings-reset-button" onPress={() => setConfirmReset(true)} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        </Section>

        <Section title="About">
          <Row first icon="view-grid-outline" label={aboutTitle(installedVersion())} testID="settings-about-version" sub="Local-first. No account, no cloud, no AI. Insights are rules + your history." />
          <Row icon="shield-check-outline" label="Your records never leave" sub="Online mode sends only queries (currency code, city). Weather by Open-Meteo.com (CC BY 4.0)." />
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
              const bio = await biometricAvailable();
              const unlock = unlockSettingsForNewLock(bio);
              setSettings({ lockEnabled: true, ...unlock });
              setPinFlow(null);
              if (bio) toast("App lock is on · fingerprint or face included", "lock-outline");
              else toast("App lock is on · add a fingerprint or face in Android settings for biometrics", "lock-outline");
            } else {
              setPinErr("PINs didn't match");
              setPinFlow("enter");
              setPinKey((k) => k + 1);
            }
          }}
        />
      </Sheet>

      <Sheet visible={!!decoyFlow} onClose={() => setDecoyFlow(null)} title={decoyFlow === "confirm" ? "Confirm decoy PIN" : "Choose a decoy PIN"} testID="settings-decoy-sheet">
        <T muted style={{ marginBottom: 12 }}>Use a different PIN from your real one. Entering it on the lock screen opens the sample workspace.</T>
        <PinPad
          testID="settings-decoy-pin"
          resetKey={pinKey}
          error={pinErr}
          onComplete={async (p) => {
            if (decoyFlow === "enter") {
              if ((await verifyPin(p)) === "primary") {
                setPinErr("That is your real PIN. Choose another.");
                setPinKey((k) => k + 1);
                return;
              }
              setDecoyFirst(p);
              setPinErr(undefined);
              setDecoyFlow("confirm");
              setPinKey((k) => k + 1);
            } else if (p === decoyFirst) {
              await setDecoyPin(p);
              await prepareDecoy();
              setDecoyOn(true);
              setDecoyFlow(null);
              toast("Decoy PIN saved", "shield-lock-outline");
            } else {
              setPinErr("PINs didn't match");
              setDecoyFlow("enter");
              setPinKey((k) => k + 1);
            }
          }}
        />
      </Sheet>

      <Sheet visible={showLog} onClose={() => setShowLog(false)} title="Network log" testID="netlog-sheet">
        {db.netlog.length === 0 ? <T muted testID="netlog-empty">No requests have ever been made. Nucleus has been fully offline.</T> : db.netlog.slice(0, 100).map((e) => (
          <View key={e.id} style={{ flexDirection: "row", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <Icon name={e.ok ? "check-circle-outline" : "alert-circle-outline"} size={16} color={e.ok ? colors.success : colors.error} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="label" numberOfLines={1}>{e.service}</T>
              <T muted style={{ fontSize: 12 }} numberOfLines={1}>asked: {e.query} · {new Date(e.at).toLocaleString()}</T>
            </View>
          </View>
        ))}
      </Sheet>

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
          <View style={[styles.warn, { backgroundColor: colors.brandTertiary, marginTop: 12 }]}>
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
            <View style={[styles.group, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, marginTop: 12 }]}>
              {Object.entries(restoreEffective === "merge" ? mergePreview(db, restore.data) : restore.counts).map(([k, v], i) => (
                <View key={k} style={[styles.row, { minHeight: 40 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                  <T style={{ flex: 1, textTransform: "capitalize" }}>{k}</T>
                  <T v="mono">{v}</T>
                </View>
              ))}
            </View>
            <View style={[styles.warn, { backgroundColor: colors.brandTertiary, marginTop: 12 }]}>
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
        <View style={[styles.group, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
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
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }, e.count(db) === 0 && { opacity: 0.45 }]}
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
        <View style={[styles.group, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
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
            <View key={k} style={[styles.row, { minHeight: 40 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
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

      <Sheet visible={currencyOpen} onClose={() => setCurrencyOpen(false)} title="Currency" testID="settings-currency-sheet">
        <ScrollView style={{ maxHeight: 360 }}>
          {currencies.map((c) => (
            <Press key={c} testID={`settings-currency-${c}`} onPress={() => (setSettings({ currency: c }), setCurrencyOpen(false))} style={{ minHeight: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.divider, opacity: s.currency === c ? 1 : 0.85 }}>
              <T v="label">{c}</T>
            </Press>
          ))}
        </ScrollView>
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

      <Sheet visible={!!delProfile} onClose={() => setDelProfile(null)} title={`Delete ${profiles.find((p) => p.id === delProfile)?.name ?? "profile"}?`} testID="profile-delete-sheet">
        <T style={{ marginBottom: 16 }}>Every record in this profile is removed. This cannot be undone.</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button kind="ghost" label="Cancel" testID="profile-delete-cancel" onPress={() => setDelProfile(null)} style={{ flex: 1 }} />
          <Button
            kind="danger"
            label="Delete"
            icon="delete-outline"
            testID="profile-delete-confirm"
            onPress={() => {
              if (!delProfile) return;
              deleteProfile(delProfile);
              setDelProfile(null);
              toast("Profile deleted", "account-remove-outline");
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>

      <Sheet visible={!!switchTo} onClose={() => setSwitchTo(null)} title={`Switch to ${profiles.find((p) => p.id === switchTo)?.name ?? "profile"}?`} testID="profile-switch-sheet">
        <T style={{ marginBottom: 16 }}>Your current records are hidden until you switch back.</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button kind="ghost" label="Cancel" testID="profile-switch-cancel" onPress={() => setSwitchTo(null)} style={{ flex: 1 }} />
          <Button
            label="Switch"
            icon="account-switch-outline"
            testID="profile-switch-confirm"
            onPress={() => {
              if (!switchTo) return;
              switchProfile(switchTo);
              setSwitchTo(null);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>

      <Sheet visible={sampleFlow === "add"} onClose={() => setSampleFlow(null)} title="Add sample data?" testID="settings-sample-sheet">
        <T style={{ marginBottom: 16 }}>Demo vehicles and transactions will be mixed into your Money, Vehicles and the rest. Remove sample data takes them out again; entries you add yourself stay.</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button kind="ghost" label="Cancel" testID="settings-sample-cancel" onPress={() => setSampleFlow(null)} style={{ flex: 1 }} />
          <Button
            label="Add sample data"
            icon="flask-outline"
            testID="settings-sample-confirm"
            onPress={() => {
              setSampleFlow(null);
              update(withSampleData);
              toast("Sample data added", "flask-outline");
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>

      <Sheet visible={sampleFlow === "remove"} onClose={() => setSampleFlow(null)} title="Remove sample data?" testID="settings-sample-remove-sheet">
        <T style={{ marginBottom: 16 }}>Every demo row added by Add sample data is dropped from this profile. Entries you added yourself stay. This cannot be undone.</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button kind="ghost" label="Cancel" testID="settings-sample-remove-cancel" onPress={() => setSampleFlow(null)} style={{ flex: 1 }} />
          <Button
            kind="danger"
            label="Remove sample data"
            icon="flask-empty-outline"
            testID="settings-sample-remove-confirm"
            onPress={() => {
              setSampleFlow(null);
              update(withoutSampleData);
              toast("Sample data removed", "flask-empty-outline");
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  group: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, minHeight: 56, paddingVertical: 8 },
  swatchWrap: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingLeft: 4, paddingRight: 12, borderRadius: radius.pill, borderWidth: 1.5 },
  swatch: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  warn: { flexDirection: "row", gap: 10, padding: 12, borderRadius: radius.md },
}));
