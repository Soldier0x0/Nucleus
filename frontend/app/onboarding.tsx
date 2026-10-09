import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Switch, useColorScheme, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInRight } from "react-native-reanimated";
import { radius, THEMES, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { CURRENCIES } from "@/src/core/format";
import { MODULES } from "@/src/core/modules";
import { withSampleData } from "@/src/core/sample";
import { biometricAvailable, biometricUnlock, setDecoyPin, setPin, verifyPin } from "@/src/core/security";
import { unlockSettingsForNewLock } from "@/src/core/lockSettings";
import { Button, Chip, ChipRow, Eyebrow, Icon, Segmented, T } from "@/src/components/ui";
import { PinPad } from "@/src/components/PinPad";
import { Mark } from "@/src/components/Mark";
import { Field } from "@/src/components/inputs";
import { cleanCallName } from "@/src/core/greeting";
import { resolveLauncher } from "@/src/core/launcher";
import { decryptBackup, pickBackup } from "@/src/core/backup";
import { accessMode, canOpenFile, describeContents, FILE_PASSPHRASE_KEY, replaceAllowed } from "@/src/core/vaultFile";
import type { DB } from "@/src/core/types";
import type { PasswordEnvelope } from "@/src/core/crypto";
import { secureStorage } from "@/src/utils/storage";

const FILE_PASS = FILE_PASSPHRASE_KEY;

const STEPS = 4;

export default function Onboarding() {
  const { db, setSettings, update, prepareDecoy, replace } = useStore();
  const s = db.settings;
  const { colors, sp } = useTheme();
  const scheme = useColorScheme();
  const mark = resolveLauncher(s.launcher, s.theme, scheme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pinStage, setPinStage] = useState<"off" | "enter" | "confirm" | "done" | "decoy" | "decoyConfirm">("off");
  const [decoyFirst, setDecoyFirst] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [pinErr, setPinErr] = useState<string>();
  const [pinKey, setPinKey] = useState(0);
  const [bioOk, setBioOk] = useState(false);
  const [gate, setGate] = useState<"choose" | "fresh" | "file">("choose");
  const [picked, setPicked] = useState<DB | null>(null);
  const [fileLine, setFileLine] = useState("");
  const [pass, setPass] = useState("");
  const [pendingEnc, setPendingEnc] = useState<{ env: PasswordEnvelope; exportedAt: string } | null>(null);

  const openPicked = (next: DB, line: string) => {
    setPicked(next);
    setFileLine(line);
    setGate("file");
  };

  const bringFile = async () => {
    const pickedFile = await pickBackup();
    if (!pickedFile) return;
    if (pickedFile.kind === "encrypted") {
      setPendingEnc({ env: pickedFile.env, exportedAt: pickedFile.exportedAt });
      setGate("file");
      return;
    }
    openPicked(pickedFile.file.data, describeContents(pickedFile.file.data));
  };

  const applyFile = () => {
    if (!picked || !replaceAllowed(fileLine.length > 0, true)) return;
    const samePhone = !picked.settings.installId || picked.settings.installId === s.installId;
    replace({
      ...picked,
      settings: {
        ...picked.settings,
        onboarded: true,
        nameAsked: true,
        readOnly: accessMode(samePhone) === "read-only",
        installId: s.installId || picked.settings.installId,
      },
    });
    router.replace("/(tabs)");
  };

  const finish = (sample: boolean) => {
    update((d) => {
      const n = { ...d, settings: { ...d.settings, onboarded: true, nameAsked: true } };
      return sample ? withSampleData(n) : n;
    });
    router.replace("/(tabs)");
  };

  if (gate !== "fresh") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, paddingHorizontal: sp.lg }} testID="onboarding-file-gate">
        <Mark size={72} family={mark.family} variant={mark.variant} />
        <T v="title" style={{ marginTop: 16 }}>Start fresh, or bring in a file</T>
        <T muted style={{ marginTop: 8 }}>The file holds money, cycle, notes, settings, and trips. Nucleus says what is in it before anything is replaced.</T>
        {fileLine ? <T style={{ marginTop: 16 }} testID="onboarding-file-describe">{fileLine}</T> : null}
        {pendingEnc && !picked ? (
          <View style={{ marginTop: 16, gap: 10 }}>
            <Field label="Passphrase" testID="onboarding-file-pass" value={pass} onChangeText={setPass} secureTextEntry />
            <Button label="Open with passphrase" testID="onboarding-file-open" onPress={async () => {
              if (!canOpenFile({ passphrase: pass, samePhone: false, biometricOk: false })) return;
              try {
                const file = await decryptBackup(pendingEnc.env, pass);
                await secureStorage.setItem(FILE_PASS, pass);
                openPicked(file.data, describeContents(file.data));
              } catch {
                setFileLine("That passphrase did not open the file.");
              }
            }} />
            <Button kind="secondary" label="Use biometrics on this phone" testID="onboarding-file-bio" onPress={async () => {
              const ok = await biometricUnlock();
              if (!canOpenFile({ passphrase: "", samePhone: true, biometricOk: ok }) || !pendingEnc) {
                setFileLine("Biometrics can stand in for the passphrase only on this phone.");
                return;
              }
              const saved = await secureStorage.getItem(FILE_PASS);
              if (!saved) {
                setFileLine("This phone has not saved a passphrase yet. Type it once. After that, biometrics can stand in.");
                return;
              }
              try {
                const file = await decryptBackup(pendingEnc.env, saved);
                openPicked(file.data, describeContents(file.data));
              } catch {
                setFileLine("The saved passphrase did not open this file.");
              }
            }} />
          </View>
        ) : null}
        <View style={{ marginTop: 20, gap: 10 }}>
          {picked ? <Button label="Use this file" testID="onboarding-file-confirm" onPress={applyFile} /> : null}
          <Button label="Start fresh" testID="onboarding-start-fresh" onPress={() => setGate("fresh")} />
          <Button kind="secondary" label="Bring in a file" testID="onboarding-bring-file" onPress={bringFile} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }}>
      <View style={[styles.progress, { paddingHorizontal: sp.lg }]}>
        {Array.from({ length: STEPS }).map((_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.onSurface : colors.surfaceTertiary }} />
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Animated.View key={step} entering={FadeInRight.duration(220)}>
          {step === 0 && (
            <View testID="onboarding-welcome">
              <Mark size={96} family={mark.family} variant={mark.variant} />
              <Eyebrow style={{ marginTop: 24 }}>Local-first personal platform</Eyebrow>
              <T v="title" style={{ fontSize: 34, marginTop: 6 }}>
                Nucleus
              </T>
              <T muted style={{ marginTop: 8, fontSize: 16, lineHeight: 23 }}>
                Your private all-in-one: vehicles, money, travel, home and tools. Modules that talk to each other, rules that explain themselves.
              </T>
              <View style={{ marginTop: 24, gap: 14 }}>
                {[
                  ["wifi-off", "Works fully offline", "No account, no cloud. Optional Online mode is off by default."],
                  ["shield-lock-outline", "Your data stays here", "Stored only on this device. You decide what leaves."],
                  ["lightbulb-on-outline", "Smart, not AI", "Insights come from plain rules and your own history — always with a “Why?”."],
                ].map(([i, t, b]) => (
                  <View key={t} style={{ flexDirection: "row", gap: 12 }}>
                    <View style={[styles.ico, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                      <Icon name={i} size={20} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="label">{t}</T>
                      <T muted>{b}</T>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {step === 1 && (
            <View testID="onboarding-defaults">
              <Eyebrow>Step 1 · Defaults</Eyebrow>
              <T v="title" style={{ marginTop: 6, marginBottom: 20 }}>
                How do you measure things?
              </T>
              <T v="label" style={{ marginBottom: 4 }}>Theme</T>
              <View style={{ marginHorizontal: -16 }}>
                <ChipRow testID="onboarding-theme-row">
                  {Object.entries(THEMES).map(([k, t]) => (
                    <Chip key={k} label={t.name} selected={s.theme === k} onPress={() => setSettings({ theme: k as any })} testID={`onboarding-theme-${k}`} />
                  ))}
                </ChipRow>
              </View>
              <T v="label" style={{ marginBottom: 4 }}>
                Currency
              </T>
              <View style={{ marginHorizontal: -16 }}>
                <ChipRow testID="onboarding-currency-row">
                  {CURRENCIES.map((c) => (
                    <Chip key={c} label={c} selected={s.currency === c} onPress={() => setSettings({ currency: c })} testID={`onboarding-currency-${c}`} />
                  ))}
                </ChipRow>
              </View>
              {[
                { l: "Distance", k: "distanceUnit", o: [{ value: "km", label: "Kilometres" }, { value: "mi", label: "Miles" }] },
                { l: "Fuel volume", k: "volumeUnit", o: [{ value: "L", label: "Litres" }, { value: "gal", label: "Gallons" }] },
                { l: "Temperature", k: "tempUnit", o: [{ value: "C", label: "°C" }, { value: "F", label: "°F" }] },
                { l: "Time format", k: "timeFormat", o: [{ value: "12h", label: "12-hour" }, { value: "24h", label: "24-hour" }] },
              ].map((row) => (
                <View key={row.k} style={{ marginTop: 14 }}>
                  <T v="label" style={{ marginBottom: 8 }}>
                    {row.l}
                  </T>
                  <Segmented testID={`onboarding-${row.k}`} options={row.o as any} value={(s as any)[row.k]} onChange={(v) => setSettings({ [row.k]: v } as any)} />
                </View>
              ))}
            </View>
          )}

          {step === 2 && (
            <View testID="onboarding-modules">
              <Eyebrow>Step 2 · Modules</Eyebrow>
              <T v="title" style={{ marginTop: 6, marginBottom: 6 }}>
                Pick your tiles
              </T>
              <T muted style={{ marginBottom: 16 }}>
                Turned-off modules use no resources and vanish from Today, search and Attention. Change anytime.
              </T>
              {MODULES.filter((m) => m.status === "available").map((m) => {
                const on = s.modules.find((x) => x.id === m.id)?.enabled;
                return (
                  <View key={m.id} style={[styles.modRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <Icon name={m.icon} size={24} />
                    <View style={{ flex: 1 }}>
                      <T v="label">{m.name}</T>
                      <T muted style={{ fontSize: 13 }}>
                        {m.description}
                      </T>
                    </View>
                    <Switch testID={`onboarding-module-${m.id}`} value={!!on} onValueChange={(v) => setSettings({ modules: s.modules.map((x) => (x.id === m.id ? { ...x, enabled: v } : x)) })} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.surfaceSecondary} />
                  </View>
                );
              })}
            </View>
          )}

          {step === 3 && (
            <View testID="onboarding-security">
              <Eyebrow>Step 3 · Lock</Eyebrow>
              <T v="title" style={{ marginTop: 6, marginBottom: 6 }}>
                Protect your workbench
              </T>
              <T muted style={{ marginBottom: 12 }}>
                A 4-digit PIN locks the whole app. There is no recovery server — if you forget it, you can only erase and restore from a backup.
              </T>
              <Field label="What should I call you?" testID="onboarding-name" value={s.givenName ?? ""} onChangeText={(v) => setSettings({ givenName: cleanCallName(v) || undefined })} placeholder="Harsha" autoCapitalize="words" hint="Optional. Today will say good afternoon with this name." />
              {pinStage === "off" && (
                <View style={{ gap: 10 }}>
                  <Button label="Set a PIN" icon="lock-outline" testID="onboarding-set-pin-button" onPress={() => setPinStage("enter")} />
                </View>
              )}
              {(pinStage === "enter" || pinStage === "confirm" || pinStage === "decoy" || pinStage === "decoyConfirm") && (
                <View style={{ alignItems: "center" }}>
                  <T v="h2" style={{ marginBottom: 16 }}>
                    {pinStage === "enter" ? "Choose a PIN" : pinStage === "confirm" ? "Confirm your PIN" : pinStage === "decoy" ? "Choose a decoy PIN" : "Confirm the decoy PIN"}
                  </T>
                  <PinPad
                    testID="onboarding-pin"
                    resetKey={pinKey}
                    error={pinErr}
                    onComplete={async (p) => {
                      if (pinStage === "enter") {
                        setFirstPin(p);
                        setPinStage("confirm");
                        setPinErr(undefined);
                        setPinKey((k) => k + 1);
                      } else if (pinStage === "confirm") {
                        if (p !== firstPin) {
                          setPinErr("PINs didn't match — try again");
                          setPinStage("enter");
                          setPinKey((k) => k + 1);
                          return;
                        }
                        await setPin(p);
                        const bio = await biometricAvailable();
                        setSettings({ lockEnabled: true, ...unlockSettingsForNewLock(bio) });
                        setBioOk(bio);
                        setPinStage("done");
                      } else if (pinStage === "decoy") {
                        if ((await verifyPin(p)) === "primary") {
                          setPinErr("That is your real PIN. Choose another.");
                          setPinKey((k) => k + 1);
                          return;
                        }
                        setDecoyFirst(p);
                        setPinErr(undefined);
                        setPinStage("decoyConfirm");
                        setPinKey((k) => k + 1);
                      } else if (p === decoyFirst) {
                        await setDecoyPin(p);
                        await prepareDecoy();
                        setPinStage("done");
                      } else {
                        setPinErr("PINs didn't match — try again");
                        setPinStage("decoy");
                        setPinKey((k) => k + 1);
                      }
                    }}
                  />
                </View>
              )}
              {pinStage === "done" && (
                <View style={[styles.modRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="onboarding-pin-done">
                  <Icon name="check-circle-outline" size={24} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <T v="label">PIN set</T>
                    <T muted style={{ fontSize: 13 }}>
                      {bioOk ? "Also unlock with fingerprint / face?" : Platform.OS === "web" ? "Biometrics are available in the installed app." : "No enrolled biometrics found on this device."}
                    </T>
                  </View>
                  {bioOk ? (
                    <Switch
                      testID="onboarding-biometric-switch"
                      value={s.biometricEnabled}
                      onValueChange={(v) => setSettings({ biometricEnabled: v, unlockMethod: v ? "both" : "pin" })}
                      trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
                      thumbColor={colors.surfaceSecondary}
                    />
                  ) : null}
                </View>
              )}
              {pinStage === "done" ? (
                <View style={{ marginTop: 12 }}>
                  <Button kind="ghost" label="Add a decoy PIN" icon="shield-lock-outline" testID="onboarding-decoy-button" onPress={() => (setPinErr(undefined), setPinStage("decoy"))} />
                  <T muted style={{ fontSize: 12, marginTop: 6 }}>A second PIN opens sample data. The screen looks the same, and it only works on the lock screen.</T>
                </View>
              ) : null}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={{ paddingHorizontal: sp.lg, gap: 10 }}>
        {step < 3 ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {step > 0 ? <Button kind="ghost" label="Back" testID="onboarding-back-button" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
            <Button label={step === 0 ? "Get started" : "Continue"} icon="arrow-right" testID="onboarding-next-button" onPress={() => setStep(step + 1)} style={{ flex: 2 }} />
          </View>
        ) : (
          <>
            <Button label="Explore with sample data" icon="flask-outline" testID="onboarding-finish-sample-button" onPress={() => finish(true)} disabled={pinStage === "enter" || pinStage === "confirm" || pinStage === "decoy" || pinStage === "decoyConfirm"} />
            <Button kind="ghost" label={pinStage === "done" ? "Start with an empty workbench" : "Skip PIN · start empty"} testID="onboarding-finish-empty-button" onPress={() => finish(false)} disabled={pinStage === "enter" || pinStage === "confirm" || pinStage === "decoy" || pinStage === "decoyConfirm"} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  progress: { flexDirection: "row", gap: 6, marginBottom: 4 },
  ico: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  modRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1, marginBottom: 10 },
}));
