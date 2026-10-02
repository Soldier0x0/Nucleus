import React, { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import type { ModuleId } from "@/src/core/types";
import { biometricUnlock, verifyPin } from "@/src/core/security";
import { PinPad } from "./PinPad";
import { Button, Eyebrow, Icon, T } from "./ui";

/** Opaque cover shown over a module screen when that module has its own lock. */
export function ModuleGate({ id, name, icon = "lock-outline" }: { id: ModuleId; name: string; icon?: string }) {
  const { db } = useStore();
  const s = db.settings;
  const required = s.lockEnabled && (s.moduleLocks ?? []).includes(id);
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(!required);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const bio = s.unlockMethod !== "pin" && s.biometricEnabled && Platform.OS !== "web";

  const tryBio = useCallback(async () => {
    if (await biometricUnlock()) setOpen(true);
  }, []);

  useEffect(() => {
    if (!required) setOpen(true);
  }, [required]);

  useEffect(() => {
    if (!open && bio) tryBio();
  }, [open, bio, tryBio]);

  if (open) return null;

  return (
    <View testID={`module-gate-${id}`} style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, paddingTop: insets.top + 40, paddingHorizontal: sp.lg, alignItems: "center" }]}>
      <View style={[styles.mark, { backgroundColor: colors.brandTertiary }]}>
        <Icon name={icon} size={26} color={colors.onBrandTertiary} />
      </View>
      <Eyebrow style={{ marginTop: 14 }}>{name} is locked</Eyebrow>
      <T v="title" style={{ marginTop: 6, marginBottom: 24 }}>
        Enter your PIN
      </T>
      <PinPad
        testID={`module-gate-${id}-pin`}
        resetKey={attempt}
        error={error}
        onBiometric={bio ? tryBio : undefined}
        onComplete={async (pin) => {
          if ((await verifyPin(pin)) === "primary") setOpen(true);
          else {
            setError("Incorrect PIN");
            setAttempt((a) => a + 1);
          }
        }}
      />
      <View style={{ flex: 1 }} />
      <Button kind="ghost" small label="Go back" icon="arrow-left" testID={`module-gate-${id}-back`} onPress={() => router.back()} style={{ marginBottom: insets.bottom + 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
