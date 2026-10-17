import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, useColorScheme, View, type AppStateStatus } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenCapture from "expo-screen-capture";
import { useTheme } from "@/src/theme";
import { publishLockState } from "@/src/core/lockSignal";
import { useStore } from "@/src/core/store";
import { biometricUnlock, clearFailures, readBackoff, registerFailure, verifyPin } from "@/src/core/security";
import { PinPad } from "./PinPad";
import { Mark } from "./Mark";
import { NameAsk } from "./NameAsk";
import { resolveLauncher } from "@/src/core/launcher";
import { askAfterLeave } from "@/src/core/lockPolicy";
import { externalActivityActive, pulseExternalActivity } from "@/src/core/externalActivity";
import { readPhoneLock } from "@/src/native/android";
import { Button, Eyebrow, Icon, T } from "./ui";
import { Sheet } from "./Sheet";

/**
 * App-wide lock + privacy cover. Asks on a cold start, and again after phone lock,
 * screen-off, or a background stay past the configured timeout.
 * Renders above the navigator so navigation state is preserved while locked.
 */
export function LockGate() {
  const { db, openReal, openDecoy, wipeDeviceData, setSettings } = useStore();
  const s = db.settings;
  const scheme = useColorScheme();
  const mark = resolveLauncher(s.launcher, s.theme, scheme);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [locked, setLocked] = useState(() => s.onboarded && s.lockEnabled);
  const [covered, setCovered] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [forgot, setForgot] = useState(false);
  const [waitSec, setWaitSec] = useState(0);
  const shot = useRef(false);
  const backgroundAt = useRef<number | null>(null);
  const bioAllowed = s.unlockMethod !== "pin" && s.biometricEnabled && Platform.OS !== "web";

  // Boot screens and the route recorder wait for this before doing anything.
  useEffect(() => {
     publishLockState(locked);
   }, [locked]);

  // Screenshot / recents protection (Android FLAG_SECURE; iOS screen-record blur).
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (s.blockScreenshots) ScreenCapture.preventScreenCaptureAsync("nucleus").catch(() => {});
    else ScreenCapture.allowScreenCaptureAsync("nucleus").catch(() => {});
  }, [s.blockScreenshots]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = ScreenCapture.addScreenshotListener(() => {
      shot.current = true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (st: AppStateStatus) => {
      switch (st) {
        case "active": {
          setCovered(false);
          const phone = readPhoneLock();
          const screenshot = shot.current;
          shot.current = false;
          const backgroundMs = backgroundAt.current != null ? Math.max(0, Date.now() - backgroundAt.current) : 0;
          backgroundAt.current = null;
          if (
            askAfterLeave({
              lockEnabled: s.lockEnabled,
              deviceLocked: phone.deviceLocked,
              screenTurnedOff: phone.screenTurnedOff,
              screenshot,
              backgroundMs,
              lockTimeoutSec: s.lockTimeoutSec ?? 30,
              externalActivity: externalActivityActive(),
            })
          ) {
            setLocked(true);
          }
          return;
        }
        case "background":
          backgroundAt.current = Date.now();
          setCovered(s.blockScreenshots || s.lockEnabled);
          return;
        case "inactive":
        case "unknown":
        case "extension":
          return;
        default: {
          const unreachable: never = st;
          void unreachable;
        }
      }
    });
    return () => sub.remove();
  }, [s.lockEnabled, s.blockScreenshots, s.lockTimeoutSec]);

  const noteUnlock = useCallback(() => {
    setSettings({ cloud: { ...s.cloud, unlockedAt: new Date().toISOString(), askedSinceUnlock: false } });
  }, [setSettings, s.cloud]);

  const tryBio = useCallback(async () => {
    if (AppState.currentState !== "active") return;
    pulseExternalActivity(120_000);
    if (await biometricUnlock()) {
      await openReal();
      await clearFailures();
      noteUnlock();
      setLocked(false);
      setError(undefined);
    }
  }, [openReal, noteUnlock]);

  useEffect(() => {
    if (locked && bioAllowed && AppState.currentState === "active") tryBio();
  }, [locked, bioAllowed, tryBio]);

  // Wrong-PIN back-off countdown (persisted, survives app restarts).
  useEffect(() => {
    if (!locked) return;
    let alive = true;
    const tick = async () => {
      const b = await readBackoff();
      if (alive) setWaitSec(b.until > Date.now() ? Math.ceil((b.until - Date.now()) / 1000) : 0);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [locked, attempt]);

  if (!locked && !covered) return <NameAsk />;

  if (!locked && covered)
    return (
      <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.surface }]}>
        <Icon name="shield-lock-outline" size={40} color={colors.muted} />
      </View>
    );

  return (
    <View testID="lock-screen" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 8, paddingHorizontal: 24 }]}>
      <View style={{ alignItems: "center" }}>
        <Mark size={88} family={mark.family} variant={mark.variant} />
        <Eyebrow style={{ marginTop: 14 }}>Nucleus is locked</Eyebrow>
        <T v="title" style={{ marginTop: 4 }}>
          {waitSec > 0 ? "Too many attempts" : "Enter your PIN"}
        </T>
      </View>
      <View style={{ flex: 1, minHeight: 12 }} />
      {waitSec > 0 ? (
        <View style={{ alignItems: "center", gap: 8 }}>
          <T v="display" testID="lock-backoff-countdown">
            {Math.floor(waitSec / 60)}:{String(waitSec % 60).padStart(2, "0")}
          </T>
          <T muted style={{ textAlign: "center", paddingHorizontal: 32 }}>
            Wait for the timer, then try again. The wait doubles after each wrong PIN.
          </T>
        </View>
      ) : (
        <PinPad
          testID="lock-pin"
          resetKey={attempt}
          error={error}
          onBiometric={bioAllowed ? tryBio : undefined}
          onComplete={async (pin) => {
            const match = await verifyPin(pin);
            if (match === "primary" || match === "decoy") {
              if (match === "decoy") await openDecoy();
              else await openReal();
              await clearFailures();
              noteUnlock();
              setLocked(false);
              setError(undefined);
            } else {
              const b = await registerFailure();
              const left = Math.max(0, 5 - b.fails);
              setError(b.until > Date.now() ? "Locked out" : left > 0 && left <= 2 ? `Incorrect PIN · ${left} left` : "Incorrect PIN");
              setAttempt((a) => a + 1);
            }
          }}
        />
      )}
      <View style={{ alignItems: "center", marginTop: 8 }}>
      <Button kind="ghost" small label="Forgot PIN?" testID="lock-forgot-button" onPress={() => setForgot(true)} />
      </View>
      <Sheet visible={forgot} onClose={() => setForgot(false)} title="Forgot your PIN?" testID="forgot-sheet">
        <T style={{ marginBottom: 16 }}>Nucleus has no account and no recovery server. Erasing removes every profile on this device. You can then restore from a backup file you exported earlier.</T>
        <Button
          kind="danger"
          icon="delete-forever-outline"
          label="Erase all data and start over"
          testID="forgot-erase-button"
          onPress={async () => {
            await wipeDeviceData();
            setForgot(false);
            setLocked(false);
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
