import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { PAPER_KINDS } from "@/src/core/life";
import type { Paper, Person } from "@/src/core/types";
import { daysBetween, fmtDate, todayISO, uid } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Button, Card, Chip, ChipRow, EmptyState, Eyebrow, IconButton, StatusBadge, T } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { DateField, Field } from "@/src/components/inputs";
import { PhotoNote } from "@/src/components/PhotoPick";
import { useToast } from "@/src/components/Toast";
import { ModuleGate } from "@/src/components/ModuleGate";

export default function Papers() {
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const [edit, setEdit] = useState<Paper | "new" | null>(null);
  const [person, setPerson] = useState<Person | "new" | null>(null);
  const today = todayISO();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Papers" testID="papers-header" right={<IconButton icon="plus" label="Add paper" testID="papers-add" onPress={() => setEdit("new")} />} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <Card testID="papers-people">
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Eyebrow style={{ flex: 1 }}>Household</Eyebrow>
            <IconButton icon="plus" label="Add person" testID="people-add" onPress={() => setPerson("new")} />
          </View>
          <T muted style={{ fontSize: 12, marginBottom: 8 }}>Names for chores and for whose paper this is. Nothing is read from your contacts.</T>
          {db.people.length === 0 ? <T muted>No one added yet.</T> : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {db.people.map((p) => (
                <Chip key={p.id} label={p.name} testID={`person-${p.id}`} onPress={() => setPerson(p)} />
              ))}
            </View>
          )}
        </Card>
        {db.papers.length === 0 ? (
          <EmptyState testID="papers-empty" icon="file-document-outline" title="No papers yet" body="A driving licence, RC, insurance page or passport. The date feeds Attention. The photo stays on this phone." action={<Button label="Add a paper" icon="plus" testID="papers-empty-add" onPress={() => setEdit("new")} />} />
        ) : (
          db.papers.map((p) => {
            const days = p.expiry ? daysBetween(today, p.expiry) : undefined;
            const who = db.people.find((x) => x.id === p.personId)?.name;
            return (
              <Card key={p.id} testID={`paper-${p.id}`} onPress={() => setEdit(p)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <T v="h2" numberOfLines={1}>{p.title}</T>
                    <T muted style={{ fontSize: 12 }} numberOfLines={1}>{[PAPER_KINDS.find((k) => k.id === p.kind)?.label, who, p.number].filter(Boolean).join(" · ")}</T>
                  </View>
                  {days !== undefined ? <StatusBadge severity={days < 0 ? "urgent" : days <= 30 ? "upcoming" : "ok"} /> : null}
                </View>
                {p.expiry ? <T v="mono" style={{ marginTop: 8 }}>{days !== undefined && days < 0 ? `Expired ${fmtDate(p.expiry)}` : fmtDate(p.expiry)}</T> : null}
              </Card>
            );
          })
        )}
      </ScrollView>
      {edit ? <PaperSheet paper={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} /> : null}
      {person ? <PersonSheet person={person === "new" ? undefined : person} onClose={() => setPerson(null)} /> : null}
      <ModuleGate id="papers" name="Papers" icon="file-document-outline" />
    </View>
  );
}

