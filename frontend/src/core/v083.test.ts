import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { chipScrollAnimated, chipScrollX } from "./chipScroll.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("a selected pill is centered when the row has room, and stays fully on screen at the ends", () => {
  assert.equal(chipScrollX(300, 80, 360, 800), 160);
  assert.equal(chipScrollX(16, 100, 360, 800), 0);
  assert.equal(chipScrollX(700, 80, 360, 800), 440);
  assert.equal(chipScrollX(16, 80, 360, 200), 0);
  assert.equal(chipScrollX(40, 80, 0, 400), 0);
});

test("the pill row jumps once, then eases when the selection moves", () => {
  assert.equal(chipScrollAnimated(null, 0, false), false);
  assert.equal(chipScrollAnimated(0, 0, false), false);
  assert.equal(chipScrollAnimated(0, 3, false), true);
  assert.equal(chipScrollAnimated(0, 3, true), false);
});

test("today tells the pill row which chip is selected, and the row scrolls to it", () => {
  const row = read("../components/ui.tsx");
  const today = read("../../app/(tabs)/index.tsx");
  assert.match(row, /chipScrollX/);
  assert.match(row, /scrollTo\(/);
  assert.match(row, /activeIndex\?: number/);
  assert.equal(/today-preset-row/.test(today), false);
  assert.match(today, /testID="today-board-row" activeIndex=\{boardIndex\}/);
  const swipe = read("../components/HomeModes.tsx");
  assert.match(swipe, /fromSwipe/);
  assert.match(swipe, /swipeWrap/);
});
