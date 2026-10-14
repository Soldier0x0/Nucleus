import assert from "node:assert/strict";
import test from "node:test";
import { duplicateKeys, nextInputKey } from "./builderKeys.ts";

test("H7: a new builder input never reuses a key left after a delete", () => {
  // a, b, c existed; b was deleted -> keys a, c, cursor still 3
  const first = nextInputKey(["a", "c"], 3);
  assert.equal(first.key, "d");
  const second = nextInputKey(["a", "c", first.key], first.cursor);
  assert.equal(second.key, "e");
  assert.notEqual(first.key, "c");
});

test("H7: the key skips names already taken and runs past z", () => {
  assert.equal(nextInputKey(["a", "b"], 0).key, "c");
  assert.equal(nextInputKey([], 25).key, "z");
  assert.deepEqual(nextInputKey(["z"], 25), { key: "k26", cursor: 27 });
});

test("H7: duplicate keys are found once each, so save is blocked", () => {
  assert.deepEqual(duplicateKeys(["a", "b", "a", "a", "c", "b"]), ["a", "b"]);
  assert.deepEqual(duplicateKeys(["a", "b", "c"]), []);
});
