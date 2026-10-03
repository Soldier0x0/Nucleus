import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenCapture from "expo-screen-capture";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { biometricUnlock, clearFailures, readBackoff, registerFailure, verifyPin } from "@/src/core/security";
import { PinPad } from "./PinPad";
import { Mark } from "./Mark";
import { Button, Eyebrow, Icon, T } from "./ui";
import { Sheet } from "./Sheet";

/**
 * App-wide lock + privacy cover. Locks on cold start and after `lockTimeoutSec` in background.
 * Renders above the navigator so navigation state is preserved while locked.
 */
export function LockGate() {
  const { db, openReal, openDecoy, wipeDeviceData } = useStore();
  const s = db.settings;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [locked, setLocked] = useState(s.onboarded && s.lockEnabled);
  const [covered, setCovered] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [forgot, setForgot] = useState(false);
  const [waitSec, setWaitSec] = useState(0);
  const bgAt = useRef<number | null>(null);
  const bioAllowed = s.unlockMethod !== "pin" && s.biometricEnabled && Platform.OS !== "web";

  // Screenshot / recents protection (Android FLAG_SECURE; iOS screen-record blur).
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (s.blockScreenshots) ScreenCapture.preventScreenCaptureAsync("nucleus").catch(() => {});
    else ScreenCapture.allowScreenCaptureAsync("nucleus").catch(() => {});
  }, [s.blockScreenshots]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") {
        setCovered(false);
        if (s.lockEnabled && bgAt.current && Date.now() - bgAt.current > s.lockTimeoutSec * 1000) setLocked(true);
        bgAt.current = null;
      } else {
        setCovered(s.blockScreenshots || s.lockEnabled);
        if (!bgAt.current) bgAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [s.lockEnabled, s.lockTimeoutSec, s.blockScreenshots]);

  const tryBio = useCallback(async () => {
    if (await biometricUnlock()) {
      await openReal();
      await clearFailures();
      setLocked(false);
      setError(undefined);
    }
  }, [openReal]);

  useEffect(() => {
    if (locked && bioAllowed) tryBio();
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

  if (!locked && !covered) return null;

  if (!locked && covered)
    return (
      <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.surface }]}>
        <Icon name="shield-lock-outline" size={40} color={colors.muted} />
      </View>
    );

  return (
    <View testID="lock-screen" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 8, paddingHorizontal: 24 }]}>
      <View style={{ alignItems: "center" }}>
        <Mark size={88} />
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
      <EmergencyStrip />
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

function EmergencyStrip() {
  const { db } = useStore();
  const { colors } = useTheme();
  const card = db.settings.emergency;
  if (!card?.showOnLock) return null;
  const plate = (db.vehicles.find((v) => v.id === db.settings.defaultVehicleId) ?? db.vehicles[0])?.plate;
  const bits = [card.bloodGroup.trim(), card.contactName.trim(), card.contactPhone.trim(), plate].filter(Boolean);
  if (!bits.length) return null;
  return (
    <View testID="lock-emergency" style={{ marginTop: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" }}>
      <Eyebrow>Emergency</Eyebrow>
      <T v="label" style={{ marginTop: 4, textAlign: "center" }}>{bits.join(" · ")}</T>
      {card.note.trim() ? <T muted style={{ fontSize: 12, textAlign: "center", marginTop: 2 }}>{card.note.trim()}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
