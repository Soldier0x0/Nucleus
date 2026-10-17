import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { timeline } from "@/src/core/exports";
import { fmtDate, monthKey, monthLabel } from "@/src/core/format";
import { nextTimelineFilter } from "@/src/core/presets";
import { journalDeletions, journalKind, journalLabel, restoreEntity } from "@/src/core/journal";
import { Header } from "@/src/components/Header";
import { Chip, ChipRow, EmptyState, Eyebrow, Icon, Press, T } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";

const FILTERS = [
  { id: "all", label: "Everything", icons: [] as string[] },
  { id: "money", label: "Money", icons: ["arrow-up-bold-circle-outline", "arrow-down-bold-circle-outline"] },
  { id: "vehicles", label: "Vehicles", icons: ["gas-station-outline", "wrench-outline"] },
  { id: "travel", label: "Travel", icons: ["bag-suitcase-outline"] },
  { id: "home", label: "Home", icons: ["washing-machine"] },
  { id: "notes", label: "Notes", icons: ["note-text-outline"] },
];

export default function Timeline() {
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState("all");
  const pageW = Math.min(width, 720);
  const [frameH, setFrameH] = useState(0);
  const pages = [FILTERS[FILTERS.length - 1], ...FILTERS, FILTERS[0]];
  const start = FILTERS.findIndex((row) => row.id === filter) + 1;
  const scrollRef = useRef<ScrollView>(null);
  const fromSwipe = useRef(false);

  const deletions = useMemo(() => journalDeletions(db), [db]);

  const grouped = useMemo(() => {
    const rows = timeline(db);
    return FILTERS.map((item) => {
      const kept = rows.filter((row) => !item.icons.length || item.icons.includes(row.icon));
      const map = new Map<string, typeof kept>();
      kept.forEach((row) => {
        const key = monthKey(row.date);
        map.set(key, [...(map.get(key) ?? []), row]);
      });
      return { id: item.id, groups: [...map.entries()] };
    });
  }, [db]);

  useLayoutEffect(() => {
    if (fromSwipe.current) {
      fromSwipe.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ x: start * pageW, animated: false });
  }, [start, pageW]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Timeline" testID="timeline-header" />
      <ChipRow testID="timeline-filter-row">
        {FILTERS.map((item) => (
          <Chip key={item.id} label={item.label} selected={filter === item.id} testID={`timeline-filter-${item.id}`} onPress={() => setFilter(item.id)} />
        ))}
      </ChipRow>
      {deletions.length ? (
        <View style={{ paddingHorizontal: sp.lg, paddingBottom: 12 }} testID="timeline-restores">
          <Eyebrow style={{ marginBottom: 8 }}>Deleted recently</Eyebrow>
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }}>
            {deletions.map((entry, i) => (
              <View key={entry.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.divider }}>
                <Icon name="restore" size={20} color={colors.muted} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="label" numberOfLines={1}>{journalLabel(entry)}</T>
                  <T muted style={{ fontSize: 12 }} numberOfLines={1}>{fmtDate(entry.at.slice(0, 10))} · {journalKind(entry)}</T>
                </View>
                <Chip label="Restore" testID={`timeline-restore-${i}`} onPress={() => {
                  update((d) => restoreEntity(d, entry));
                  toast("Restored");
                }} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <View style={{ flex: 1 }} onLayout={(event) => setFrameH(event.nativeEvent.layout.height)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        style={{ width: pageW, alignSelf: "center", height: frameH || undefined }}
        onMomentumScrollEnd={(event) => {
          const raw = Math.round(event.nativeEvent.contentOffset.x / Math.max(pageW, 1));
          const last = FILTERS[FILTERS.length - 1]?.id ?? "notes";
          const first = FILTERS[0]?.id ?? "all";
          const landed = raw <= 0 ? nextTimelineFilter(first, "prev") : raw >= pages.length - 1 ? nextTimelineFilter(last, "next") : FILTERS[raw - 1]?.id ?? first;
          if (raw <= 0) scrollRef.current?.scrollTo({ x: FILTERS.length * pageW, animated: false });
          if (raw >= pages.length - 1) scrollRef.current?.scrollTo({ x: pageW, animated: false });
          if (landed === filter) return;
          fromSwipe.current = true;
          setFilter(landed);
        }}
      >
        {pages.map((page, index) => {
          const groups = grouped.find((item) => item.id === page.id)?.groups ?? [];
          return (
            <View key={`${page.id}-${index}`} style={{ width: pageW, height: frameH || undefined }}>
              <ScrollView nestedScrollEnabled style={{ flex: 1 }} contentContainerStyle={{ padding: sp.lg, paddingTop: 4, paddingBottom: insets.bottom + 24 }}>
                {groups.length === 0 ? (
                  <EmptyState testID={index === start ? "timeline-empty" : undefined} icon="timeline-text-outline" title="Nothing here yet" body="Every fuel fill, expense, trip and note shows up here in order." />
                ) : null}
                {groups.map(([mk, rows]) => (
                  <View key={mk} style={{ marginBottom: 20 }}>
                    <Eyebrow style={{ marginBottom: 8 }}>
                      {monthLabel(mk)} {mk.slice(0, 4)} · {rows.length}
                    </Eyebrow>
                    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }}>
                      {rows.map((row, rowIndex) => (
                        <Press key={row.id + rowIndex} testID={`timeline-row-${row.id}`} disabled={!row.route} onPress={() => row.route && router.push(row.route as never)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderTopWidth: rowIndex ? 1 : 0, borderTopColor: colors.divider }}>
                          <Icon name={row.icon} size={20} color={colors.muted} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <T v="label" numberOfLines={1}>{row.title}</T>
                            <T muted style={{ fontSize: 12 }} numberOfLines={1}>{fmtDate(row.date)} · {row.sub}</T>
                          </View>
                          {row.route ? <Icon name="chevron-right" size={18} color={colors.muted} /> : null}
                        </Press>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
      </View>
    </View>
  );
}
