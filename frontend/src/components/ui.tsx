import React from "react";
import { Platform, Pressable, PressableProps, ScrollView, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { fonts, radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { money } from "@/src/core/format";

const APressable = Animated.createAnimatedComponent(Pressable);

export type IconName = React.ComponentProps<typeof MaterialDesignIcons>["name"];

export function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <MaterialDesignIcons name={name as IconName} size={size} color={color ?? colors.onSurface} />;
}

type Variant = "display" | "title" | "h2" | "body" | "label" | "caption" | "mono" | "monoLg" | "monoXl";

function px(n: number, scale: number) {
  return scale === 1 ? n : Math.round(n * scale);
}

function variantStyle(v: Variant, look: ReturnType<typeof useTheme>["look"]): TextStyle {
  const t = look.type;
  const plain = look.plain;
  const poster = look.choices.pop === "poster" && (v === "display" || v === "title") ? 1.14 : 1;
  const size = (n: number) => (poster === 1 ? n : Math.round(n * poster));
  switch (v) {
    case "display":
      return { fontFamily: plain ? fonts.textBold : fonts.monoBold, fontSize: size(t["3xl"]), letterSpacing: plain ? 0 : -0.5 };
    case "title":
      return { fontFamily: plain ? fonts.textSemi : fonts.textBold, fontSize: size(t["2xl"]), letterSpacing: plain ? 0 : -0.3 };
    case "h2":
      return { fontFamily: plain ? fonts.text : fonts.textSemi, fontSize: t.lg };
    case "body":
      return { fontFamily: fonts.text, fontSize: t.base, lineHeight: px(20, look.typeScale) };
    case "label":
      return { fontFamily: plain ? fonts.text : fonts.textMedium, fontSize: t.base };
    case "caption":
      return { fontFamily: plain ? fonts.text : fonts.textMedium, fontSize: t.sm, letterSpacing: plain ? 0 : 0.2 };
    case "mono":
      return { fontFamily: plain ? fonts.textMedium : fonts.monoMedium, fontSize: t.base };
    case "monoLg":
      return { fontFamily: plain ? fonts.textSemi : fonts.monoBold, fontSize: t.xl };
    case "monoXl":
      return { fontFamily: plain ? fonts.textBold : fonts.monoBold, fontSize: size(t["2xl"]), letterSpacing: plain ? 0 : -0.5 };
    default: {
      const unknown: never = v;
      return unknown;
    }
  }
}

function scaleOverride(style: StyleProp<TextStyle> | undefined, scale: number): TextStyle | null {
  if (scale === 1 || !style) return null;
  const flat = StyleSheet.flatten(style);
  if (!flat) return null;
  const next: TextStyle = {};
  if (typeof flat.fontSize === "number") next.fontSize = Math.round(flat.fontSize * scale);
  if (typeof flat.lineHeight === "number") next.lineHeight = Math.round(flat.lineHeight * scale);
  return next;
}

export function T({ v = "body", muted, color, style, ...rest }: TextProps & { v?: Variant; muted?: boolean; color?: string }) {
  const { colors, look } = useTheme();
  return <Text {...rest} style={[variantStyle(v, look), { color: color ?? (muted ? colors.muted : colors.onSurface) }, style, scaleOverride(style, look.typeScale)]} />;
}

/** Uppercase mono eyebrow label, the "instrument" voice of the UI. */
export function Eyebrow({ children, style, testID, numberOfLines = 1 }: { children: React.ReactNode; style?: StyleProp<TextStyle>; testID?: string; numberOfLines?: number }) {
  const { colors, look } = useTheme();
  const ink = look.choices.pop === "ink";
  const signal = look.choices.pop === "signal";
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: look.plain ? fonts.textMedium : fonts.monoMedium,
          fontSize: px(11, look.typeScale),
          letterSpacing: look.plain ? 0 : 1.2,
          color: signal ? colors.brandPrimary : ink ? colors.onSurface : colors.muted,
          textTransform: look.plain ? "none" : "uppercase",
        },
        style,
      ]}
    >
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

export function Card({ children, style, testID, onPress, onLongPress, tone = "default" }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string; onPress?: () => void; onLongPress?: () => void; tone?: "default" | "tint" | "inverse" }) {
  const { colors, sp, look, mode, layout } = useTheme();
  const bg = tone === "tint" ? colors.brandTertiary : tone === "inverse" ? colors.surfaceInverse : colors.surfaceSecondary;
  const pop = look.choices.pop;
  const frost = layout.frost && tone === "default";
  const shadow: ViewStyle =
    look.choices.cards === "shadow"
      ? {
          shadowColor: "#000000",
          shadowOpacity: mode === "dark" ? 0.45 : 0.12,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }
      : {};
  const base: ViewStyle = {
    backgroundColor: frost ? "transparent" : bg,
    borderRadius: look.radius.lg,
    borderWidth: 1,
    borderColor: tone === "default" ? colors.border : "transparent",
    padding: layout.bento ? sp.xl : sp.lg,
    overflow: frost ? "hidden" : undefined,
    ...shadow,
    ...(pop === "ink" ? { borderWidth: 2, borderColor: colors.onSurface } : {}),
    ...(pop === "signal" ? { borderLeftWidth: 4, borderLeftColor: colors.brandPrimary } : {}),
    ...(pop === "poster" ? { borderTopWidth: 4, borderTopColor: colors.brandPrimary } : {}),
  };
  const body = (
    <>
      {frost ? (
        <>
          {Platform.OS === "web" ? null : <BlurView intensity={28} tint={mode === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: bg, opacity: 0.72 }]} />
        </>
      ) : null}
      {children}
    </>
  );
  if (onPress || onLongPress)
    return (
      <Press testID={testID} onPress={onPress} onLongPress={onLongPress} delayLongPress={320} style={[base, style]}>
        {body}
      </Press>
    );
  return (
    <View testID={testID} style={[base, style]}>
      {body}
    </View>
  );
}

