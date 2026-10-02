import React from "react";
import { Pressable, PressableProps, ScrollView, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { fonts, radius, type, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { money } from "@/src/core/format";

const APressable = Animated.createAnimatedComponent(Pressable);

export type IconName = React.ComponentProps<typeof MaterialDesignIcons>["name"];

export function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <MaterialDesignIcons name={name as IconName} size={size} color={color ?? colors.onSurface} />;
}

type Variant = "display" | "title" | "h2" | "body" | "label" | "caption" | "mono" | "monoLg" | "monoXl";

const variantStyle: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.monoBold, fontSize: type["3xl"], letterSpacing: -0.5 },
  title: { fontFamily: fonts.textBold, fontSize: type["2xl"], letterSpacing: -0.3 },
  h2: { fontFamily: fonts.textSemi, fontSize: type.lg },
  body: { fontFamily: fonts.text, fontSize: type.base, lineHeight: 20 },
  label: { fontFamily: fonts.textMedium, fontSize: type.base },
  caption: { fontFamily: fonts.textMedium, fontSize: type.sm, letterSpacing: 0.2 },
  mono: { fontFamily: fonts.monoMedium, fontSize: type.base },
  monoLg: { fontFamily: fonts.monoBold, fontSize: type.xl },
  monoXl: { fontFamily: fonts.monoBold, fontSize: type["2xl"], letterSpacing: -0.5 },
};

export function T({ v = "body", muted, color, style, ...rest }: TextProps & { v?: Variant; muted?: boolean; color?: string }) {
  const { colors } = useTheme();
  return <Text {...rest} style={[variantStyle[v], { color: color ?? (muted ? colors.muted : colors.onSurface) }, style]} />;
}

/** Uppercase mono eyebrow label, the "instrument" voice of the UI. */
export function Eyebrow({ children, style, testID, numberOfLines = 1 }: { children: React.ReactNode; style?: StyleProp<TextStyle>; testID?: string; numberOfLines?: number }) {
  const { colors } = useTheme();
  return (
    <Text testID={testID} numberOfLines={numberOfLines} style={[{ fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.2, color: colors.muted, textTransform: "uppercase" }, style]}>
      {children}
    </Text>
  );
}

export function Press({ style, onPress, haptic = true, children, disabled, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; haptic?: boolean; children?: React.ReactNode }) {
  const { a11y } = useTheme();
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      disabled={disabled}
      onPressIn={() => !a11y.reducedMotion && s.set(withTiming(0.97, { duration: 90 }))}
      onPressOut={() => !a11y.reducedMotion && s.set(withTiming(1, { duration: 140 }))}
      onPress={(e: any) => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={[style, a, disabled && { opacity: 0.45 }]}
    >
      {children}
    </APressable>
  );
}

export function Card({ children, style, testID, onPress, tone = "default" }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string; onPress?: () => void; tone?: "default" | "tint" | "inverse" }) {
  const { colors, sp } = useTheme();
  const bg = tone === "tint" ? colors.brandTertiary : tone === "inverse" ? colors.surfaceInverse : colors.surfaceSecondary;
  const base: ViewStyle = { backgroundColor: bg, borderRadius: radius.lg, borderWidth: 1, borderColor: tone === "default" ? colors.border : "transparent", padding: sp.lg };
  if (onPress)
    return (
      <Press testID={testID} onPress={onPress} style={[base, style]}>
        {children}
      </Press>
    );
  return (
    <View testID={testID} style={[base, style]}>
      {children}
    </View>
  );
}

export function Button({ label, icon, onPress, kind = "primary", testID, style, disabled, small }: { label: string; icon?: string; onPress?: () => void; kind?: "primary" | "secondary" | "ghost" | "danger"; testID?: string; style?: StyleProp<ViewStyle>; disabled?: boolean; small?: boolean }) {
  const { colors, touch } = useTheme();
  const bg = kind === "primary" ? colors.surfaceInverse : kind === "danger" ? colors.error : kind === "secondary" ? colors.surfaceTertiary : "transparent";
  const fg = kind === "primary" ? colors.onSurfaceInverse : kind === "danger" ? colors.onError : colors.onSurface;
  return (
    <Press testID={testID} onPress={onPress} disabled={disabled} style={[styles.btn, { backgroundColor: bg, minHeight: Math.round((small ? 40 : 50) * touch), paddingHorizontal: small ? 14 : 20 }, kind === "ghost" && { borderWidth: 1, borderColor: colors.borderStrong }, style]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.textSemi, fontSize: small ? 13 : 15, color: fg }}>{label}</Text>
    </Press>
  );
}

