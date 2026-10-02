import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInRight } from "react-native-reanimated";
import { radius, THEMES, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { CURRENCIES } from "@/src/core/format";
import { MODULES } from "@/src/core/modules";
import { withSampleData } from "@/src/core/sample";
import { biometricAvailable, setPin } from "@/src/core/security";
import { Button, Chip, ChipRow, Eyebrow, Icon, Segmented, T } from "@/src/components/ui";
import { PinPad } from "@/src/components/PinPad";

const STEPS = 4;

export default function Onboarding() {
  const { db, setSettings, update } = useStore();
  const s = db.settings;
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pinStage, setPinStage] = useState<"off" | "enter" | "confirm" | "done">("off");
  const [firstPin, setFirstPin] = useState("");
  const [pinErr, setPinErr] = useState<string>();
  const [pinKey, setPinKey] = useState(0);
  const [bioOk, setBioOk] = useState(false);

  const finish = (sample: boolean) => {
    update((d) => {
      const n = { ...d, settings: { ...d.settings, onboarded: true } };
      return sample ? withSampleData(n) : n;
    });
    router.replace("/(tabs)");
  };

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
              <View style={styles.mosaic}>
                {[colors.brandPrimary, colors.surfaceInverse, colors.surfaceTertiary, colors.brandSecondary, colors.surfaceTertiary, colors.brandPrimary, colors.surfaceInverse, colors.brandTertiary, colors.surfaceTertiary].map((c, i) => (
                  <View key={i} style={[styles.tile, { backgroundColor: c, borderColor: colors.border }]} />
                ))}
              </View>
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
              <T muted style={{ marginBottom: 20 }}>
                A 4-digit PIN locks the whole app. There is no recovery server — if you forget it, you can only erase and restore from a backup.
              </T>
              {pinStage === "off" && (
                <View style={{ gap: 10 }}>
                  <Button label="Set a PIN" icon="lock-outline" testID="onboarding-set-pin-button" onPress={() => setPinStage("enter")} />
                </View>
              )}
              {(pinStage === "enter" || pinStage === "confirm") && (
                <View style={{ alignItems: "center" }}>
                  <T v="h2" style={{ marginBottom: 16 }}>
                    {pinStage === "enter" ? "Choose a PIN" : "Confirm your PIN"}
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
                      } else if (p === firstPin) {
                        await setPin(p);
                        setSettings({ lockEnabled: true });
                        setBioOk(await biometricAvailable());
                        setPinStage("done");
                      } else {
                        setPinErr("PINs didn't match — try again");
                        setPinStage("enter");
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
                  {bioOk ? <Switch testID="onboarding-biometric-switch" value={s.biometricEnabled} onValueChange={(v) => setSettings({ biometricEnabled: v })} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.surfaceSecondary} /> : null}
                </View>
              )}
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
            <Button label="Explore with sample data" icon="flask-outline" testID="onboarding-finish-sample-button" onPress={() => finish(true)} disabled={pinStage === "enter" || pinStage === "confirm"} />
            <Button kind="ghost" label={pinStage === "done" ? "Start with an empty workbench" : "Skip PIN · start empty"} testID="onboarding-finish-empty-button" onPress={() => finish(false)} disabled={pinStage === "enter" || pinStage === "confirm"} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: "row", gap: 6, marginBottom: 4 },
  mosaic: { flexDirection: "row", flexWrap: "wrap", width: 132, gap: 6, marginTop: 12 },
  tile: { width: 40, height: 40, borderRadius: radius.sm, borderWidth: 1 },
  ico: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  modRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1, marginBottom: 10 },
});
