import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { monthKey, monthLabel, todayISO } from "@/src/core/format";
import { BUDDY_EMOJIS, SAMPLE_BUDDY_NOTE, buddyTitle, changeOvertimeLine, dayInWindow, estimateLine, forecast, markEnd, markStart, packingTarget, rememberPeriod, rematchLine, saveBuddyIntro, setBuddy, skipBuddyIntro, togglePacked, typicalCompare } from "@/src/core/cycle";
import { Header } from "@/src/components/Header";
import { Button, Card, Icon, Press, T } from "@/src/components/ui";
import { Field } from "@/src/components/inputs";
import { Sheet } from "@/src/components/Sheet";
import { ModuleGate } from "@/src/components/ModuleGate";
import { useToast } from "@/src/components/Toast";
import { useRealSession } from "@/src/components/useRealSession";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CycleScreen() {
  const real = useRealSession();
  const { db, update } = useStore();
  const { colors, sp, touch } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const today = todayISO();
  const on = db.settings.modules.find((m) => m.id === "cycle")?.enabled !== false;
  const [cursor, setCursor] = useState(monthKey(today));
  const [selected, setSelected] = useState(today);
  const [buddyOpen, setBuddyOpen] = useState(false);
  const [pastStart, setPastStart] = useState("");
  const [pastEnd, setPastEnd] = useState("");
  const [name, setName] = useState(db.cycle.buddyName);
  const [emoji, setEmoji] = useState(db.cycle.buddyEmoji);
  const [introNote, setIntroNote] = useState(db.cycle.buddyNote || SAMPLE_BUDDY_NOTE);
  const showIntro = real && on && db.cycle.buddyIntroSeen !== true && !db.cycle.buddyName;

  useEffect(() => {
    if (real && !on) router.replace("/");
  }, [real, on, router]);

  const next = useMemo(() => forecast(db.cycle, today), [db.cycle, today]);
  const packFor = packingTarget(db.cycle, today);
  const packed = packFor !== null && db.cycle.packedFor === packFor;
  const todayLog = db.cycle.days.find((d) => d.date === today);

  if (!real || !on) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const [year, month] = cursor.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const line = next?.line ?? "Log a period to see a guess.";
  const pinkOn = db.cycle.pinkCalendar;
  const wash = pinkOn ? "#F8F1F3" : colors.surface;
  const flowBg = pinkOn ? "#C48998" : colors.brandPrimary;
  const flowFg = pinkOn ? "#2C2428" : colors.onBrandPrimary;
  const windowBg = pinkOn ? "#F6E4EA" : colors.brandTertiary;
  const windowFg = pinkOn ? "#5C3A44" : colors.onBrandTertiary;
  const typical = typicalCompare(db.cycle.days, today);

  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setCursor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const saveBuddy = () => {
    update((d) => ({ ...d, cycle: setBuddy(d.cycle, name, emoji) }));
    setBuddyOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: wash }} testID="cycle-calendar">
      <Header title="Cycle" testID="cycle-header" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 28, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <Press testID="cycle-buddy" onPress={() => (setName(db.cycle.buddyName), setEmoji(db.cycle.buddyEmoji), setBuddyOpen(true))} style={{ alignItems: "center", marginBottom: 8 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
            {db.cycle.buddyEmoji ? <Text style={{ fontSize: 44 }}>{db.cycle.buddyEmoji}</Text> : <Icon name="plus" size={32} color={colors.muted} />}
          </View>
          <T v="label" style={{ marginTop: 8 }} numberOfLines={1}>
            {db.cycle.buddyName || "Name a buddy"}
          </T>
          {db.cycle.buddyNote ? <T muted testID="cycle-buddy-note" style={{ textAlign: "center", marginTop: 4 }}>{db.cycle.buddyNote}</T> : null}
        </Press>
        {rematchLine(db.cycle) ? <T muted testID="cycle-rematch" style={{ textAlign: "center", marginBottom: 8 }}>{rematchLine(db.cycle)}</T> : null}
        {changeOvertimeLine(db.cycle) ? <T testID="cycle-overtime" style={{ textAlign: "center", marginBottom: 8 }}>{changeOvertimeLine(db.cycle)}</T> : null}

        <T testID="cycle-window" v="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ textAlign: "center", marginBottom: 8 }}>
          {line}
        </T>
        {next ? <T testID="cycle-estimate" style={{ textAlign: "center", marginBottom: 16 }}>{estimateLine(next)}</T> : null}
        {typical ? <T testID="cycle-typical" style={{ textAlign: "center", marginBottom: 16 }}>{typical.line}</T> : null}

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Press testID="cycle-prev" onPress={() => shift(-1)} style={{ padding: 8 }}><Icon name="chevron-left" size={26} /></Press>
          <T v="h2" style={{ flex: 1, textAlign: "center" }} testID="cycle-month">{monthLabel(cursor)} {year}</T>
          <Press testID="cycle-next" onPress={() => shift(1)} style={{ padding: 8 }}><Icon name="chevron-right" size={26} /></Press>
        </View>
        <View style={{ flexDirection: "row", marginBottom: 4 }}>
          {WEEK.map((label) => <T key={label} muted v="label" style={{ width: `${100 / 7}%`, textAlign: "center" }}>{label}</T>)}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {cells.map((day, index) => {
            if (!day) return <View key={`empty-${index}`} style={{ width: `${100 / 7}%`, height: 76 }} />;
            const iso = `${cursor}-${String(day).padStart(2, "0")}`;
            const log = db.cycle.days.find((d) => d.date === iso);
            const flow = log?.bleeding === "flow";
            const spotting = log?.bleeding === "spotting";
            const inWindow = dayInWindow(iso, next);
            const isSelected = iso === selected;
            const isToday = iso === today;
            return (
              <Press key={iso} testID={`cycle-day-${iso}`} onPress={() => setSelected(iso)} style={{ width: `${100 / 7}%`, height: 76, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: "88%", height: 68, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: flow ? flowBg : inWindow ? windowBg : colors.surfaceSecondary, borderWidth: isSelected || isToday ? 2 : 1, borderColor: isSelected ? colors.onSurface : isToday ? flowBg : colors.border }}>
                  <Text style={{ fontFamily: fonts.monoBold, fontSize: 22, color: flow ? flowFg : inWindow ? windowFg : colors.onSurface }}>{day}</Text>
                  {spotting ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: flowBg, marginTop: 3 }} /> : null}
                </View>
              </Press>
            );
          })}
        </View>

        {packFor ? (
          <Press testID="cycle-pack" onPress={() => update((d) => ({ ...d, cycle: togglePacked(d.cycle, packFor) }))} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: Math.round(56 * touch), marginTop: 8 }}>
            <Icon name={packed ? "checkbox-marked-outline" : "checkbox-blank-outline"} size={28} color={colors.onSurface} />
            <T v="h2">Pack a spare</T>
          </Press>
        ) : null}

        <Field label="Past period start" testID="cycle-past-start" value={pastStart} onChangeText={setPastStart} placeholder="2026-03-01" />
        <Field label="Past period end" testID="cycle-past-end" value={pastEnd} onChangeText={setPastEnd} placeholder="2026-03-03" />
        <Button
          label="Remember these dates"
          testID="cycle-past-save"
          kind="secondary"
          style={{ marginTop: 8 }}
          onPress={() => {
            const days = rememberPeriod(db.cycle.days, pastStart, pastEnd);
            if (days === db.cycle.days) return toast("Check both dates");
            update((d) => ({ ...d, cycle: { ...d.cycle, days } }));
            toast("Saved");
          }}
        />
        <Button
          label="Started today"
          testID="cycle-start"
          kind={todayLog?.bleeding === "flow" && !todayLog.ended ? "primary" : "secondary"}
          style={{ marginTop: 16 }}
          onPress={() => {
            update((d) => ({ ...d, cycle: { ...d.cycle, days: markStart(d.cycle.days, today) } }));
            toast("Saved");
          }}
        />
        <Button
          label="Ended today"
          testID="cycle-end"
          kind={todayLog?.ended ? "primary" : "secondary"}
          style={{ marginTop: 8 }}
          onPress={() => {
            const nextDays = markEnd(db.cycle.days, today);
            if (nextDays === db.cycle.days) {
              toast("Nothing open to end");
              return;
            }
            update((d) => ({ ...d, cycle: { ...d.cycle, days: nextDays } }));
            toast("Saved");
          }}
        />
        <Button label="Flow, symptoms, stash" kind="ghost" testID="cycle-more" style={{ marginTop: 10 }} onPress={() => router.push({ pathname: "/cycle/more", params: { date: selected } })} />
      </ScrollView>

      <Sheet
        visible={showIntro}
        onClose={() => update((d) => ({ ...d, cycle: skipBuddyIntro(d.cycle) }))}
        title="A buddy, if you want one"
        testID="cycle-buddy-intro"
        footer={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button kind="ghost" label="Skip" testID="cycle-buddy-skip" style={{ flex: 1 }} onPress={() => update((d) => ({ ...d, cycle: skipBuddyIntro(d.cycle) }))} />
            <Button label="Save" testID="cycle-buddy-intro-save" style={{ flex: 1 }} onPress={() => update((d) => ({ ...d, cycle: saveBuddyIntro(d.cycle, name, emoji, introNote) }))} />
          </View>
        }
      >
        <T style={{ marginBottom: 8 }}>Cycle works on its own. A buddy is only a name for reminders. You can change this note.</T>
        <Field label="Note" testID="cycle-buddy-intro-note" value={introNote} onChangeText={setIntroNote} />
        <Field label="Name" testID="cycle-buddy-intro-name" value={name} onChangeText={setName} placeholder="Optional" autoCapitalize="words" />
      </Sheet>
      <Sheet visible={buddyOpen} onClose={() => setBuddyOpen(false)} title="Buddy" testID="cycle-buddy-sheet" footer={<Button label="Save" testID="cycle-buddy-save" onPress={saveBuddy} />}>
        <Field label="Name" testID="cycle-buddy-name" value={name} onChangeText={setName} placeholder="Mango" autoCapitalize="words" />
        <T muted style={{ marginBottom: 8 }}>This picture stays in the app. A reminder only says the name.</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {BUDDY_EMOJIS.map((item) => {
            const onEmoji = item === emoji;
            return (
              <Press key={item} testID={`cycle-emoji-${item}`} onPress={() => setEmoji(item)} style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: onEmoji ? colors.brandTertiary : colors.surfaceSecondary, borderWidth: 1, borderColor: onEmoji ? colors.brandPrimary : colors.border }}>
                <Text style={{ fontSize: 26 }}>{item}</Text>
              </Press>
            );
          })}
        </View>
        <Card style={{ marginTop: 12 }}>
          <T muted>The lock screen, if you turn a reminder on, says “{buddyTitle(name) || "Name needs attention"}”. No date and no detail.</T>
        </Card>
      </Sheet>
      <ModuleGate id="cycle" name="Cycle" icon="calendar-blank-outline" />
    </View>
  );
}
