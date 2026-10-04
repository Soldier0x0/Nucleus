import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { presentHome } from "./layouts.ts";
import { resolveLook } from "./looks.ts";
import { presetItems } from "./presets.ts";

test("a look and a layout change the home screen, not only the label", () => {
  const tight = resolveLook("tight");
  const soft = resolveLook("soft");
  const plain = resolveLook("plain");
  const cards = resolveLook("cards");
  assert.ok(soft.radius.lg > tight.radius.lg);
  assert.ok(plain.type["2xl"] > tight.type["2xl"]);
  assert.notEqual(soft.space, tight.space);
  assert.equal(cards.choices.cards, "shadow");
  assert.equal(tight.choices.cards, "flat");

  const items = presetItems("money");
  const stack = presentHome("stack", items);
  const glass = presentHome("glass", items);
  const bento = presentHome("bento", items);
  assert.equal(stack.frost, false);
  assert.equal(glass.frost, true);
  assert.equal(bento.frost, false);
  assert.equal(bento.cardMin, 0);
  assert.equal(bento.rows[0]?.items.length, 1);
  assert.equal(bento.rows[0]?.items[0]?.id, "balance");
  assert.equal(bento.rows[0]?.items[0]?.size, "large");
  assert.equal(bento.rows[1]?.items.length, 2);
  assert.equal(bento.rows[1]?.items.every((item) => item.size === "small"), true);
  assert.equal(stack.rows[1]?.items.length, 2);
  assert.equal(stack.rows[1]?.items.every((item) => item.size === "small"), true);
  assert.deepEqual(
    bento.rows.flatMap((row) => row.items.map((item) => item.id)),
    items.map((item) => item.id),
  );
});

test("the home screen uses that layout and keeps empty tiles", () => {
  const home = readFileSync(new URL("../../app/(tabs)/index.tsx", import.meta.url), "utf8");
  const modes = readFileSync(new URL("../components/HomeModes.tsx", import.meta.url), "utf8");
  assert.match(home, /presentHome\(/);
  assert.match(home, /presetBoard\(/);
  assert.match(home, /tilePlaceholder\(/);
  assert.equal(/\btileHasData\b/.test(home), false);
  assert.match(modes, /presentHome\(/);
  assert.match(modes, /homePresetTiles\(/);
});
