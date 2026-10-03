import assert from "node:assert/strict";
import test from "node:test";
import { cleanCallName, greetingLine } from "./greeting.ts";

test("the greeting keeps the name on the same line", () => {
  assert.equal(greetingLine(8, "Asha"), "Good morning, Asha");
  assert.equal(greetingLine(12, "Asha"), "Good afternoon, Asha");
  assert.equal(greetingLine(18), "Good evening");
  assert.equal(greetingLine(15, "   "), "Good afternoon");
});

test("a call-me name is one short line", () => {
  assert.equal(cleanCallName("  Asha   Rao "), "Asha Rao");
  assert.equal(cleanCallName("x".repeat(50)).length, 40);
});
