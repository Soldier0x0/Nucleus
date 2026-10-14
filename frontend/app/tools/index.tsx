import React, { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { Header } from "@/src/components/Header";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { useToast } from "@/src/components/Toast";
import { plural } from "@/src/core/format";
import { Eyebrow, Icon, IconButton, Press, T } from "@/src/components/ui";
import { DatesTool, EmiTool, PercentTool, SplitTool, UnitsTool } from "@/src/components/tools";
import { CookingTool, CustomToolRunner, GrowthTool, RandomTool, RoadTripTool, TimeTool } from "@/src/components/tools2";
import { ModuleGate } from "@/src/components/ModuleGate";

const TOOLS = [
  { id: "units", label: "Units", icon: "swap-horizontal", C: UnitsTool },
  { id: "percent", label: "GST & %", icon: "percent-outline", C: PercentTool },
  { id: "split", label: "Tip & split", icon: "account-group-outline", C: SplitTool },
  { id: "dates", label: "Dates", icon: "calendar-range", C: DatesTool },
  { id: "emi", label: "EMI", icon: "bank-outline", C: EmiTool },
  { id: "growth", label: "Growth", icon: "trending-up", C: GrowthTool },
  { id: "cooking", label: "Cooking", icon: "silverware-fork-knife", C: CookingTool },
  { id: "time", label: "Time", icon: "clock-outline", C: TimeTool },
  { id: "roadtrip", label: "Road trip", icon: "road-variant", C: RoadTripTool },
  { id: "random", label: "Decide", icon: "dice-multiple-outline", C: RandomTool },
] as const;

const TILE_TEST_ID: Record<(typeof TOOLS)[number]["id"], string> = {
  units: "tools-tile-units",
  percent: "tools-tile-percent",
  split: "tools-tile-split",
  dates: "tools-tile-dates",
  emi: "tools-tile-emi",
  growth: "tools-tile-growth",
  cooking: "tools-tile-cooking",
  time: "tools-tile-time",
  roadtrip: "tools-tile-roadtrip",
  random: "tools-tile-random",
};

export default function Tools() {
  const params = useLocalSearchParams<{ tool?: string }>();
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const [tool, setTool] = useState<string>(params.tool && (TOOLS.some((t) => t.id === params.tool) || db.customTools.some((t) => `custom:${t.id}` === params.tool)) ? params.tool : "units");
  const [clearOpen, setClearOpen] = useState(false);
  const toast = useToast();
  const active = TOOLS.find((t) => t.id === tool);
  const customId = tool.startsWith("custom:") ? tool.slice(7) : null;
  const history = db.toolHistory.filter((h) => h.tool === tool).slice(0, 8);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Tools" testID="tools-header" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: sp.lg, paddingTop: 4, paddingBottom: insets.bottom + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <View testID="tools-grid" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {TOOLS.map((t) => {
            const selected = tool === t.id;
            return (
              <Press
                key={t.id}
                testID={TILE_TEST_ID[t.id]}
                accessibilityState={{ selected }}
                onPress={() => setTool(t.id)}
                style={{ flexBasis: "30%", flexGrow: 1, minWidth: 96, minHeight: 88, borderRadius: radius.lg, borderWidth: 1, borderColor: selected ? colors.onSurface : colors.border, backgroundColor: selected ? colors.surfaceInverse : colors.surfaceSecondary, padding: 12, gap: 8 }}
              >
                <Icon name={t.icon} size={22} color={selected ? colors.onSurfaceInverse : colors.onSurface} />
                <T v="label" numberOfLines={2} color={selected ? colors.onSurfaceInverse : colors.onSurface}>{t.label}</T>
              </Press>
            );
          })}
          {db.customTools.map((t) => {
            const id = `custom:${t.id}`;
            const selected = tool === id;
            return (
              <Press
                key={t.id}
                testID={`tools-tile-custom-${t.id}`}
                accessibilityState={{ selected }}
                onPress={() => setTool(id)}
                style={{ flexBasis: "30%", flexGrow: 1, minWidth: 96, minHeight: 88, borderRadius: radius.lg, borderWidth: 1, borderColor: selected ? colors.onSurface : colors.border, backgroundColor: selected ? colors.surfaceInverse : colors.surfaceSecondary, padding: 12, gap: 8 }}
              >
                <Icon name={t.icon} size={22} color={selected ? colors.onSurfaceInverse : colors.onSurface} />
                <T v="label" numberOfLines={2} color={selected ? colors.onSurfaceInverse : colors.onSurface}>{t.name}</T>
              </Press>
            );
          })}
        </View>
        <View key={tool} testID={`tool-${tool}`}>
          {customId ? <CustomToolRunner toolId={customId} /> : active ? <active.C /> : null}
        </View>
        {history.length ? (
          <View style={{ marginTop: 20 }} testID="tools-history">
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Eyebrow style={{ flex: 1 }}>Saved results</Eyebrow>
              <IconButton icon="delete-sweep-outline" label="Clear history" testID="tools-history-clear" onPress={() => setClearOpen(true)} />
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
                  <IconButton icon="close" label={`Delete ${h.label}`} testID={`tool-history-delete-${h.id}`} onPress={() => update((d) => ({ ...d, toolHistory: d.toolHistory.filter((x) => x.id !== h.id) }))} />
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </KeyboardAwareScrollView>
      <ModuleGate id="tools" name="Tools" icon="calculator-variant-outline" />
      <ConfirmSheet
        visible={clearOpen}
        id="tools-history-clear"
        title="Clear saved results?"
        body={`This removes all ${plural(history.length, "saved result")} for this tool. This can't be undone.`}
        confirmLabel="Clear all"
        icon="delete-sweep-outline"
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          setClearOpen(false);
          update((d) => ({ ...d, toolHistory: d.toolHistory.filter((h) => h.tool !== tool) }));
          toast("Saved results cleared", "delete-sweep-outline");
        }}
      />
    </View>
  );
}
