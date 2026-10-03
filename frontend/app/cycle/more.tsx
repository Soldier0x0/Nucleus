import React, { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, Share, StyleSheet, Switch, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { fonts, radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { addDays, fmtDate, todayISO } from "@/src/core/format";
import type { CycleFlow, CycleProduct, CycleState, CycleSymptom } from "@/src/core/types";
import {
  ABSORBENCY_NOTE,
  DOCTOR_NOTE,
  HYGIENE_NOTES,
  PHASES,
  PRODUCTS,
  SYMPTOMS,
  buddyShareLine,
  cycleCsv,
  dismissAbsorbency,
  forecast,
  forecastDetail,
  guessPhase,
  lowStash,
  lowStashLine,
  ovulationLine,
  searchCycleDays,
  clearDay,
  setBleeding,
  setChangeHours,
  setChangeKind,
  setFlowLevel,
  setStashCount,
  setStashLow,
  setSymptom,
  showAbsorbency,
  startChangeTimer,
  stopChangeTimer,
  timerCopy,
} from "@/src/core/cycle";
import { requestPermission } from "@/src/core/notify";
import { copyTemporary } from "@/src/core/clipboard";
import { Header } from "@/src/components/Header";
import { Button, Card, Chip, Eyebrow, IconButton, Press, T } from "@/src/components/ui";
import { ModuleGate } from "@/src/components/ModuleGate";
import { useToast } from "@/src/components/Toast";
import { useRealSession } from "@/src/components/useRealSession";

const FLOWS: { id: CycleFlow; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "heavy", label: "Heavy" },
];

function clock(iso: string, format: "12h" | "24h") {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: format === "12h" });
}

