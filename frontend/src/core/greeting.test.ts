import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cleanCallName, greetingLine } from "./greeting.ts";

const NAME_FIELDS = [
  new URL("../components/NameAsk.tsx", import.meta.url),
  new URL("../../app/onboarding.tsx", import.meta.url),
  new URL("../../app/(tabs)/settings.tsx", import.meta.url),
];

test("the greeting keeps the name on the same line", () => {
  assert.equal(greetingLine(8, "Asha"), "Good morning, Asha");
  assert.equal(greetingLine(12, "Asha"), "Good afternoon, Asha");
  assert.equal(greetingLine(18), "Good evening");
  assert.equal(greetingLine(15, "   "), "Good afternoon");
});

test("a new name entry placeholder is Harsha", () => {
  for (const file of NAME_FIELDS) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes('placeholder="Asha"'), false);
    assert.equal(src.includes('placeholder="Harsha"'), true);
  }
});

test("a call-me name is one short line", () => {
  assert.equal(cleanCallName("  Asha   Rao "), "Asha Rao");
  assert.equal(cleanCallName("x".repeat(50)).length, 40);
});
