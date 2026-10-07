import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { removePaper } from "@/src/core/actions";
import { missingDocumentNames } from "@/src/core/documents";
import { PAPER_KINDS } from "@/src/core/life";
import type { Paper, Person } from "@/src/core/types";
import { daysBetween, fmtDate, todayISO, uid } from "@/src/core/format";
import { paperAttachmentUri } from "@/src/core/paperFiles";
import { Header } from "@/src/components/Header";
import { Button, Card, Chip, EmptyState, Eyebrow, IconButton, StatusBadge, T } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { Field } from "@/src/components/inputs";
import { paperBadgeForRow } from "@/src/components/PaperAttach";
import { DocViewer } from "@/src/components/DocViewer";
import { PaperSheet } from "@/src/components/PaperSheet";
import { useToast } from "@/src/components/Toast";
import { ModuleGate } from "@/src/components/ModuleGate";

export default function Papers() {
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [edit, setEdit] = useState<Paper | "new" | null>(null);
  const [person, setPerson] = useState<Person | "new" | null>(null);
  const [preview, setPreview] = useState<Paper | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Paper | null>(null);
  const today = todayISO();
  const missing = missingDocumentNames(db);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Documents" testID="papers-header" right={<IconButton icon="plus" label="Add paper" testID="papers-add" onPress={() => setEdit("new")} />} />
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
        {missing.length ? (
          <Card testID="documents-missing">
            <Eyebrow>Missing</Eyebrow>
            {missing.map((name, index) => (
              <T key={`${name}-${index}`}>{name}</T>
            ))}
          </Card>
        ) : null}
        {db.papers.length === 0 ? (
          <EmptyState testID="papers-empty" icon="file-document-outline" title="No papers yet" body="A driving licence, RC, insurance page or passport. The date feeds Attention. The file stays on this phone." action={<Button label="Add a paper" icon="plus" testID="papers-empty-add" onPress={() => setEdit("new")} />} />
        ) : (
          db.papers.map((p) => {
            const days = p.expiry ? daysBetween(today, p.expiry) : undefined;
            const who = db.people.find((x) => x.id === p.personId)?.name;
            const badge = paperBadgeForRow(p);
            const open = () => {
              if (paperAttachmentUri(p)) setPreview(p);
              else setEdit(p);
            };
            return (
              <Card key={p.id} testID={`paper-${p.id}`} onPress={open}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <T v="h2" numberOfLines={1}>{p.title}</T>
                    <T muted style={{ fontSize: 12 }} numberOfLines={1}>{[PAPER_KINDS.find((k) => k.id === p.kind)?.label, who, p.number, badge].filter(Boolean).join(" · ")}</T>
                  </View>
                  <IconButton icon="pencil-outline" label="Edit paper" testID={`paper-edit-${p.id}`} onPress={() => setEdit(p)} />
                  <IconButton icon="delete-outline" label="Delete paper" testID={`paper-list-delete-${p.id}`} onPress={() => setDeleteTarget(p)} />
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
      {preview ? (
        <DocViewer
          paper={preview}
          visible
          onClose={() => setPreview(null)}
          onEdit={() => {
            setPreview(null);
            setEdit(preview);
          }}
          onDelete={() => {
            update((d) => removePaper(d, preview.id));
            toast("Paper deleted", "delete-outline");
          }}
        />
      ) : null}
      <Sheet visible={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete this paper?" testID="paper-list-delete-sheet">
        <T style={{ marginBottom: 16 }}>The file and expiry reminders for this document will be removed from Nucleus.</T>
        <Button
          kind="danger"
          label="Delete paper"
          icon="delete-outline"
          testID="paper-list-delete-confirm"
          onPress={() => {
            if (!deleteTarget) return;
            update((d) => removePaper(d, deleteTarget.id));
            setDeleteTarget(null);
            toast("Paper deleted", "delete-outline");
          }}
        />
      </Sheet>
      <ModuleGate id="papers" name="Documents" icon="file-document-outline" />
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
