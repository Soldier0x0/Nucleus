import React, { useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { doseStatus, logDose, medicineProblem, medTime, newMedicine, parseTimes, removeMedicine, upsertMedicine } from "@/src/core/medicines";
import { requestPermission } from "@/src/core/notify";
import { todayISO } from "@/src/core/format";
import type { Medicine } from "@/src/core/types";
import { Header } from "@/src/components/Header";
import { Button, Card, EmptyState, IconButton, T } from "@/src/components/ui";
import { Field } from "@/src/components/inputs";
import { Sheet } from "@/src/components/Sheet";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { ModuleGate } from "@/src/components/ModuleGate";
import { useToast } from "@/src/components/Toast";
import { useRealSession } from "@/src/components/useRealSession";

type Draft = { id?: string; name: string; times: string; dose: string; notes: string };

/** Medicine reminders: a name and daily times are required. Taken and skipped are kept as a log. */
export default function MedicinesScreen() {
  const real = useRealSession();
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState<Medicine | null>(null);
  const today = todayISO();
  const sw = { trackColor: { true: colors.brandPrimary, false: colors.surfaceTertiary }, thumbColor: colors.surfaceSecondary };

  if (!real) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const save = async () => {
    if (!draft) return;
    const problem = medicineProblem(draft.name, draft.times);
    if (problem) return setError(problem);
    const times = parseTimes(draft.times) ?? [];
    const base = draft.id ? db.medicines.find((m) => m.id === draft.id) : undefined;
    const row: Medicine = base ? { ...base, name: draft.name.trim(), times, dose: draft.dose.trim() || undefined, notes: draft.notes.trim() || undefined } : newMedicine(draft.name, times, draft.dose, draft.notes);
    update((d) => upsertMedicine(d, row));
    setDraft(null);
    const perm = await requestPermission().catch(() => null);
    toast(perm?.granted ? "Medicine saved" : "Saved. Notifications are off, so reminders will not ring", perm?.granted ? "pill" : "bell-off-outline");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="medicines-screen">
      <Header title="Medicines" testID="medicines-header" right={<IconButton icon="plus" label="Add medicine" testID="medicine-add-button" onPress={() => (setError(undefined), setDraft({ name: "", times: "08:00", dose: "", notes: "" }))} />} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: sp.md, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {db.medicines.length === 0 ? (
          <EmptyState
            testID="medicines-empty"
            icon="pill"
            title="No medicines yet"
            body="Add a name and the times you take it. A reminder rings each day at those times."
            action={<Button label="Add a medicine" icon="plus" testID="medicines-empty-add" onPress={() => (setError(undefined), setDraft({ name: "", times: "08:00", dose: "", notes: "" }))} />}
          />
        ) : null}
        {db.medicines.map((m) => (
          <Card key={m.id} testID={`medicine-card-${m.id}`}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="h2" numberOfLines={1}>{m.name}</T>
                {m.dose ? <T muted numberOfLines={1}>{m.dose}</T> : null}
              </View>
              <Switch testID={`medicine-active-${m.id}`} value={m.active} onValueChange={(active) => update((d) => upsertMedicine(d, { ...m, active }))} {...sw} />
              <IconButton icon="pencil-outline" label="Edit" testID={`medicine-edit-${m.id}`} onPress={() => (setError(undefined), setDraft({ id: m.id, name: m.name, times: m.times.map(medTime).join(", "), dose: m.dose ?? "", notes: m.notes ?? "" }))} />
            </View>
            <View style={{ gap: 6, marginTop: 10 }}>
              {m.times.map((t) => {
                const time = medTime(t);
                const status = doseStatus(m, today, time);
                return (
                  <View key={time} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <T v="mono" style={{ width: 56 }}>{time}</T>
                    <T muted style={{ flex: 1 }} testID={`medicine-status-${m.id}-${time}`}>{status === "taken" ? "Taken today" : status === "skipped" ? "Skipped today" : "Today"}</T>
                    <Button small kind={status === "taken" ? "primary" : "secondary"} label="Taken" testID={`medicine-taken-${m.id}-${time}`} onPress={() => update((d) => logDose(d, m.id, today, time, "taken"))} />
                    <Button small kind="ghost" label="Skip" testID={`medicine-skip-${m.id}-${time}`} onPress={() => update((d) => logDose(d, m.id, today, time, "skipped"))} />
                  </View>
                );
              })}
            </View>
          </Card>
        ))}
      </ScrollView>

      {draft ? (
        <Sheet visible onClose={() => setDraft(null)} title={draft.id ? "Edit medicine" : "Add medicine"} testID="medicine-sheet" footer={<Button label="Save medicine" icon="check" testID="medicine-save-button" onPress={() => save().catch(() => toast("Could not save"))} />}>
          <Field label="Name" testID="medicine-name-input" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="Vitamin D" />
          <Field label="Times" testID="medicine-times-input" value={draft.times} onChangeText={(times) => setDraft({ ...draft, times })} placeholder="08:00, 21:00" hint="24-hour, separated by commas" />
          <Field label="Dose" testID="medicine-dose-input" value={draft.dose} onChangeText={(dose) => setDraft({ ...draft, dose })} placeholder="Optional, e.g. 1 tablet" />
          <Field label="Notes" testID="medicine-notes-input" value={draft.notes} onChangeText={(notes) => setDraft({ ...draft, notes })} placeholder="Optional" multiline />
          {error ? <T testID="medicine-error" color={colors.error} style={{ marginBottom: 8 }}>{error}</T> : null}
          {draft.id ? (
            <Button kind="ghost" label="Delete medicine" icon="delete-outline" testID="medicine-sheet-delete" onPress={() => {
              const row = db.medicines.find((m) => m.id === draft.id) ?? null;
              setDraft(null);
              setDeleting(row);
            }} />
          ) : null}
        </Sheet>
      ) : null}

      <ConfirmSheet
        visible={!!deleting}
        id="medicine-delete"
        title="Delete medicine?"
        body={deleting ? `“${deleting.name}” and its reminders will be removed.` : ""}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) update((d) => removeMedicine(d, deleting.id));
          setDeleting(null);
          toast("Medicine deleted", "delete-outline");
        }}
      />
      <ModuleGate id="health" name="Health" icon="pill" />
    </View>
  );
}
