import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { bindLookStyles, radius, useTheme } from "@/src/theme";
import { Header } from "@/src/components/Header";
import { Eyebrow, Icon, Press, T } from "@/src/components/ui";

type AnchorRegister = (key: string, y: number) => void;
const AnchorContext = createContext<AnchorRegister>(() => {});

/** Shared scroll shell for the Settings child screens. `anchor` jumps to a registered section. */
export function SettingsScreen({ title, testID, anchor, children }: { title: string; testID: string; anchor?: string; children: React.ReactNode }) {
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const jump = useCallback((y: number) => ref.current?.scrollTo({ y: Math.max(0, y - 12), animated: false }), []);
  const register = useCallback<AnchorRegister>(
    (key, y) => {
      offsets.current[key] = y;
      if (key === anchor) jump(y);
    },
    [anchor, jump],
  );
  useFocusEffect(
    useCallback(() => {
      const y = anchor ? offsets.current[anchor] : undefined;
      if (typeof y === "number") jump(y);
    }, [anchor, jump]),
  );
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={title} />
      <ScrollView ref={ref} contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <AnchorContext.Provider value={register}>{children}</AnchorContext.Provider>
      </ScrollView>
    </View>
  );
}

/** The `?anchor=` param a search result passes, when it points at this screen. */
export function useSettingsAnchor(): string | undefined {
  const params = useLocalSearchParams<{ anchor?: string }>();
  return typeof params.anchor === "string" && params.anchor ? params.anchor : undefined;
}

export function Section({ title, children, testID, anchor, onLayout }: { title: string; children: React.ReactNode; testID?: string; anchor?: string; onLayout?: (y: number) => void }) {
  const { colors } = useTheme();
  const register = useContext(AnchorContext);
  return (
    <View
      testID={testID}
      onLayout={(event) => {
        const y = event.nativeEvent.layout.y;
        if (anchor) register(anchor, y);
        onLayout?.(y);
      }}
      style={{ marginBottom: 20 }}
    >
      <Eyebrow style={{ marginBottom: 8 }}>{title}</Eyebrow>
      <View style={[settingsStyles.group, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

export function Row({ icon, label, sub, right, first, testID, onPress }: { icon: string; label: string; sub?: string; right?: React.ReactNode; first?: boolean; testID?: string; onPress?: () => void }) {
  const { colors, look } = useTheme();
  const inner = (
    <>
      <Icon name={icon} size={20} color={colors.muted} />
      <View style={{ flex: 1 }}>
        <T v="label">{label}</T>
        {sub ? <T muted style={{ fontSize: 12 }}>{sub}</T> : null}
      </View>
      {right}
    </>
  );
  const st = [settingsStyles.row, { minHeight: look.row, paddingVertical: look.space === 1 ? 8 : Math.round(8 * look.space) }, !first && { borderTopWidth: 1, borderTopColor: colors.divider }];
  return onPress ? (
    <Press testID={testID} onPress={onPress} style={st}>
      {inner}
    </Press>
  ) : (
    <View testID={testID} style={st}>
      {inner}
    </View>
  );
}

/** Standard switch colours shared by every settings row. */
export function useSwitchColors() {
  const { colors } = useTheme();
  return useMemo(() => ({ trackColor: { true: colors.brandPrimary, false: colors.surfaceTertiary }, thumbColor: colors.surfaceSecondary }), [colors.brandPrimary, colors.surfaceSecondary, colors.surfaceTertiary]);
}

export const settingsStyles = bindLookStyles(() =>
  StyleSheet.create({
    group: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, minHeight: 56, paddingVertical: 8 },
    swatchWrap: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingLeft: 4, paddingRight: 12, borderRadius: radius.pill, borderWidth: 1.5 },
    swatch: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    warn: { flexDirection: "row", gap: 10, padding: 12, borderRadius: radius.md },
  }),
);
