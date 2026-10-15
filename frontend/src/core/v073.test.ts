import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { homeDropIndex, reorderHomeTiles, type TileBox } from "./homeOrder.ts";
import { visiblePresetItems } from "./presets.ts";

const frames: TileBox[] = [
  { x: 0, y: 0, w: 300, h: 180 },
  { x: 0, y: 192, w: 146, h: 100 },
  { x: 158, y: 192, w: 146, h: 100 },
];

/** v0.9.8: travel is folded off by default, so a board that holds the trip tile turns it on. */
function travelOn<T extends { settings: { modules: { id: string; enabled: boolean; hidden: boolean }[] } }>(db: T): T {
  return {
    ...db,
    settings: {
      ...db.settings,
      modules: db.settings.modules.map((m) => (m.id === "travel" ? { ...m, enabled: true, hidden: false } : m)),
    },
  };
}

test("the tile under the finger is where the held tile lands", () => {
  assert.equal(homeDropIndex(1, { x: 230, y: 240 }, frames), 2);
  assert.equal(homeDropIndex(1, { x: 20, y: 20 }, frames), 0);
  assert.equal(homeDropIndex(1, { x: 400, y: 400 }, frames), 1);
});

test("holding a home tile moves it and does not change its size", () => {
  const start = emptyDB();
  const ids = start.settings.tiles.map((tile) => tile.id);
  const moved = reorderHomeTiles(start, "custom", "notes", 0);
  assert.equal(moved.settings.tiles[0]?.id, "notes");
  assert.deepEqual(
    moved.settings.tiles.slice(1).map((tile) => tile.id),
    ids.filter((id) => id !== "notes"),
  );
  assert.deepEqual(moved.settings.tileSizes, start.settings.tileSizes);

  const board = travelOn(emptyDB());
  board.settings.tileSizes = { trip: "small" };
  board.settings.boards = [{ id: "b1", name: "Board", icon: "home-outline", tiles: ["notes", "weather", "trip"] }];
  board.settings.activeBoardId = "b1";
  const named = reorderHomeTiles(board, "custom", "trip", 0);
  assert.deepEqual(named.settings.boards[0]?.tiles, ["trip", "notes", "weather"]);
  assert.equal(named.settings.tiles[0]?.id, "attention");
  assert.equal(named.settings.tileSizes.trip, "small");

  const desk = reorderHomeTiles(emptyDB(), "desk", "wiki", 0);
  assert.equal(visiblePresetItems(desk, "desk")[0]?.id, "wiki");
  assert.deepEqual(
    desk.settings.tiles.map((tile) => tile.id),
    start.settings.tiles.map((tile) => tile.id),
  );
  const money = reorderHomeTiles(emptyDB(), "money", "charts", 0);
  assert.equal(visiblePresetItems(money, "money")[0]?.id, "balance");

  const modes = readFileSync(new URL("../components/HomeModes.tsx", import.meta.url), "utf8");
  assert.match(modes, /reorderHomeTiles\(/);
  assert.match(modes, /homeDropIndex\(/);
  assert.match(modes, /activateAfterLongPress/);
  assert.match(modes, /withSpring/);
  assert.doesNotMatch(modes, /toggleTileSize/);
  const home = readFileSync(new URL("../../app/(tabs)/index.tsx", import.meta.url), "utf8");
  assert.match(home, /Hold a tile to rearrange it\./);
  assert.doesNotMatch(home, /resize it/);
});