function PersonSheet({ person, onClose }: { person?: Person; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [name, setName] = useState(person?.name ?? "");
  const [note, setNote] = useState(person?.note ?? "");
  const save = () => {
    if (!name.trim()) return toast("Add a name", "account-outline");
    const next: Person = { id: person?.id ?? uid(), name: name.trim(), note: note.trim() || undefined };
    update((d) => ({ ...d, people: d.people.some((p) => p.id === next.id) ? d.people.map((p) => (p.id === next.id ? next : p)) : [...d.people, next] }));
    toast(person ? "Updated" : "Added", "account-outline");
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title={person ? "Person" : "Add a person"} testID="person-sheet" footer={<Button label="Save" icon="check" testID="person-save" onPress={save} />}>
      <Field label="Name" testID="person-name" value={name} onChangeText={setName} placeholder="A name in the house" />
      <Field label="Note" testID="person-note" value={note} onChangeText={setNote} placeholder="Optional" />
      {person ? (
        <Button kind="danger" label="Remove" testID="person-delete" onPress={() => { update((d) => ({ ...d, people: d.people.filter((p) => p.id !== person.id) })); onClose(); }} />
      ) : null}
    </Sheet>
  );
}

function PaperSheet({ paper, onClose }: { paper?: Paper; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [f, setF] = useState({
    kind: paper?.kind ?? ("licence" as Paper["kind"]),
    title: paper?.title ?? "",
    number: paper?.number ?? "",
    expiry: paper?.expiry,
    note: paper?.note ?? "",
    photo: paper?.photo,
    personId: paper?.personId,
    vehicleId: paper?.vehicleId,
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = () => {
    if (!f.title.trim()) return toast("Name the paper", "file-document-outline");
    const next: Paper = {
      id: paper?.id ?? uid(),
      createdAt: paper?.createdAt ?? new Date().toISOString(),
      kind: f.kind,
      title: f.title.trim(),
      number: f.number.trim() || undefined,
      expiry: f.expiry,
      note: f.note.trim() || undefined,
      photo: f.photo,
      personId: f.personId,
      vehicleId: f.vehicleId,
    };
    update((d) => ({ ...d, papers: d.papers.some((p) => p.id === next.id) ? d.papers.map((p) => (p.id === next.id ? next : p)) : [next, ...d.papers] }));
    toast(paper ? "Paper updated" : "Paper saved", "file-document-outline");
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title={paper ? "Edit paper" : "Add paper"} testID="paper-sheet" footer={<Button label="Save paper" icon="check" testID="paper-save" onPress={save} />}>
      <ChipRow testID="paper-kind-row">
        {PAPER_KINDS.map((k) => (
          <Chip key={k.id} label={k.label} selected={f.kind === k.id} testID={`paper-kind-${k.id}`} onPress={() => set({ kind: k.id, title: f.title || k.label })} />
        ))}
      </ChipRow>
      <Field label="Title" testID="paper-title" value={f.title} onChangeText={(t) => set({ title: t })} placeholder="Driving licence" />
      <Field label="Number" testID="paper-number" value={f.number} onChangeText={(t) => set({ number: t })} placeholder="Optional" autoCapitalize="characters" />
      <DateField label="Expiry" optional testID="paper-expiry" value={f.expiry} onChange={(v) => set({ expiry: v })} />
      {db.people.length ? (
        <>
          <Eyebrow style={{ marginBottom: 8 }}>Whose</Eyebrow>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {db.people.map((p) => (
              <Chip key={p.id} label={p.name} selected={f.personId === p.id} testID={`paper-person-${p.id}`} onPress={() => set({ personId: f.personId === p.id ? undefined : p.id })} />
            ))}
          </View>
        </>
      ) : null}
      {db.vehicles.length ? (
        <>
          <Eyebrow style={{ marginBottom: 8 }}>Vehicle</Eyebrow>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {db.vehicles.map((v) => (
              <Chip key={v.id} label={v.name} selected={f.vehicleId === v.id} testID={`paper-vehicle-${v.id}`} onPress={() => set({ vehicleId: f.vehicleId === v.id ? undefined : v.id })} />
            ))}
          </View>
        </>
      ) : null}
      <Field label="Note" testID="paper-note" value={f.note} onChangeText={(t) => set({ note: t })} placeholder="Optional" />
      <PhotoNote uri={f.photo} onChange={(photo) => set({ photo })} testID="paper-photo" />
      {paper ? <Button kind="danger" label="Delete paper" testID="paper-delete" onPress={() => { update((d) => ({ ...d, papers: d.papers.filter((p) => p.id !== paper.id) })); onClose(); }} /> : null}
    </Sheet>
  );
}
