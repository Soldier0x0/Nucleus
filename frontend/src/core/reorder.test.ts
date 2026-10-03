import assert from "node:assert/strict";
import test from "node:test";
import { dropIndex, moveItem, shiftFor } from "./reorder.ts";

test("hovering between two modules inserts in that gap", () => {
  const items = ["vehicles", "money", "travel", "home"];
  const row = 76;
  const down = dropIndex(0, row * 1.5, row, items.length);
  assert.equal(down, 1);
  const inserted = moveItem(items, 0, down);
  assert.deepEqual(inserted, ["money", "vehicles", "travel", "home"]);
  assert.notEqual(inserted.indexOf("vehicles"), 0);
  assert.notEqual(inserted.at(-1), "vehicles");

  const up = dropIndex(items.length - 1, -(row * 2.5), row, items.length);
  assert.equal(up, 1);
  const lifted = moveItem(items, items.length - 1, up);
  assert.deepEqual(lifted, ["vehicles", "home", "money", "travel"]);
  assert.notEqual(lifted.indexOf("home"), items.length - 1);
  assert.notEqual(lifted.at(-1), "home");
});

test("rows beside the pointer move apart to open that gap", () => {
  assert.equal(shiftFor(1, 0, 1), -1);
  assert.equal(shiftFor(2, 0, 1), 0);
  assert.equal(shiftFor(0, 0, 1), 0);
  assert.equal(shiftFor(1, 3, 1), 1);
  assert.equal(shiftFor(2, 3, 1), 1);
  assert.equal(shiftFor(0, 3, 1), 0);
  assert.equal(shiftFor(3, 3, 1), 0);
});
