import React, { useEffect, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { fonts, radius, useTheme, bindLookStyles } from "@/src/theme";
import { Icon, Press } from "./ui";

/** Numeric PIN pad with dot display. Calls onComplete when `length` digits are entered. */
export function PinPad({ length = 4, onComplete, error, onBiometric, testID = "pin-pad", resetKey }: { length?: number; onComplete: (pin: string) => void; error?: string; onBiometric?: () => void; testID?: string; resetKey?: number }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const key = Math.min(92, Math.floor((Math.min(width, 420) - 72) / 3));
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

  const pressDigit = (d: string) => {
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
          <View key={i} style={[styles.dot, { borderColor: colors.brandPrimary, backgroundColor: i < pin.length ? colors.brandPrimary : "transparent" }]} />
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
      <View style={[styles.grid, { width: key * 3 + 28 }]}>
        {keys.map((k, i) =>
          k === "" ? (
            <View key={i} style={{ width: key, height: Math.round(key * 0.78) }} />
          ) : (
            <Press
              key={i}
              testID={`${testID}-key-${k}`}
              onPress={() => (k === "del" ? setPin((p) => p.slice(0, -1)) : k === "bio" ? onBiometric?.() : pressDigit(k))}
              style={[styles.key, { width: key, height: Math.round(key * 0.78), backgroundColor: k === "del" || k === "bio" ? "transparent" : colors.surfaceSecondary, borderColor: k === "bio" ? colors.brandPrimary : colors.border, borderWidth: k === "del" ? 0 : 1 }]}
              accessibilityLabel={k === "del" ? "Delete" : k === "bio" ? "Use biometrics" : k}
            >
              {k === "del" ? <Icon name="backspace-outline" size={26} /> : k === "bio" ? <Icon name="fingerprint" size={30} color={colors.brandPrimary} /> : <Text style={{ fontFamily: fonts.monoMedium, fontSize: 28, color: colors.onSurface }}>{k}</Text>}
            </Press>
          ),
        )}
      </View>
    </View>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  dots: { flexDirection: "row", gap: 16, marginBottom: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14, justifyContent: "center" },
  key: { borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
}));
