import { moveItem } from "./reorder";
import { applyTileOrder, customItems, presetItems, withModulesOn } from "./presets";
import type { DB, HomePresetId, TileId } from "./types";

export type TileBox = { x: number; y: number; w: number; h: number };

const PRESETS: HomePresetId[] = ["custom", "money", "travel", "home", "documents", "bills", "desk", "workshop", "adhd"];

/** A long press can move tiles on the boards the person arranges. Money, Travel, and Home stay fixed. */
export function homeBoardCanMove(preset: HomePresetId): boolean {
  switch (preset) {
    case "custom":
    case "desk":
    case "workshop":
      return true;
    case "money":
    case "travel":
    case "home":
    case "documents":
    case "bills":
    case "adhd":
      return false;
    default: {
      const unreachable: never = preset;
      return unreachable;
    }
  }
}

/**
 * Index of the tile under the finger, in the order on screen.
 * A point that is not inside another tile keeps the held tile where it is.
 */
export function homeDropIndex(from: number, point: { x: number; y: number }, frames: TileBox[]): number {
  if (frames.length <= 1) return Math.max(0, Math.min(Math.max(frames.length - 1, 0), from));
  let best = from;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < frames.length; i++) {
    if (i === from) continue;
    const frame = frames[i];
    if (!frame || frame.w <= 0 || frame.h <= 0) continue;
    const inside = point.x >= frame.x && point.x <= frame.x + frame.w && point.y >= frame.y && point.y <= frame.y + frame.h;
    if (!inside) continue;
    const dx = frame.x + frame.w / 2 - point.x;
    const dy = frame.y + frame.h / 2 - point.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

export function parseTileOrder(raw: unknown): Partial<Record<HomePresetId, string[]>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<HomePresetId, string[]>> = {};
  const record = raw as Record<string, unknown>;
  for (const preset of PRESETS) {
    const value = record[preset];
    if (!Array.isArray(value)) continue;
    const ids = value.filter((id): id is string => typeof id === "string").map((id) => id.slice(0, 40)).slice(0, 40);
    if (ids.length) out[preset] = ids;
  }
  return out;
}

function stitch(all: string[], visible: string[], nextVisible: string[]): string[] {
  const visibleSet = new Set(visible);
  let cursor = 0;
  return all.map((id) => {
    if (!visibleSet.has(id)) return id;
    const next = nextVisible[cursor];
    cursor += 1;
    return next ?? id;
  });
}

function moveVisible(ids: string[], id: string, to: number): string[] | null {
  const from = ids.indexOf(id);
  if (from < 0 || to < 0 || to >= ids.length || from === to) return null;
  return moveItem(ids, from, to);
}

/** Moves one tile on the board being arranged. Size is left as it was. */
export function reorderHomeTiles(db: DB, preset: HomePresetId, id: string, to: number): DB {
  switch (preset) {
    case "custom":
      return reorderCustom(db, id, to);
    case "desk":
    case "workshop":
      return reorderSaved(db, preset, id, to);
    case "money":
    case "travel":
    case "home":
    case "documents":
    case "bills":
    case "adhd":
      return db;
    default: {
      const unreachable: never = preset;
      return unreachable;
    }
  }
}

function reorderCustom(db: DB, id: string, to: number): DB {
  const board = db.settings.boards.find((row) => row.id === db.settings.activeBoardId);
  if (board) {
    const visible = withModulesOn(db, customItems(board.tiles)).map((item) => item.id);
    const next = moveVisible(visible, id, to);
    if (!next) return db;
    const tiles = stitch(board.tiles, visible, next) as TileId[];
    return {
      ...db,
      settings: {
        ...db.settings,
        boards: db.settings.boards.map((row) => (row.id === board.id ? { ...row, tiles } : row)),
      },
    };
  }
  const visible = db.settings.tiles.filter((tile) => tile.enabled).map((tile) => tile.id);
  const next = moveVisible(visible, id, to);
  if (!next) return db;
  const order = stitch(
    db.settings.tiles.map((tile) => tile.id),
    visible,
    next,
  );
  const byId = new Map(db.settings.tiles.map((tile) => [tile.id, tile]));
  const tiles = order.map((tileId) => byId.get(tileId as TileId)).filter((tile): tile is DB["settings"]["tiles"][number] => !!tile);
  return { ...db, settings: { ...db.settings, tiles } };
}

function reorderSaved(db: DB, preset: "desk" | "workshop", id: string, to: number): DB {
  const ordered = applyTileOrder(presetItems(preset), db.settings.tileOrder?.[preset]);
  const visible = withModulesOn(db, ordered).map((item) => item.id);
  const next = moveVisible(visible, id, to);
  if (!next) return db;
  const merged = stitch(
    ordered.map((item) => item.id),
    visible,
    next,
  );
  return { ...db, settings: { ...db.settings, tileOrder: { ...db.settings.tileOrder, [preset]: merged } } };
}
