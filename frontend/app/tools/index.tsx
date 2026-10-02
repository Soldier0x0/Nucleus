import React, { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { Header } from "@/src/components/Header";
import { Chip, ChipRow, Eyebrow, Icon, IconButton, T } from "@/src/components/ui";
import { DatesTool, EmiTool, PercentTool, SplitTool, UnitsTool } from "@/src/components/tools";

const TOOLS = [
  { id: "units", label: "Units", icon: "swap-horizontal", C: UnitsTool },
  { id: "percent", label: "GST & %", icon: "percent-outline", C: PercentTool },
  { id: "split", label: "Tip & split", icon: "account-group-outline", C: SplitTool },
  { id: "dates", label: "Dates", icon: "calendar-range", C: DatesTool },
  { id: "emi", label: "EMI", icon: "bank-outline", C: EmiTool },
] as const;

export default function Tools() {
  const params = useLocalSearchParams<{ tool?: string }>();
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const [tool, setTool] = useState<string>(params.tool && TOOLS.some((t) => t.id === params.tool) ? params.tool : "units");
  const active = TOOLS.find((t) => t.id === tool)!;
  const history = db.toolHistory.filter((h) => h.tool === tool).slice(0, 8);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Quick Tools" testID="tools-header" />
      <ChipRow testID="tools-chip-row">
        {TOOLS.map((t) => (
          <Chip key={t.id} label={t.label} icon={t.icon} selected={tool === t.id} onPress={() => setTool(t.id)} testID={`tools-chip-${t.id}`} />
        ))}
      </ChipRow>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: sp.lg, paddingTop: 4, paddingBottom: insets.bottom + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <View key={tool} testID={`tool-${tool}`}>
          <active.C />
        </View>
        {history.length ? (
          <View style={{ marginTop: 20 }} testID="tools-history">
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Eyebrow style={{ flex: 1 }}>Saved results</Eyebrow>
              <IconButton icon="delete-sweep-outline" label="Clear history" testID="tools-history-clear" onPress={() => update((d) => ({ ...d, toolHistory: d.toolHistory.filter((h) => h.tool !== tool) }))} />
            </View>
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }}>
              {history.map((h, i) => (
                <View key={h.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.divider }}>
                  <Icon name="history" size={18} color={colors.muted} />
                  <View style={{ flex: 1 }}>
                    <T muted style={{ fontSize: 12 }} numberOfLines={1}>{h.label}</T>
                    <T v="mono">{h.value}</T>
                  </View>
                  <T muted style={{ fontSize: 11 }}>{new Date(h.at).toLocaleDateString()}</T>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}
