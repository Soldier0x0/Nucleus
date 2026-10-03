import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { deleteEntity, linkedRefs } from "@/src/core/actions";
import type { ChecklistItem, Note } from "@/src/core/types";
import { uid } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Button, Card, Chip, EmptyState, Eyebrow, Icon, IconButton, Press, T } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { Field } from "@/src/components/inputs";
import { LinkedSection } from "@/src/components/LinkedSection";
import { useToast } from "@/src/components/Toast";
import { ModuleGate } from "@/src/components/ModuleGate";
import { adhdOpen, typeAdhdDraft } from "@/src/core/presets";

const emptyNote = (): Note => ({ id: uid(), title: "", body: "", checklist: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

export default function Notes() {
  const { db } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string; field?: string; seed?: string }>();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Note | null>(() => {
    const found = params.id ? db.notes.find((n) => n.id === params.id) ?? null : null;
    const seed = typeof params.seed === "string" ? params.seed : "";
    if (found && params.field === "body" && !found.body && seed) return { ...found, body: seed };
    return found;
  });

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...db.notes]
      .filter((n) => !s || n.title.toLowerCase().includes(s) || n.body.toLowerCase().includes(s) || n.checklist.some((c) => c.text.toLowerCase().includes(s)))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  }, [db.notes, q]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Notes & Lists" testID="notes-header" right={<IconButton icon="plus" label="New note" testID="note-add-button" onPress={() => setEdit(emptyNote())} />} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: sp.md, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {db.notes.length > 3 ? (
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong }]}>
            <Icon name="magnify" size={18} color={colors.muted} />
            <TextInput testID="notes-search-input" value={q} onChangeText={setQ} placeholder="Search notes" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.onSurface, height: 44 }} />
          </View>
        ) : null}
        {list.length === 0 ? (
          <EmptyState
            testID="notes-empty"
            icon="note-text-outline"
            title={db.notes.length ? "Nothing matches" : "No notes yet"}
            body={db.notes.length ? "Try a different word." : "Keep a checklist, a serial number or anything you want attached to a record."}
            action={db.notes.length ? undefined : <Button label="Write a note" icon="plus" testID="notes-empty-add" onPress={() => setEdit(emptyNote())} />}
          />
        ) : (
          list.map((n) => {
            const done = n.checklist.filter((c) => c.done).length;
            const links = linkedRefs(db, { kind: "note", id: n.id }).length;
            return (
              <Card key={n.id} testID={`note-card-${n.id}`} onPress={() => setEdit(n)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <T v="h2" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
                    {n.title || "Untitled"}
                  </T>
                  {n.pinned ? <Icon name="pin" size={16} color={colors.brandPrimary} /> : null}
                </View>
                {n.body ? (
                  <T muted numberOfLines={2} style={{ marginTop: 4 }}>
                    {n.body}
                  </T>
                ) : null}
                {n.checklist.length ? (
                  <View style={{ marginTop: 8, gap: 4 }}>
                    {n.checklist.slice(0, 3).map((c) => (
                      <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Icon name={c.done ? "checkbox-marked-outline" : "checkbox-blank-outline"} size={16} color={c.done ? colors.success : colors.muted} />
                        <T numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 13, textDecorationLine: c.done ? "line-through" : "none" }}>
                          {c.text}
                        </T>
                      </View>
                    ))}
                  </View>
                ) : null}
                <T muted style={{ fontSize: 11, marginTop: 8 }}>
                  {n.checklist.length ? `${done}/${n.checklist.length} done · ` : ""}
                  {links ? `${links} linked · ` : ""}
                  {new Date(n.updatedAt).toLocaleDateString()}
                </T>
              </Card>
            );
          })
        )}
      </ScrollView>
      {edit ? <NoteSheet note={edit} onClose={() => setEdit(null)} onSaved={() => toast("Note saved", "note-text-outline")} /> : null}
      <ModuleGate id="notes" name="Notes" icon="note-text-outline" />
    </View>
  );
}

function NoteSheet({ note, onClose, onSaved }: { note: Note; onClose: () => void; onSaved: () => void }) {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note.checklist);
  const [item, setItem] = useState("");
  const [pinned, setPinned] = useState(!!note.pinned);
  const exists = db.notes.some((n) => n.id === note.id);

  const save = () => {
    const next: Note = { ...note, title: title.trim(), body, checklist, pinned, updatedAt: new Date().toISOString() };
    update((d) => ({ ...d, notes: exists ? d.notes.map((n) => (n.id === next.id ? next : n)) : [next, ...d.notes] }));
    onSaved();
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={exists ? "Edit note" : "New note"} testID="note-sheet" footer={<Button label="Save note" icon="check" testID="note-save-button" onPress={save} />}>
      <Field label="Title" testID="note-title-input" value={title} onChangeText={setTitle} placeholder="Wi-Fi password, packing ideas…" />
      <Field label="Note" testID="note-body-input" value={body} onChangeText={(value) => {
        setBody(value);
        update((current) => {
          const open = adhdOpen(current);
          if (!open || open.recordId !== note.id) return current;
          return typeAdhdDraft(current, value);
        });
      }} placeholder="Anything you want to remember" multiline style={{ minHeight: 90 }} />
      <Eyebrow style={{ marginBottom: 8 }}>Checklist · {checklist.filter((c) => c.done).length}/{checklist.length}</Eyebrow>
      {checklist.map((c) => (
        <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
          <Press testID={`note-check-${c.id}`} onPress={() => setChecklist(checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))}>
            <Icon name={c.done ? "checkbox-marked-outline" : "checkbox-blank-outline"} size={22} color={c.done ? colors.success : colors.muted} />
          </Press>
          <T style={{ flex: 1, minWidth: 0, textDecorationLine: c.done ? "line-through" : "none" }} numberOfLines={2}>
            {c.text}
          </T>
          <IconButton icon="close" label="Remove" testID={`note-check-remove-${c.id}`} onPress={() => setChecklist(checklist.filter((x) => x.id !== c.id))} />
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <Field style={{ flex: 1 }} label="Add item" testID="note-item-input" value={item} onChangeText={setItem} placeholder="Buy adapter" onSubmitEditing={() => item.trim() && (setChecklist([...checklist, { id: uid(), text: item.trim(), done: false }]), setItem(""))} />
        <Button small label="Add" icon="plus" testID="note-item-add" style={{ marginBottom: 12 }} onPress={() => item.trim() && (setChecklist([...checklist, { id: uid(), text: item.trim(), done: false }]), setItem(""))} />
      </View>
      <Chip label={pinned ? "Pinned to Today" : "Pin to Today"} icon={pinned ? "pin" : "pin-outline"} selected={pinned} testID="note-pin-chip" onPress={() => setPinned(!pinned)} />
      {exists ? (
        <>
          <LinkedSection refTo={{ kind: "note", id: note.id }} />
          <Button
            kind="danger"
            small
            icon="delete-outline"
            label="Delete note"
            testID="note-delete-button"
            style={{ marginTop: 16 }}
            onPress={() => {
              update((d) => deleteEntity(d, { kind: "note", id: note.id }));
              onClose();
            }}
          />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12 },
}));
