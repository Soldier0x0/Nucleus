import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { presentHome } from "./layouts.ts";
import { resizeHomeTile } from "./presets.ts";

test("a tile can become wide or small, and small tiles sit together", () => {
  const start = emptyDB();
  const order = start.settings.tiles.map((tile) => tile.id);
  const wide = resizeHomeTile(start, "notes", "large");
  assert.equal(wide.settings.tileSizes.notes, "large");
  assert.deepEqual(wide.settings.tiles.map((tile) => tile.id), order);

  const small = resizeHomeTile(wide, "notes", "small");
  assert.equal(small.settings.tileSizes.notes, "small");
  assert.deepEqual(small.settings.tiles.map((tile) => tile.id), order);
  assert.equal(resizeHomeTile(small, "notes", "small"), small);

  const packed = presentHome("bento", [
    { id: "attention", size: "small" },
    { id: "weather", size: "small" },
    { id: "trip", size: "small" },
    { id: "notes", size: "large" },
  ]);
  assert.equal(packed.rows[0]?.items.length, 2);
  assert.equal(packed.rows[0]?.items.every((item) => item.size === "small"), true);
  assert.equal(packed.rows[1]?.items.length, 1);
  assert.equal(packed.rows[1]?.items[0]?.size, "small");
  assert.equal(packed.rows[2]?.items[0]?.id, "notes");
  assert.equal(packed.rows[2]?.items[0]?.size, "large");
  assert.equal(packed.rows[2]?.items.length, 1);

  const modes = readFileSync(new URL("../components/HomeModes.tsx", import.meta.url), "utf8");
  assert.match(modes, /resizeHomeTile\(/);
  assert.match(modes, /reorderHomeTiles\(/);
  assert.match(modes, /activateAfterLongPress/);
  assert.match(modes, /today-tile-resize/);
  assert.doesNotMatch(modes, /toggleTileSize/);
  const home = readFileSync(new URL("../../app/(tabs)/index.tsx", import.meta.url), "utf8");
  assert.match(home, /Hold a tile to rearrange it\./);
  assert.match(home, /Drag a corner to make a tile small or wide\./);
  assert.doesNotMatch(home, /resize it/);
});
