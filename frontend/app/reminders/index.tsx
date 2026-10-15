import React, { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { newReminder, overdueReminders, REMINDER_SNOOZE, reminderAt, reminderProblem, removeReminder, setReminderDone, snoozeReminder, upsertReminder } from "@/src/core/reminders";
import { requestPermission } from "@/src/core/notify";
import { todayISO } from "@/src/core/format";
import type { PlainReminder, ReminderAttachKind } from "@/src/core/types";
import { Header } from "@/src/components/Header";
import { Button, Card, Chip, ChipRow, EmptyState, Eyebrow, IconButton, T } from "@/src/components/ui";
import { DateField, Field, TimeField } from "@/src/components/inputs";
import { Sheet } from "@/src/components/Sheet";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { useToast } from "@/src/components/Toast";
import { useRealSession } from "@/src/components/useRealSession";

type Draft = { id?: string; title: string; note: string; date?: string; time: string; attach: PlainReminder["attach"] };

function attachLabel(kind: ReminderAttachKind): string {
  switch (kind) {
    case "paper":
      return "Document";
    case "subscription":
      return "Bill";
    case "medicine":
      return "Medicine";
    case "vehicle":
      return "Vehicle";
    default:
      return "Plain";
  }
}

/** v0.9.8 reminders: a title, a date and time, an optional note, snooze, and an optional record it belongs to. */
export default function RemindersScreen() {
  const real = useRealSession();
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ attachKind?: string; attachId?: string; title?: string }>();
  const [draft, setDraft] = useState<Draft | null>(() =>
    params.attachKind && params.attachId
      ? { title: typeof params.title === "string" ? params.title : "", note: "", date: todayISO(), time: "09:00", attach: { kind: params.attachKind as ReminderAttachKind, id: params.attachId } }
      : null,
  );
  const [error, setError] = useState<string>();
  const [snoozing, setSnoozing] = useState<PlainReminder | null>(null);
  const [deleting, setDeleting] = useState<PlainReminder | null>(null);

  const now = Date.now();
  const overdueIds = useMemo(() => new Set(overdueReminders(db, now).map((r) => r.id)), [db, now]);
  const open = useMemo(() => db.reminders.filter((r) => !r.done).sort((a, b) => reminderAt(a).getTime() - reminderAt(b).getTime()), [db.reminders]);
  const done = useMemo(() => db.reminders.filter((r) => r.done).slice(0, 20), [db.reminders]);

  if (!real) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const startNew = () => {
    setError(undefined);
    setDraft({ title: "", note: "", date: todayISO(), time: "09:00", attach: { kind: "plain" } });
  };
  const edit = (r: PlainReminder) => {
    setError(undefined);
    setDraft({ id: r.id, title: r.title, note: r.note ?? "", date: r.date, time: r.time, attach: r.attach });
  };
  const save = async () => {
    if (!draft) return;
    const problem = reminderProblem(draft);
    if (problem) return setError(problem);
    const base = draft.id ? db.reminders.find((r) => r.id === draft.id) : undefined;
    const row: PlainReminder = base
      ? { ...base, title: draft.title.trim(), note: draft.note.trim() || undefined, date: draft.date as string, time: draft.time, snoozeUntil: undefined, done: false }
      : newReminder({ title: draft.title, note: draft.note, date: draft.date as string, time: draft.time, attach: draft.attach });
    update((d) => upsertReminder(d, row));
    setDraft(null);
    const perm = await requestPermission().catch(() => null);
    toast(perm?.granted ? "Reminder saved" : "Saved. Notifications are off, so it shows here only", perm?.granted ? "bell-check-outline" : "bell-off-outline");
  };

  const when = (r: PlainReminder) => {
    const at = reminderAt(r);
    const label = at.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: db.settings.timeFormat === "12h" });
    return r.snoozeUntil && new Date(r.snoozeUntil).getTime() > now ? `Snoozed to ${label}` : label;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="reminders-screen">
      <Header title="Reminders" testID="reminders-header" right={<IconButton icon="plus" label="New reminder" testID="reminder-add-button" onPress={startNew} />} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: sp.md, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {open.length === 0 && done.length === 0 ? (
          <EmptyState
            testID="reminders-empty"
            icon="bell-ring-outline"
            title="No reminders yet"
            body="Call the dentist, renew a policy, pay a bill. A reminder can belong to a document or bill, and goes when that record is deleted."
            action={<Button label="Add a reminder" icon="plus" testID="reminders-empty-add" onPress={startNew} />}
          />
        ) : null}
        {open.map((r) => (
          <Card key={r.id} testID={`reminder-card-${r.id}`} onPress={() => edit(r)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <T v="h2" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{r.title}</T>
              {r.attach.kind !== "plain" ? <T v="caption" muted>{attachLabel(r.attach.kind)}</T> : null}
            </View>
            <T testID={`reminder-when-${r.id}`} color={overdueIds.has(r.id) ? colors.error : undefined} muted={!overdueIds.has(r.id)} style={{ marginTop: 4 }}>
              {overdueIds.has(r.id) ? `Was due ${when(r)}` : when(r)}
            </T>
            {r.note ? <T muted numberOfLines={2} style={{ marginTop: 4 }}>{r.note}</T> : null}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Button small label="Done" icon="check" testID={`reminder-done-${r.id}`} onPress={() => (update((d) => setReminderDone(d, r.id, true)), toast("Marked done", "check"))} />
              <Button small kind="secondary" label="Snooze" icon="alarm-snooze" testID={`reminder-snooze-${r.id}`} onPress={() => setSnoozing(r)} />
            </View>
          </Card>
        ))}
        {done.length ? <Eyebrow style={{ marginTop: 8 }}>Done</Eyebrow> : null}
        {done.map((r) => (
          <Card key={r.id} testID={`reminder-done-card-${r.id}`}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <T numberOfLines={1} muted style={{ flex: 1, minWidth: 0, textDecorationLine: "line-through" }}>{r.title}</T>
              <Button small kind="ghost" label="Undo" testID={`reminder-undo-${r.id}`} onPress={() => update((d) => setReminderDone(d, r.id, false))} />
              <Button small kind="ghost" label="Delete" testID={`reminder-delete-${r.id}`} onPress={() => setDeleting(r)} />
            </View>
          </Card>
        ))}
      </ScrollView>

      {draft ? (
        <Sheet
          visible
          onClose={() => setDraft(null)}
          title={draft.id ? "Edit reminder" : "New reminder"}
          testID="reminder-sheet"
          footer={<Button label="Save reminder" icon="check" testID="reminder-save-button" onPress={() => save().catch(() => toast("Could not save"))} />}
        >
          <Field label="Title" testID="reminder-title-input" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} placeholder="Call the dentist" />
          <DateField label="Date" testID="reminder-date" value={draft.date} onChange={(date) => setDraft({ ...draft, date })} />
          <TimeField label="Time" testID="reminder-time-input" value={draft.time} onChange={(time) => setDraft({ ...draft, time })} />
          <Field label="Note" testID="reminder-note-input" value={draft.note} onChangeText={(note) => setDraft({ ...draft, note })} placeholder="Optional" multiline />
          {draft.attach.kind !== "plain" ? <T muted style={{ marginBottom: 8 }}>Belongs to a {attachLabel(draft.attach.kind).toLowerCase()}. Deleting that record removes this reminder.</T> : null}
          {error ? <T testID="reminder-error" color={colors.error} style={{ marginBottom: 8 }}>{error}</T> : null}
          {draft.id ? (
            <Button kind="ghost" label="Delete reminder" icon="delete-outline" testID="reminder-sheet-delete" onPress={() => {
              const row = db.reminders.find((r) => r.id === draft.id) ?? null;
              setDraft(null);
              setDeleting(row);
            }} />
          ) : null}
        </Sheet>
      ) : null}

      <Sheet visible={!!snoozing} onClose={() => setSnoozing(null)} title="Snooze for" testID="reminder-snooze-sheet">
        <ChipRow testID="reminder-snooze-row">
          {REMINDER_SNOOZE.map((choice) => (
            <Chip key={choice.label} label={choice.label} testID={`reminder-snooze-${choice.ms}`} onPress={() => {
              if (snoozing) update((d) => snoozeReminder(d, snoozing.id, choice.ms));
              setSnoozing(null);
              toast(`Snoozed ${choice.label}`, "alarm-snooze");
            }} />
          ))}
        </ChipRow>
      </Sheet>

      <ConfirmSheet
        visible={!!deleting}
        id="reminder-delete"
        title="Delete reminder?"
        body={deleting ? `“${deleting.title}” will be removed.` : ""}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) update((d) => removeReminder(d, deleting.id));
          setDeleting(null);
          toast("Reminder deleted", "delete-outline");
        }}
      />
    </View>
  );
}
