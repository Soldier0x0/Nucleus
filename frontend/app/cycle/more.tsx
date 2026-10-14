import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, Share, StyleSheet, Switch, TextInput, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { fonts, radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { addDays, fmtDate, todayISO } from "@/src/core/format";
import type { CycleFlow, CycleState } from "@/src/core/types";
import {
  ABSORBENCY_NOTE,
  DOCTOR_NOTE,
  HYGIENE_NOTES,
  PHASES,
  PRODUCTS,
  SYMPTOMS,
  addCustomSymptom,
  buddyShareLine,
  cycleCsv,
  dismissAbsorbency,
  estimateLine,
  forecast,
  forecastDetail,
  guessPhase,
  listedSymptoms,
  changeOvertimeLine,
  lowStash,
  lowStashLine,
  ovulationLine,
  rematchLine,
  removeCustomSymptom,
  searchCycleDays,
  clearDay,
  setBleeding,
  setChangeHours,
  setChangeKind,
  setFlowLevel,
  restockPack,
  setStashCarry,
  setStashCount,
  setStashLow,
  setStashPack,
  symptomLabel,
  showAbsorbency,
  startChangeTimer,
  stopChangeTimer,
  timerCopy,
  toggleSymptom,
} from "@/src/core/cycle";
import { doctorParagraphs, doctorReport, textPdf } from "@/src/core/cycleReport";
import { requestPermission } from "@/src/core/notify";
import { copyTemporary } from "@/src/core/clipboard";
import { Header } from "@/src/components/Header";
import { Button, Card, Chip, Eyebrow, IconButton, Press, T } from "@/src/components/ui";
import { ModuleGate } from "@/src/components/ModuleGate";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
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
  const [custom, setCustom] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const reportRef = useRef<View>(null);

  useEffect(() => {
    if (real && !on) router.replace("/");
  }, [real, on, router]);

  const log = db.cycle.days.find((d) => d.date === date);
  const next = useMemo(() => forecast(db.cycle, today), [db.cycle, today]);
  const phase = guessPhase(db.cycle, today);
  const found = useMemo(() => searchCycleDays(db.cycle.days, query), [db.cycle.days, query]);
  const lows = lowStash(db.cycle);
  const shareLine = buddyShareLine(db.cycle.buddyName);
  const pinkOn = db.cycle.pinkCalendar;
  const wash = pinkOn ? "#F8F1F3" : colors.surface;
  const chosen = log ? listedSymptoms(log) : [];
  const report = doctorReport(db.cycle, today);
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

  const saveNamed = async (name: string, body: string, mimeType: string) => {
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(new Blob([body], { type: mimeType }));
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
    file.write(body);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: "Save on this phone" });
  };

  const saveFile = async () => {
    await saveNamed(`nucleus-private-${today}.csv`, cycleCsv(db.cycle.days), "text/csv");
  };

  const savePdf = async () => {
    await saveNamed(`nucleus-visit-${today}.pdf`, textPdf(doctorParagraphs(db.cycle, today)), "application/pdf");
  };

  const saveImage = async () => {
    if (!reportRef.current) return;
    const uri = await captureRef(reportRef, { format: "png", quality: 1 });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Save on this phone" });
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
    <>
    <View style={{ flex: 1, backgroundColor: wash }}>
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
            <Chip label="Clear" testID="cycle-clear" onPress={() => setConfirmClear(true)} />
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
                selected={chosen.includes(item.id)}
                testID={`cycle-symptom-${item.id}`}
                onPress={() => setCycle({ ...db.cycle, days: toggleSymptom(db.cycle.days, date, item.id) })}
              />
            ))}
            {db.cycle.customSymptoms.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={chosen.includes(name)}
                testID={`cycle-symptom-custom-${name}`}
                onPress={() => setCycle({ ...db.cycle, days: toggleSymptom(db.cycle.days, date, name) })}
              />
            ))}
          </View>
          <View style={[styles.search, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong, marginTop: 10 }]}>
            <TextInput
              testID="cycle-custom-symptom"
              value={custom}
              onChangeText={setCustom}
              placeholder="Add a symptom"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, color: colors.onSurface, fontFamily: fonts.text, fontSize: 16, height: 48 }}
            />
          </View>
          <Button
            label="Add symptom"
            kind="secondary"
            testID="cycle-custom-add"
            style={{ marginTop: 8 }}
            onPress={() => {
              const name = custom.trim();
              if (!name) return;
              const next = addCustomSymptom(db.cycle, name);
              if (next === db.cycle) {
                toast(db.cycle.customSymptoms.length >= 12 ? "Twelve is the limit" : "Already added");
                return;
              }
              if (next.customSymptoms.length === db.cycle.customSymptoms.length) {
                toast("Twelve is the limit");
                return;
              }
              setCycle({ ...next, days: toggleSymptom(next.days, date, next.customSymptoms.at(-1) ?? name) });
              setCustom("");
            }}
          />
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
          {rematchLine(db.cycle) ? <T muted testID="cycle-rematch" style={{ textAlign: "center", marginTop: 8 }}>{rematchLine(db.cycle)}</T> : null}
          {changeOvertimeLine(db.cycle) ? <T testID="cycle-overtime" style={{ textAlign: "center", marginTop: 8 }}>{changeOvertimeLine(db.cycle)}</T> : null}
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
            <View key={item.kind} style={{ paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }}>
              <T v="label">{PRODUCTS.find((p) => p.id === item.kind)?.label}</T>
              <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
                <T muted style={{ width: 48 }}>Home</T>
                <IconButton icon="minus" label={`Fewer ${item.kind} at home`} testID={`cycle-stash-${item.kind}-minus`} onPress={() => item.count !== null && setCycle(setStashCount(db.cycle, item.kind, item.count - 1))} />
                <T v="monoLg" style={{ width: 48, textAlign: "center" }} testID={`cycle-stash-${item.kind}-count`}>{item.count === null ? "—" : item.count}</T>
                <IconButton icon="plus" label={`More ${item.kind} at home`} testID={`cycle-stash-${item.kind}-plus`} onPress={() => setCycle(setStashCount(db.cycle, item.kind, (item.count ?? 0) + 1))} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
                <T muted style={{ width: 48 }}>Bag</T>
                <IconButton icon="minus" label={`Fewer ${item.kind} in the bag`} testID={`cycle-carry-${item.kind}-minus`} onPress={() => item.carry !== null && setCycle(setStashCarry(db.cycle, item.kind, item.carry - 1))} />
                <T v="monoLg" style={{ width: 48, textAlign: "center" }} testID={`cycle-carry-${item.kind}-count`}>{item.carry === null ? "—" : item.carry}</T>
                <IconButton icon="plus" label={`More ${item.kind} in the bag`} testID={`cycle-carry-${item.kind}-plus`} onPress={() => setCycle(setStashCarry(db.cycle, item.kind, (item.carry ?? 0) + 1))} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
                <T muted style={{ width: 48 }}>Pack</T>
                <IconButton icon="minus" label={`Smaller ${item.kind} pack`} testID={`cycle-pack-${item.kind}-minus`} onPress={() => setCycle(setStashPack(db.cycle, item.kind, item.pack - 1))} />
                <T v="monoLg" style={{ width: 48, textAlign: "center" }} testID={`cycle-pack-${item.kind}`}>{item.pack}</T>
                <IconButton icon="plus" label={`Larger ${item.kind} pack`} testID={`cycle-pack-${item.kind}-plus`} onPress={() => setCycle(setStashPack(db.cycle, item.kind, item.pack + 1))} />
                <Button small kind="secondary" label="Restock" testID={`cycle-restock-${item.kind}`} onPress={() => setCycle(restockPack(db.cycle, item.kind))} />
              </View>
            </View>
          ))}
          <T muted style={{ marginTop: 4 }}>Low mark</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {db.cycle.stash.map((item) => (
              <Chip key={item.kind} label={`${PRODUCTS.find((p) => p.id === item.kind)?.label} ${item.lowAt}`} testID={`cycle-low-${item.kind}`} onPress={() => setCycle(setStashLow(db.cycle, item.kind, item.lowAt >= 9 ? 0 : item.lowAt + 1))} />
            ))}
          </View>
          {lows.map((item) => (
            <T key={item.kind} color={colors.warning} style={{ marginTop: 8 }} testID={`cycle-low-line-${item.kind}`}>{lowStashLine(item.kind, item.count)}</T>
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
              <T muted>{[day.bleeding, day.flow, ...listedSymptoms(day).map(symptomLabel)].filter(Boolean).join(" · ") || "Noted"}</T>
            </Press>
          ))}
          {query && found.length === 0 ? <T muted style={{ marginTop: 8 }}>Nothing in your logs.</T> : null}
        </View>

        <View>
          <Eyebrow style={{ marginBottom: 8 }}>What some people notice</Eyebrow>
          {next ? <T testID="cycle-detail-estimate" style={{ marginBottom: 8 }}>{estimateLine(next)}</T> : <T muted style={{ marginBottom: 8 }}>Log a period to see a guess.</T>}
          {next ? <T style={{ marginBottom: 8 }}>{forecastDetail(next)}</T> : null}
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
          <Row label="Pink calendar" sub="A soft pink tint on this calendar and on cycle reminders." value={db.cycle.pinkCalendar} testID="cycle-pink" sw={sw} onChange={(value) => setCycle({ ...db.cycle, pinkCalendar: value })} />
        </Card>

        <Card>
          <View ref={reportRef} collapsable={false} testID="cycle-report" style={{ backgroundColor: pinkOn ? "#F8F1F3" : colors.surfaceSecondary }}>
            <Eyebrow>Doctor report</Eyebrow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <Chip label="Initials" selected={db.cycle.reportName === "private"} testID="cycle-name-private" onPress={() => setCycle({ ...db.cycle, reportName: "private" })} />
              <Chip label="Full name" selected={db.cycle.reportName === "normal"} testID="cycle-name-normal" onPress={() => setCycle({ ...db.cycle, reportName: "normal" })} />
            </View>
            <T style={{ marginTop: 10 }}>{report}</T>
          </View>
          <Button label="Save PDF" kind="secondary" testID="cycle-report-pdf" style={{ marginTop: 10 }} onPress={() => savePdf().catch(() => toast("Could not save the file"))} />
          <Button label="Save long image" kind="ghost" testID="cycle-report-image" style={{ marginTop: 8 }} onPress={() => saveImage().catch(() => toast("Could not save the file"))} />
          {db.cycle.customSymptoms.map((name) => (
            <Button key={name} label={`Remove ${name}`} kind="ghost" testID={`cycle-custom-remove-${name}`} onPress={() => setCycle(removeCustomSymptom(db.cycle, name))} />
          ))}
        </Card>

        <Button label="Save a private file" kind="secondary" testID="cycle-export" onPress={() => saveFile().catch(() => toast("Could not save the file"))} />
        <Button label="Share the buddy line" kind="ghost" testID="cycle-share" disabled={!shareLine} onPress={() => shareBuddy().catch(() => {})} />
        <T muted>{shareLine || "Name a buddy on the calendar before sharing."}</T>
      </ScrollView>
      <ModuleGate id="cycle" name="Cycle" icon="calendar-blank-outline" />
    </View>
      <ConfirmSheet
        visible={confirmClear}
        id="cycle-clear"
        title="Clear this day?"
        body={`Flow, symptoms and changes logged for ${fmtDate(date)} are removed from this phone. This can't be undone.`}
        confirmLabel="Clear"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          const parts: string[] = [];
          if (log?.bleeding) parts.push(log.bleeding === "flow" ? "flow" : "spotting");
          if (log?.bleeding === "flow" && log.flow) parts.push(log.flow);
          parts.push(...(log ? listedSymptoms(log).map(symptomLabel) : []));
          setCycle({ ...db.cycle, days: clearDay(db.cycle.days, date) });
          setConfirmClear(false);
          toast(parts.length ? `Cleared ${parts.join(", ")}` : "Nothing to clear");
        }}
      />
    </>
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

const styles = bindLookStyles(() => StyleSheet.create({
  search: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, marginBottom: 4 },
}));
