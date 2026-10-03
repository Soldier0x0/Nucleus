import React, { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { calendarEvents, eventsOn } from "@/src/core/life";
import { monthKey, monthLabel, todayISO } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Card, Icon, Press, T } from "@/src/components/ui";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarScreen() {
  const { db } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const today = todayISO();
  const [cursor, setCursor] = useState(monthKey(today));
  const events = useMemo(() => calendarEvents(db), [db]);
  const [year, month] = cursor.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const selectedDefault = cursor === monthKey(today) ? today : `${cursor}-01`;
  const [selected, setSelected] = useState(selectedDefault);
  const shown = eventsOn(events, selected);

  const shift = (n: number) => {
    const d = new Date(year, month - 1 + n, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setCursor(next);
    setSelected(`${next}-01`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Dates" testID="calendar-header" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <T muted style={{ marginBottom: 12 }}>Every date already on a vehicle, bill, trip, chore or paper. Nothing new to type.</T>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <Press testID="calendar-prev" onPress={() => shift(-1)} style={{ padding: 8 }}><Icon name="chevron-left" size={22} /></Press>
          <T v="h2" style={{ flex: 1, textAlign: "center" }} testID="calendar-month">{monthLabel(cursor)} {year}</T>
          <Press testID="calendar-next" onPress={() => shift(1)} style={{ padding: 8 }}><Icon name="chevron-right" size={22} /></Press>
        </View>
        <View style={{ flexDirection: "row" }}>
          {WEEK.map((d) => <T key={d} muted v="mono" style={{ flex: 1, textAlign: "center", fontSize: 11 }}>{d}</T>)}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {cells.map((day, i) => {
            if (!day) return <View key={`e-${i}`} style={{ width: `${100 / 7}%`, height: 44 }} />;
            const iso = `${cursor}-${String(day).padStart(2, "0")}`;
            const count = eventsOn(events, iso).length;
            const on = iso === selected;
            const isToday = iso === today;
            return (
              <Press key={iso} testID={`calendar-day-${iso}`} onPress={() => setSelected(iso)} style={{ width: `${100 / 7}%`, height: 44, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.surfaceInverse : "transparent", borderWidth: isToday ? 1 : 0, borderColor: colors.brandPrimary }}>
                  <T v="mono" color={on ? colors.onSurfaceInverse : colors.onSurface} style={{ fontSize: 13 }}>{day}</T>
                </View>
                {count ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.brandPrimary, marginTop: 2 }} /> : <View style={{ height: 6 }} />}
              </Press>
            );
          })}
        </View>
        <Card testID="calendar-day-list" style={{ marginTop: 8 }}>
          <T v="label" style={{ marginBottom: 8 }}>{selected}</T>
          {shown.length === 0 ? <T muted>Nothing on this day.</T> : shown.map((e) => (
            <Press key={`${e.date}-${e.title}-${e.route}`} testID={`calendar-event-${e.title}`} onPress={() => router.push(e.route as any)} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, borderTopWidth: 1, borderTopColor: colors.divider }}>
              <Icon name={e.icon} size={18} color={colors.muted} />
              <T style={{ flex: 1 }} numberOfLines={1}>{e.title}</T>
              <Icon name="chevron-right" size={18} color={colors.muted} />
            </Press>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
