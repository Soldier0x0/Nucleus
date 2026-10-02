import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { TILE_META } from "@/src/core/modules";
import type { Board, TileId } from "@/src/core/types";
import { uid } from "@/src/core/format";
import { Button, Chip, Eyebrow, Icon, IconButton, T } from "./ui";
import { Sheet } from "./Sheet";
import { Field } from "./inputs";

const ICONS = ["view-dashboard-outline", "bag-suitcase-outline", "wallet-outline", "car-side", "home-outline", "chart-box-outline"];

const move = <T,>(arr: T[], i: number, dir: -1 | 1) => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const a = [...arr];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
};

/** Create or edit a custom board: a named, ordered subset of the Today tiles. */
export function BoardSheet({ board, onClose }: { board: Board | null; onClose: () => void }) {
  const { db, setSettings } = useStore();
  const { colors } = useTheme();
  const [name, setName] = useState(board?.name ?? "");
  const [icon, setIcon] = useState(board?.icon ?? ICONS[0]);
  const [tiles, setTiles] = useState<TileId[]>(board?.tiles ?? ["attention"]);
  const all = Object.keys(TILE_META) as TileId[];

  const save = () => {
    const next: Board = { id: board?.id ?? uid(), name: name.trim() || "Board", icon, tiles };
    const boards = board ? db.settings.boards.map((b) => (b.id === next.id ? next : b)) : [...db.settings.boards, next];
    setSettings({ boards, activeBoardId: next.id });
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={board ? "Edit board" : "New board"} testID="board-sheet" footer={<Button label={board ? "Save board" : "Create board"} icon="check" testID="board-save-button" onPress={save} />}>
      <Field label="Board name" testID="board-name-input" value={name} onChangeText={setName} placeholder="Goa trip, Month end…" />
      <T muted style={{ fontSize: 12, marginTop: -4, marginBottom: 8 }}>A board is temporary. Home stays as it is until you switch back.</T>
      <Eyebrow style={{ marginBottom: 8 }}>Icon</Eyebrow>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {ICONS.map((i) => (
          <Chip key={i} label="" icon={i} selected={icon === i} testID={`board-icon-${i}`} onPress={() => setIcon(i)} />
        ))}
      </View>
      <Eyebrow style={{ marginBottom: 8 }}>Tiles on this board · {tiles.length}</Eyebrow>
      <View style={[styles.list, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
        {tiles.map((t, i) => (
          <View key={t} testID={`board-tile-${t}`} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
            <Icon name={TILE_META[t].icon} size={18} color={colors.muted} />
            <T v="label" style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>
              {TILE_META[t].name}
            </T>
            <IconButton icon="arrow-up" label="Move up" testID={`board-tile-up-${t}`} onPress={() => setTiles(move(tiles, i, -1))} />
            <IconButton icon="arrow-down" label="Move down" testID={`board-tile-down-${t}`} onPress={() => setTiles(move(tiles, i, 1))} />
            <IconButton icon="close" label="Remove" testID={`board-tile-remove-${t}`} onPress={() => setTiles(tiles.filter((x) => x !== t))} />
          </View>
        ))}
        {tiles.length === 0 ? (
          <View style={styles.row}>
            <T muted>Add at least one tile.</T>
          </View>
        ) : null}
      </View>
      <Eyebrow style={{ marginTop: 16, marginBottom: 8 }}>Add a tile</Eyebrow>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {all
          .filter((t) => !tiles.includes(t))
          .map((t) => (
            <Chip key={t} label={TILE_META[t].name} icon={TILE_META[t].icon} testID={`board-add-tile-${t}`} onPress={() => setTiles([...tiles, t])} />
          ))}
      </View>
      {board ? (
        <Button
          kind="danger"
          small
          icon="delete-outline"
          label="Delete board"
          testID="board-delete-button"
          style={{ marginTop: 18 }}
          onPress={() => {
            setSettings({ boards: db.settings.boards.filter((b) => b.id !== board.id), activeBoardId: undefined });
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: radius.lg },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 4, minHeight: 52 },
});
