import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { uid } from "@/src/core/format";
import type { KanbanBoard, KanbanCard } from "@/src/core/types";
import { Header } from "@/src/components/Header";
import { Button, Card, EmptyState, Eyebrow, IconButton, T } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { Field } from "@/src/components/inputs";
import { ModuleGate } from "@/src/components/ModuleGate";

const fresh = (name: string): KanbanBoard => {
  const columns = ["To do", "Doing", "Done"].map((label, order) => ({ id: uid(), name: label, order }));
  return { id: uid(), name, columns, cards: [], createdAt: new Date().toISOString() };
};

export default function Kanban() {
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [card, setCard] = useState<KanbanCard | null>(null);
  const [cardTitle, setCardTitle] = useState("");
  const [renaming, setRenaming] = useState<KanbanBoard | null>(null);
  const [renameName, setRenameName] = useState("");
  const [delBoard, setDelBoard] = useState<KanbanBoard | null>(null);
  const board = db.kanban.find((b) => b.id === boardId) ?? null;

  const save = (next: KanbanBoard) => update((d) => ({ ...d, kanban: d.kanban.map((b) => (b.id === next.id ? next : b)) }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header
        title={board ? board.name : "Kanban"}
        testID="kanban-header"
        right={board ? <IconButton icon="plus" label="Add card" testID="kanban-add-card" onPress={() => save(addCard(board, board.columns[0]?.id))} /> : <IconButton icon="plus" label="New board" testID="kanban-add-board" onPress={() => (setName(""), setCreating(true))} />}
      />
      {!board ? (
        <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
          {db.kanban.length === 0 ? (
            <EmptyState testID="kanban-empty" icon="view-column-outline" title="No boards yet" body="A board is columns of cards. It stays on this phone." action={<Button label="New board" icon="plus" testID="kanban-empty-add" onPress={() => setCreating(true)} />} />
          ) : (
            db.kanban.map((b) => (
              <View key={b.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Card style={{ flex: 1 }} testID={`kanban-board-${b.id}`} onPress={() => setBoardId(b.id)}>
                  <T v="h2">{b.name}</T>
                  <T muted style={{ marginTop: 4 }}>{b.cards.length} cards · {b.columns.length} columns</T>
                </Card>
                <IconButton icon="pencil-outline" label={`Rename ${b.name}`} testID={`kanban-rename-${b.id}`} onPress={() => (setRenameName(b.name), setRenaming(b))} />
                <IconButton icon="delete-outline" label={`Delete ${b.name}`} testID={`kanban-delete-${b.id}`} onPress={() => setDelBoard(b)} />
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView horizontal contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12 }}>
          {board.columns.map((column) => {
            const cards = board.cards.filter((c) => c.columnId === column.id).sort((a, b) => a.order - b.order);
            return (
              <View key={column.id} style={{ width: 240, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 10 }}>
                <Eyebrow>{column.name}</Eyebrow>
                {cards.map((card) => (
                  <Card key={card.id} testID={`kanban-card-${card.id}`} style={{ marginTop: 8, padding: 10 }} onPress={() => (setCard(card), setCardTitle(card.title))}>
                    <T v="label">{card.title}</T>
                    {card.note ? <T muted style={{ fontSize: 12, marginTop: 4 }}>{card.note}</T> : null}
                  </Card>
                ))}
                <Button kind="ghost" small label="Add card" testID={`kanban-add-${column.id}`} onPress={() => save(addCard(board, column.id))} />
              </View>
            );
          })}
        </ScrollView>
      )}
      <Sheet visible={creating} onClose={() => setCreating(false)} title="New board" testID="kanban-new" footer={<Button label="Create" testID="kanban-create" disabled={!name.trim()} onPress={() => { const next = fresh(name.trim()); update((d) => ({ ...d, kanban: [...d.kanban, next] })); setBoardId(next.id); setCreating(false); }} />}>
        <Field label="Name" value={name} onChangeText={setName} testID="kanban-name" />
      </Sheet>
      <Sheet visible={!!renaming} onClose={() => setRenaming(null)} title="Rename board" testID="kanban-rename-sheet" footer={<Button label="Save" testID="kanban-rename-save" disabled={!renameName.trim()} onPress={() => { if (renaming) save({ ...renaming, name: renameName.trim() }); setRenaming(null); }} />}>
        <Field label="Name" value={renameName} onChangeText={setRenameName} testID="kanban-rename-input" />
      </Sheet>
      <Sheet visible={!!delBoard} onClose={() => setDelBoard(null)} title="Delete this board?" testID="kanban-delete-sheet">
        <T style={{ marginBottom: 16 }}>"{delBoard?.name ?? ""}" will be removed, along with its {delBoard?.columns.length ?? 0} columns and {delBoard?.cards.length ?? 0} cards.</T>
        <Button
          kind="danger"
          label="Delete board"
          icon="delete-outline"
          testID="kanban-delete-confirm"
          onPress={() => {
            if (delBoard) update((d) => ({ ...d, kanban: d.kanban.filter((b) => b.id !== delBoard.id) }));
            if (boardId === delBoard?.id) setBoardId(null);
            setDelBoard(null);
          }}
        />
      </Sheet>
      <Sheet
        visible={!!card && !!board}
        onClose={() => setCard(null)}
        title="Card"
        testID="kanban-card-sheet"
        footer={
          <Button
            label="Save"
            testID="kanban-card-save"
            disabled={!cardTitle.trim() || !board || !card}
            onPress={() => {
              if (!board || !card) return;
              save({ ...board, cards: board.cards.map((c) => (c.id === card.id ? { ...c, title: cardTitle.trim() } : c)) });
              setCard(null);
            }}
          />
        }
      >
        <Field label="Title" value={cardTitle} onChangeText={setCardTitle} testID="kanban-card-title" />
        <Button kind="secondary" label="Move to the next column" testID="kanban-card-move" onPress={() => { if (board && card) { const next = moveCard(board, card); save(next); setCard(next.cards.find((c) => c.id === card.id) ?? null); } }} />
        <Button kind="danger" label="Delete card" testID="kanban-card-delete" onPress={() => { if (board && card) { save({ ...board, cards: board.cards.filter((c) => c.id !== card.id) }); setCard(null); } }} />
      </Sheet>
      <ModuleGate id="kanban" name="Kanban" icon="view-column-outline" />
    </View>
  );
}

function addCard(board: KanbanBoard, columnId?: string): KanbanBoard {
  if (!columnId) return board;
  const order = board.cards.filter((c) => c.columnId === columnId).length;
  const card: KanbanCard = { id: uid(), columnId, title: "New card", note: "", order };
  return { ...board, cards: [...board.cards, card] };
}

function moveCard(board: KanbanBoard, card: KanbanCard): KanbanBoard {
  const columns = [...board.columns].sort((a, b) => a.order - b.order);
  const index = columns.findIndex((c) => c.id === card.columnId);
  const next = columns[(index + 1) % columns.length];
  if (!next) return board;
  return { ...board, cards: board.cards.map((c) => (c.id === card.id ? { ...c, columnId: next.id } : c)) };
}
