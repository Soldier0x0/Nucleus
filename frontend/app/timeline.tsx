import React, { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { timeline } from "@/src/core/exports";
import { fmtDate, monthKey, monthLabel } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Chip, ChipRow, EmptyState, Eyebrow, Icon, Press, T } from "@/src/components/ui";

const FILTERS = [
  { id: "all", label: "Everything", icons: [] as string[] },
  { id: "money", label: "Money", icons: ["arrow-up-bold-circle-outline", "arrow-down-bold-circle-outline"] },
  { id: "vehicles", label: "Vehicles", icons: ["gas-station-outline", "wrench-outline"] },
  { id: "travel", label: "Travel", icons: ["bag-suitcase-outline"] },
  { id: "home", label: "Home", icons: ["washing-machine"] },
  { id: "notes", label: "Notes", icons: ["note-text-outline"] },
];

export default function Timeline() {
  const { db } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState("all");

  const groups = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const rows = timeline(db).filter((r) => !f.icons.length || f.icons.includes(r.icon));
    const map = new Map<string, typeof rows>();
    rows.forEach((r) => {
      const k = monthKey(r.date);
      map.set(k, [...(map.get(k) ?? []), r]);
    });
    return [...map.entries()];
  }, [db, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Timeline" testID="timeline-header" />
      <ChipRow testID="timeline-filter-row">
        {FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} selected={filter === f.id} testID={`timeline-filter-${f.id}`} onPress={() => setFilter(f.id)} />
        ))}
      </ChipRow>
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingTop: 4, paddingBottom: insets.bottom + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {groups.length === 0 ? (
          <EmptyState testID="timeline-empty" icon="timeline-text-outline" title="Nothing here yet" body="Every fuel fill, expense, trip and note shows up here in order." />
        ) : null}
        {groups.map(([mk, rows]) => (
          <View key={mk} style={{ marginBottom: 20 }}>
            <Eyebrow style={{ marginBottom: 8 }}>
              {monthLabel(mk)} {mk.slice(0, 4)} · {rows.length}
            </Eyebrow>
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }}>
              {rows.map((r, i) => (
                <Press key={r.id + i} testID={`timeline-row-${r.id}`} disabled={!r.route} onPress={() => r.route && router.push(r.route as any)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.divider }}>
                  <Icon name={r.icon} size={20} color={colors.muted} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="label" numberOfLines={1}>
                      {r.title}
                    </T>
                    <T muted style={{ fontSize: 12 }} numberOfLines={1}>
                      {fmtDate(r.date)} · {r.sub}
                    </T>
                  </View>
                  {r.route ? <Icon name="chevron-right" size={18} color={colors.muted} /> : null}
                </Press>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