export function IconButton({ icon, onPress, testID, label, filled }: { icon: string; onPress?: () => void; testID?: string; label?: string; filled?: boolean }) {
  const { colors, touch } = useTheme();
  const size = Math.round(44 * touch);
  return (
    <Press testID={testID} onPress={onPress} accessibilityLabel={label} style={[styles.iconBtn, { width: size, height: size, backgroundColor: filled ? colors.surfaceTertiary : "transparent" }]}>
      <Icon name={icon} size={22} />
    </Press>
  );
}

export function Chip({ label, selected, onPress, icon, testID }: { label: string; selected?: boolean; onPress?: () => void; icon?: string; testID?: string }) {
  const { colors, touch } = useTheme();
  return (
    <Press
      testID={testID}
      onPress={onPress}
      accessibilityState={{ selected }}
      style={[styles.chip, { height: Math.round(36 * touch), backgroundColor: selected ? colors.surfaceInverse : colors.surfaceSecondary, borderColor: selected ? colors.surfaceInverse : colors.borderStrong }]}
    >
      {icon ? <Icon name={icon} size={15} color={selected ? colors.onSurfaceInverse : colors.onSurface} /> : null}
      <Text numberOfLines={1} style={{ fontFamily: fonts.textMedium, fontSize: 13, color: selected ? colors.onSurfaceInverse : colors.onSurface }}>
        {label}
      </Text>
    </Press>
  );
}

/** Horizontal, never-wrapping chip row (fixed 56pt). */
export function ChipRow({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return (
    <ScrollView testID={testID} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: 56 }} contentContainerStyle={{ gap: 8, alignItems: "center", paddingHorizontal: 16 }}>
      {children}
    </ScrollView>
  );
}

export function Segmented<T extends string>({ options, value, onChange, testID }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.seg, { backgroundColor: colors.surfaceTertiary }]}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable key={o.value} testID={`${testID}-${o.value}`} onPress={() => onChange(o.value)} accessibilityState={{ selected: sel }} style={[styles.segItem, sel && { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong, borderWidth: 1 }]}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.textSemi, fontSize: 13, color: sel ? colors.onSurface : colors.muted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.divider }, style]} />;
}

/** Privacy-aware amount: masked when privacy mode is on. */
export function Amount({ value, v = "mono", style, testID, signed, color, decimals }: { value: number; v?: Variant; style?: StyleProp<TextStyle>; testID?: string; signed?: boolean; color?: string; decimals?: boolean }) {
  const { db } = useStore();
  const [reveal, setReveal] = React.useState(false);
  const masked = db.settings.privacyMode && !reveal;
  const txt = masked ? "•••••" : `${signed && value > 0 ? "+" : ""}${money(value, db.settings.currency, { decimals })}`;
  return (
    <T testID={testID} v={v} color={color} style={style} onPress={db.settings.privacyMode ? () => setReveal((r) => !r) : undefined} accessibilityLabel={masked ? "Hidden amount, tap to reveal" : txt}>
      {txt}
    </T>
  );
}

export function StatusBadge({ severity }: { severity: "urgent" | "upcoming" | "info" | "ok" }) {
  const { colors } = useTheme();
  const map = {
    urgent: { icon: "alert-octagon", label: "URGENT", c: colors.error },
    upcoming: { icon: "clock-alert-outline", label: "UPCOMING", c: colors.warning },
    info: { icon: "information-outline", label: "INFO", c: colors.info },
    ok: { icon: "check-circle-outline", label: "OK", c: colors.success },
  }[severity];
  return (
    <View style={[styles.badge, { borderColor: map.c }]}>
      <Icon name={map.icon} size={13} color={map.c} />
      <Text style={{ fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 0.8, color: map.c }}>{map.label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action, testID }: { icon: string; title: string; body: string; action?: React.ReactNode; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.empty, { borderColor: colors.borderStrong }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.brandTertiary }]}>
        <Icon name={icon} size={28} color={colors.onBrandTertiary} />
      </View>
      <T v="h2" style={{ marginTop: 12 }}>
        {title}
      </T>
      <T muted style={{ marginTop: 4, marginBottom: action ? 16 : 0 }}>
        {body}
      </T>
      {action}
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.md },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  chip: { height: 36, flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  seg: { flexDirection: "row", borderRadius: radius.md, padding: 3, gap: 3 },
  segItem: { flex: 1, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1, borderColor: "transparent" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: radius.lg, padding: 24, alignItems: "flex-start" },
  emptyIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
