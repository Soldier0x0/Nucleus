import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { dualToneInk, dualTonePatch, parseLook, resolveLook } from "./looks.ts";
import { shellSettings } from "./profiles.ts";
import type { LookId } from "./types.ts";

const IDS: LookId[] = ["current", "soft", "tight", "plain", "cards", "ink", "signal", "poster"];

test("current keeps the original shape, type, and spacing", () => {
  const look = resolveLook("current");
  assert.deepEqual(look.radius, { sm: 4, md: 8, lg: 12, pill: 999 });
  assert.deepEqual(look.type, { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 32 });
  assert.equal(look.space, 1);
  assert.equal(look.row, 56);
  assert.equal(look.plain, false);
  assert.equal(look.choices.cards, "flat");
  assert.equal(look.choices.pop, "none");
});

test("each look changes a different choice and still resolves", () => {
  const current = resolveLook("current");
  const soft = resolveLook("soft");
  const tight = resolveLook("tight");
  const plain = resolveLook("plain");
  const cards = resolveLook("cards");
  assert.ok(soft.radius.lg > current.radius.lg);
  assert.ok(soft.type.base > current.type.base);
  assert.ok(soft.space > 1);
  assert.ok(soft.row > current.row);
  assert.ok(tight.radius.lg < current.radius.lg);
  assert.ok(tight.space < 1);
  assert.ok(tight.row < current.row);
  assert.ok(plain.type.base >= 18);
  assert.equal(plain.plain, true);
  assert.deepEqual(cards.radius, current.radius);
  assert.deepEqual(cards.type, current.type);
  assert.equal(cards.choices.cards, "shadow");
  assert.equal(resolveLook("ink").choices.pop, "ink");
  assert.equal(resolveLook("signal").choices.pop, "signal");
  assert.equal(resolveLook("poster").choices.pop, "poster");
  for (const id of IDS) assert.equal(resolveLook(id).id, id);
});

test("two tones keep the background and use a second color for type", () => {
  const paper = "#F6F7F9";
  const ink = dualToneInk("light");
  const patch = dualTonePatch(paper, "light");
  assert.notEqual(patch.onSurface, paper);
  assert.equal(patch.onSurface, ink);
  assert.equal(patch.surfaceInverse, ink);
  assert.equal(patch.onSurfaceInverse, paper);
  assert.notEqual(ink, "#D68E42");
  const night = dualTonePatch("#0B0D12", "dark");
  assert.equal(night.onSurface, dualToneInk("dark"));
  assert.equal(night.onSurfaceInverse, "#0B0D12");
});

test("an old document stays on the current look", () => {
  assert.equal(parseLook(undefined), "current");
  assert.equal(parseLook("nope"), "current");
  const saved = emptyDB();
  saved.settings.look = "poster";
  saved.settings.dualTone = true;
  saved.settings.theme = "dune";
  const shell = shellSettings(saved.settings);
  assert.equal(shell.look, "poster");
  assert.equal(shell.dualTone, true);
  assert.equal(shell.theme, "dune");
  const legacy = emptyDB();
  const next = normalizeDB({ ...legacy, settings: { ...legacy.settings, look: undefined, dualTone: undefined } });
  assert.equal(next.settings.look, "current");
  assert.equal(next.settings.dualTone, false);
});