export default function CycleDetails() {
  const real = useRealSession();
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ date?: string }>();
  const today = todayISO();
  const requested = typeof params.date === "string" ? params.date : today;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  const on = db.settings.modules.find((m) => m.id === "cycle")?.enabled !== false;
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (real && !on) router.replace("/");
  }, [real, on, router]);

  const log = db.cycle.days.find((d) => d.date === date);
  const next = useMemo(() => forecast(db.cycle, today), [db.cycle, today]);
  const phase = guessPhase(db.cycle, today);
  const found = useMemo(() => searchCycleDays(db.cycle.days, query), [db.cycle.days, query]);
  const lows = lowStash(db.cycle);
  const shareLine = buddyShareLine(db.cycle.buddyName);
  const sw = { trackColor: { true: colors.brandPrimary, false: colors.surfaceTertiary }, thumbColor: colors.surfaceSecondary };

  if (!real || !on) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const setCycle = (cycle: CycleState) => update((d) => ({ ...d, cycle }));
  const go = (iso: string) => router.setParams({ date: iso });

  const allowNotify = async () => {
    const perm = await requestPermission();
    if (!perm.granted) {
      toast("Notifications are off", "bell-off-outline");
      return false;
    }
    return true;
  };

  const saveFile = async () => {
    const csv = cycleCsv(db.cycle.days);
    const name = `nucleus-private-${today}.csv`;
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = (globalThis as { document: { createElement: (tag: string) => { href: string; download: string; click: () => void } } }).document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Save on this phone" });
  };

  const shareBuddy = async () => {
    if (!shareLine) return;
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text: shareLine });
        return;
      }
      await Share.share({ message: shareLine });
    } catch {
      await copyTemporary(shareLine);
      toast("Copied");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Details" testID="cycle-details-header" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 28, gap: 14, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <IconButton icon="chevron-left" label="Previous day" testID="cycle-day-prev" onPress={() => go(addDays(date, -1))} />
          <T v="title" style={{ flex: 1, textAlign: "center" }} testID="cycle-edit-date">{fmtDate(date)}</T>
          <IconButton icon="chevron-right" label="Next day" testID="cycle-day-next" onPress={() => go(addDays(date, 1))} />
        </View>

        <View>
          <Eyebrow style={{ marginBottom: 8 }}>This day</Eyebrow>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label="Spotting" selected={log?.bleeding === "spotting"} testID="cycle-spotting" onPress={() => setCycle({ ...db.cycle, days: setBleeding(db.cycle.days, date, "spotting") })} />
            <Chip label="Flow" selected={log?.bleeding === "flow"} testID="cycle-flow" onPress={() => setCycle({ ...db.cycle, days: setBleeding(db.cycle.days, date, "flow") })} />
            <Chip label="Clear" testID="cycle-clear" onPress={() => setCycle({ ...db.cycle, days: clearDay(db.cycle.days, date) })} />
          </View>
          {log?.ended ? <T muted style={{ marginTop: 8 }}>Marked as the end.</T> : null}
          {log?.bleeding === "flow" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {FLOWS.map((item) => (
                <Chip key={item.id} label={item.label} selected={log.flow === item.id} testID={`cycle-heaviness-${item.id}`} onPress={() => setCycle({ ...db.cycle, days: setFlowLevel(db.cycle.days, date, log.flow === item.id ? null : item.id) })} />
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {SYMPTOMS.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={log?.symptom === item.id}
                testID={`cycle-symptom-${item.id}`}
                onPress={() => setCycle({ ...db.cycle, days: setSymptom(db.cycle.days, date, log?.symptom === item.id ? null : (item.id as CycleSymptom)) })}
              />
            ))}
          </View>
        </View>

        <Card testID="cycle-timer">
          <Eyebrow>Change timer</Eyebrow>
          <T muted style={{ marginTop: 6, marginBottom: 10 }}>{timerCopy(db.cycle.changeKind)}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {PRODUCTS.map((item) => (
              <Chip key={item.id} label={item.label} selected={db.cycle.changeKind === item.id} testID={`cycle-timer-${item.id}`} onPress={() => setCycle(setChangeKind(db.cycle, item.id))} />
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
            <IconButton icon="minus" label="Fewer hours" testID="cycle-hours-minus" onPress={() => setCycle(setChangeHours(db.cycle, db.cycle.changeHours - 1))} />
            <T v="h2" style={{ flex: 1, textAlign: "center" }} testID="cycle-hours">{db.cycle.changeHours} hours</T>
            <IconButton icon="plus" label="More hours" testID="cycle-hours-plus" onPress={() => setCycle(setChangeHours(db.cycle, db.cycle.changeHours + 1))} />
          </View>
          {db.cycle.changeEndsAt ? <T style={{ textAlign: "center" }}>Ends {clock(db.cycle.changeEndsAt, db.settings.timeFormat)}</T> : null}
          <Button
            label={db.cycle.changeEndsAt ? "Stop timer" : "Start timer"}
            kind="secondary"
            testID="cycle-timer-toggle"
            style={{ marginTop: 8 }}
            onPress={() => setCycle(db.cycle.changeEndsAt ? stopChangeTimer(db.cycle) : startChangeTimer(db.cycle, new Date()))}
          />
        </Card>

        <Card testID="cycle-stash">
          <Eyebrow>Stash</Eyebrow>
          {db.cycle.stash.map((item) => (
            <View key={item.kind} style={{ flexDirection: "row", alignItems: "center", minHeight: 52 }}>
              <T v="label" style={{ flex: 1 }}>{PRODUCTS.find((p) => p.id === item.kind)?.label}</T>
              <IconButton icon="minus" label={`Fewer ${item.kind}`} testID={`cycle-stash-${item.kind}-minus`} onPress={() => item.count !== null && setCycle(setStashCount(db.cycle, item.kind, item.count - 1))} />
              <T v="monoLg" style={{ width: 48, textAlign: "center" }} testID={`cycle-stash-${item.kind}-count`}>{item.count === null ? "—" : item.count}</T>
              <IconButton icon="plus" label={`More ${item.kind}`} testID={`cycle-stash-${item.kind}-plus`} onPress={() => setCycle(setStashCount(db.cycle, item.kind as CycleProduct, (item.count ?? 0) + 1))} />
            </View>
          ))}
          <T muted style={{ marginTop: 4 }}>Low mark</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {db.cycle.stash.map((item) => (
              <Chip key={item.kind} label={`${PRODUCTS.find((p) => p.id === item.kind)?.label} ${item.lowAt}`} testID={`cycle-low-${item.kind}`} onPress={() => setCycle(setStashLow(db.cycle, item.kind, item.lowAt >= 9 ? 0 : item.lowAt + 1))} />
            ))}
          </View>
          {lows.map((item) => (
            <T key={item.kind} color={colors.warning} style={{ marginTop: 8 }} testID={`cycle-low-line-${item.kind}`}>{lowStashLine(item.kind)}</T>
          ))}
        </Card>

        <View>
          <Eyebrow style={{ marginBottom: 8 }}>Your logs</Eyebrow>
          <View style={[styles.search, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong }]}>
            <TextInput testID="cycle-search" value={query} onChangeText={setQuery} placeholder="Heavy, cramps…" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.onSurface, fontFamily: fonts.text, fontSize: 16, height: 48 }} />
          </View>
          {found.slice(0, 12).map((day) => (
            <Press key={day.id} testID={`cycle-hit-${day.date}`} onPress={() => go(day.date)} style={{ minHeight: 48, justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }}>
              <T>{fmtDate(day.date)}</T>
              <T muted>{[day.bleeding, day.flow, SYMPTOMS.find((s) => s.id === day.symptom)?.label].filter(Boolean).join(" · ") || "Noted"}</T>
            </Press>
          ))}
          {query && found.length === 0 ? <T muted style={{ marginTop: 8 }}>Nothing in your logs.</T> : null}
        </View>

        <View>
          <Eyebrow style={{ marginBottom: 8 }}>What some people notice</Eyebrow>
          {next ? <T style={{ marginBottom: 8 }}>{forecastDetail(next)}</T> : <T muted style={{ marginBottom: 8 }}>Log a period to see a guess.</T>}
          {next && !next.paused ? <T style={{ marginBottom: 8 }}>{ovulationLine(next)}</T> : null}
          {PHASES.map((item) => (
            <Card key={item.id} style={{ marginBottom: 8 }} tone={phase === item.id ? "tint" : "default"}>
              <T v="label">{item.title}{phase === item.id ? " · guess" : ""}</T>
              <T muted style={{ marginTop: 4 }}>{item.line}</T>
            </Card>
          ))}
          <T>{DOCTOR_NOTE}</T>
        </View>

        <View>
          <Eyebrow style={{ marginBottom: 8 }}>Buying and care</Eyebrow>
          {HYGIENE_NOTES.map((line) => <T key={line} style={{ marginBottom: 6 }}>{line}</T>)}
          {showAbsorbency(db.cycle) ? (
            <Card style={{ marginTop: 8 }}>
              <T>{ABSORBENCY_NOTE}</T>
              <Button label="Leave it as it is" kind="secondary" testID="cycle-absorbency" style={{ marginTop: 10 }} onPress={() => setCycle(dismissAbsorbency(db.cycle))} />
            </Card>
          ) : null}
        </View>

        <Card>
          <Row label="Period reminder" sub="One line, the day the guess window opens." value={db.cycle.periodNudge} testID="cycle-period-nudge" sw={sw} onChange={async (value) => {
            if (value && !(await allowNotify())) return;
            setCycle({ ...db.cycle, periodNudge: value });
          }} />
          <Row label="Change reminder" sub="Fires when the timer ends. Same line." value={db.cycle.changeNudge} testID="cycle-change-nudge" sw={sw} onChange={async (value) => {
            if (value && !(await allowNotify())) return;
            setCycle({ ...db.cycle, changeNudge: value });
          }} />
          <Row label="Pause guesses" sub="A gap longer than 90 days is already left out." value={db.cycle.paused} testID="cycle-pause" sw={sw} onChange={(value) => setCycle({ ...db.cycle, paused: value })} />
        </Card>

        <Button label="Save a private file" kind="secondary" testID="cycle-export" onPress={() => saveFile().catch(() => toast("Could not save the file"))} />
        <Button label="Share the buddy line" kind="ghost" testID="cycle-share" disabled={!shareLine} onPress={() => shareBuddy().catch(() => {})} />
        <T muted>{shareLine || "Name a buddy on the calendar before sharing."}</T>
      </ScrollView>
      <ModuleGate id="cycle" name="Cycle" icon="calendar-blank-outline" />
    </View>
  );
}

function Row({ label, sub, value, onChange, testID, sw }: { label: string; sub: string; value: boolean; onChange: (value: boolean) => void; testID: string; sw: { trackColor: { true: string; false: string }; thumbColor: string } }) {
  return (
    <View style={{ paddingVertical: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <T v="label" style={{ flex: 1 }}>{label}</T>
        <Switch testID={testID} value={value} onValueChange={onChange} {...sw} />
      </View>
      <T muted>{sub}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, marginBottom: 4 },
});