export function Button({ label, icon, onPress, kind = "primary", testID, style, disabled, small }: { label: string; icon?: string; onPress?: () => void; kind?: "primary" | "secondary" | "ghost" | "danger"; testID?: string; style?: StyleProp<ViewStyle>; disabled?: boolean; small?: boolean }) {
  const { colors, touch, look } = useTheme();
  const signal = look.choices.pop === "signal" && kind === "primary";
  const bg = signal ? colors.brandPrimary : kind === "primary" ? colors.surfaceInverse : kind === "danger" ? colors.error : kind === "secondary" ? colors.surfaceTertiary : "transparent";
  const fg = signal ? colors.onBrandPrimary : kind === "primary" ? colors.onSurfaceInverse : kind === "danger" ? colors.onError : colors.onSurface;
  const grow = Math.max(look.space, look.typeScale);
  return (
    <Press testID={testID} onPress={onPress} disabled={disabled} style={[styles.btn, { backgroundColor: bg, borderRadius: radius.md, minHeight: Math.round((small ? 40 : 50) * touch * (grow === 1 ? 1 : grow)), paddingHorizontal: small ? 14 : 20 }, kind === "ghost" && { borderWidth: 1, borderColor: colors.borderStrong }, style]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={{ fontFamily: look.plain ? fonts.text : fonts.textSemi, fontSize: px(small ? 13 : 15, look.typeScale), color: fg }}>{label}</Text>
    </Press>
  );
}

export function IconButton({ icon, onPress, testID, label, filled }: { icon: string; onPress?: () => void; testID?: string; label?: string; filled?: boolean }) {
  const { colors, touch } = useTheme();
  const size = Math.round(44 * touch);
  return (
    <Press testID={testID} onPress={onPress} accessibilityLabel={label} style={[styles.iconBtn, { width: size, height: size, borderRadius: radius.md, backgroundColor: filled ? colors.surfaceTertiary : "transparent" }]}>
      <Icon name={icon} size={22} />
    </Press>
  );
}

export function Chip({ label, selected, onPress, icon, testID }: { label: string; selected?: boolean; onPress?: () => void; icon?: string; testID?: string }) {
  const { colors, touch, look } = useTheme();
  const signal = look.choices.pop === "signal" && selected;
  const bg = signal ? colors.brandPrimary : selected ? colors.surfaceInverse : colors.surfaceSecondary;
  const fg = signal ? colors.onBrandPrimary : selected ? colors.onSurfaceInverse : colors.onSurface;
  const edge = signal ? colors.brandPrimary : selected ? colors.surfaceInverse : colors.borderStrong;
  return (
    <Press
      testID={testID}
      onPress={onPress}
      accessibilityState={{ selected }}
      style={[styles.chip, { height: Math.round(36 * touch * (look.space === 1 ? 1 : look.space)), borderRadius: radius.pill, backgroundColor: bg, borderColor: edge }]}
    >
      {icon ? <Icon name={icon} size={15} color={fg} /> : null}
      <Text numberOfLines={1} style={{ fontFamily: look.plain ? fonts.text : fonts.textMedium, fontSize: px(13, look.typeScale), color: fg }}>
        {label}
      </Text>
    </Press>
  );
}

/** Horizontal, never-wrapping chip row (fixed 56pt). */
export function ChipRow({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { look } = useTheme();
  const chip = Math.round(36 * (look.space === 1 ? 1 : look.space));
  return (
    <ScrollView testID={testID} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: chip + 20 }} contentContainerStyle={{ gap: px(8, look.space), alignItems: "center", paddingHorizontal: 16 }}>
      {children}
    </ScrollView>
  );
}

export function Segmented<T extends string>({ options, value, onChange, testID }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  const { colors, look } = useTheme();
  return (
    <View testID={testID} style={[styles.seg, { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md }]}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable key={o.value} testID={`${testID}-${o.value}`} onPress={() => onChange(o.value)} accessibilityState={{ selected: sel }} style={[styles.segItem, { borderRadius: radius.sm }, sel && { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong, borderWidth: 1 }]}>
            <Text numberOfLines={1} style={{ fontFamily: look.plain ? fonts.text : fonts.textSemi, fontSize: px(13, look.typeScale), color: sel ? colors.onSurface : colors.muted }}>
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
  const { colors, look } = useTheme();
  const map = {
    urgent: { icon: "alert-octagon", label: "URGENT", c: colors.error },
    upcoming: { icon: "clock-alert-outline", label: "UPCOMING", c: colors.warning },
    info: { icon: "information-outline", label: "INFO", c: colors.info },
    ok: { icon: "check-circle-outline", label: "OK", c: colors.success },
  }[severity];
  return (
    <View style={[styles.badge, { borderColor: map.c, borderRadius: radius.sm }]}>
      <Icon name={map.icon} size={13} color={map.c} />
      <Text style={{ fontFamily: look.plain ? fonts.textMedium : fonts.monoBold, fontSize: px(10, look.typeScale), letterSpacing: look.plain ? 0 : 0.8, color: map.c }}>{map.label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action, testID }: { icon: string; title: string; body: string; action?: React.ReactNode; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.empty, { borderColor: colors.borderStrong, borderRadius: radius.lg }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.brandTertiary, borderRadius: radius.md }]}>
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
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  chip: { height: 36, flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderWidth: 1 },
  seg: { flexDirection: "row", padding: 3, gap: 3 },
  segItem: { flex: 1, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" },
  empty: { borderWidth: 1, borderStyle: "dashed", padding: 24, alignItems: "flex-start" },
  emptyIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
});
