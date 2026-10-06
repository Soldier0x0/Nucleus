import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Magnetometer } from "expo-sensors";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Line } from "react-native-svg";
import { headingTurn } from "@/src/core/compass";
import { useTheme } from "@/src/theme";
import { Card, Eyebrow, T } from "./ui";
import { useHeading } from "./useHeading";

const DIAL = ["N", "E", "S", "W"] as const;

export function HeadingRose({ degrees, size, marks }: { degrees: number | null; size: number; marks: boolean }) {
  const { colors, a11y } = useTheme();
  const angle = useSharedValue(degrees ?? 0);
  const shown = useRef<number | null>(degrees);
  useEffect(() => {
    if (degrees == null) return;
    if (shown.current == null) {
      shown.current = degrees;
      angle.set(degrees);
      return;
    }
    const next = headingTurn(shown.current, degrees);
    shown.current = next;
    if (a11y.reducedMotion) angle.set(next);
    else angle.set(withTiming(next, { duration: 280, easing: Easing.out(Easing.cubic) }));
  }, [a11y.reducedMotion, angle, degrees]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-angle.value}deg` }],
  }));
  const center = size / 2;
  const ticks = marks ? 24 : 8;
  const live = degrees != null;

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden>
      <Animated.View collapsable={false} style={[{ width: size, height: size, opacity: live ? 1 : 0.4 }, spin]}>
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={center - 2} stroke={colors.border} strokeWidth={1} fill={colors.surfaceTertiary} />
          {Array.from({ length: ticks }, (_, index) => {
            const rad = (index * (360 / ticks) * Math.PI) / 180;
            const major = index === 0 || (marks && index % 6 === 0);
            const outer = center - 5;
            const inner = major ? center - (marks ? 16 : 12) : center - 9;
            const x = (radius: number) => center + Math.sin(rad) * radius;
            const y = (radius: number) => center - Math.cos(rad) * radius;
            return (
              <Line
                key={index}
                x1={x(inner)}
                y1={y(inner)}
                x2={x(outer)}
                y2={y(outer)}
                stroke={index === 0 ? colors.brandPrimary : colors.borderStrong}
                strokeWidth={major ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}
          <Circle cx={center} cy={center} r={marks ? 4 : 2.5} fill={colors.brandPrimary} />
        </Svg>
      </Animated.View>
      {marks && live
        ? DIAL.map((label, index) => (
            <DialLetter key={label} label={label} at={index * 90} size={size} angle={angle} color={label === "N" ? colors.brandPrimary : colors.muted} />
          ))
        : null}
      <View pointerEvents="none" style={[styles.forward, { left: center - 1.5, backgroundColor: colors.brandPrimary, height: marks ? 14 : 8 }]} />
    </View>
  );
}

function DialLetter({ label, at, size, angle, color }: { label: string; at: number; size: number; angle: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const rad = ((at - angle.value) * Math.PI) / 180;
    const radius = size * 0.28;
    return {
      transform: [{ translateX: size / 2 + Math.sin(rad) * radius - 14 }, { translateY: size / 2 - Math.cos(rad) * radius - 10 }],
    };
  });
  return (
    <Animated.View style={[styles.letter, style]}>
      <T v="mono" style={{ textAlign: "center", color }}>{label}</T>
    </Animated.View>
  );
}

/** Short Travel tile: the direction the top of the phone faces. */
export function HeadingTile({ testID = "heading-tile" }: { testID?: string }) {
  const { heading, available } = useHeading(Magnetometer);
  const figure = heading?.cardinal ?? "—";
  const line = heading ? `${heading.degrees}°` : available === false ? "No magnetometer" : "Hold it flat";
  return (
    <Card testID={testID}>
      <Eyebrow>Heading</Eyebrow>
      <View style={styles.row}>
        <HeadingRose degrees={heading?.degrees ?? null} size={56} marks={false} />
        <View style={{ flex: 1 }}>
          <T v="monoXl">{figure}</T>
          <T muted numberOfLines={2}>{line}</T>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  forward: { position: "absolute", top: 0, width: 3, borderRadius: 2 },
  letter: { position: "absolute", top: 0, left: 0, width: 28 },
});
