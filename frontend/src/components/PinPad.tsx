import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { fonts, radius, useTheme } from "@/src/theme";
import { Icon, Press } from "./ui";

/** Numeric PIN pad with dot display. Calls onComplete when `length` digits are entered. */
export function PinPad({ length = 4, onComplete, error, onBiometric, testID = "pin-pad", resetKey }: { length?: number; onComplete: (pin: string) => void; error?: string; onBiometric?: () => void; testID?: string; resetKey?: number }) {
  const { colors } = useTheme();
  const [pin, setPin] = useState("");
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  useEffect(() => setPin(""), [resetKey]);
  useEffect(() => {
    if (error) {
      shake.value = withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPin("");
    }
  }, [error, resetKey, shake]);

  const press = (d: string) => {
    if (pin.length >= length) return;
    const next = pin + d;
    if (next.length === length) {
      // Clear immediately so fast typists can start the next entry (e.g. confirm step).
      setPin("");
      onComplete(next);
    } else setPin(next);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", onBiometric ? "bio" : "", "0", "del"];
  return (
    <View testID={testID} style={{ alignItems: "center" }}>
      <Animated.View style={[styles.dots, shakeStyle]} testID={`${testID}-dots`}>
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={[styles.dot, { borderColor: colors.onSurface, backgroundColor: i < pin.length ? colors.onSurface : "transparent" }]} />
        ))}
      </Animated.View>
      <View style={{ height: 22, marginBottom: 8 }}>
        {error ? (
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Icon name="alert-circle-outline" size={16} color={colors.error} />
            <Text testID={`${testID}-error`} style={{ color: colors.error, fontFamily: fonts.textMedium }}>
              {error}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.grid}>
        {keys.map((k, i) =>
          k === "" ? (
            <View key={i} style={styles.key} />
          ) : (
            <Press
              key={i}
              testID={`${testID}-key-${k}`}
              onPress={() => (k === "del" ? setPin((p) => p.slice(0, -1)) : k === "bio" ? onBiometric?.() : press(k))}
              style={[styles.key, { backgroundColor: k === "del" || k === "bio" ? "transparent" : colors.surfaceSecondary, borderColor: colors.border, borderWidth: k === "del" || k === "bio" ? 0 : 1 }]}
              accessibilityLabel={k === "del" ? "Delete" : k === "bio" ? "Use biometrics" : k}
            >
              {k === "del" ? <Icon name="backspace-outline" size={26} /> : k === "bio" ? <Icon name="fingerprint" size={30} /> : <Text style={{ fontFamily: fonts.monoMedium, fontSize: 26, color: colors.onSurface }}>{k}</Text>}
            </Press>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", gap: 18, marginBottom: 12 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", width: 288, gap: 12, justifyContent: "center" },
  key: { width: 84, height: 64, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
});
