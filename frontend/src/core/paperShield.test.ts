import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resetShield, shieldDepth, shieldOff, shieldOn, setShieldApplier } from "./paperShield.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test.beforeEach(() => {
  resetShield();
});
test.afterEach(() => {
  setShieldApplier(null);
});

test("the shield counts viewers, hides while one is open, restores the user's choice after", async () => {
  const calls: string[] = [];
  setShieldApplier(async (mode) => {
    calls.push(mode);
  });
  shieldOn();
  assert.equal(shieldDepth(), 1);
  shieldOn();
  assert.equal(shieldDepth(), 2);
  assert.deepEqual(calls, ["secure"]);
  shieldOff(true);
  assert.equal(shieldDepth(), 1);
  assert.deepEqual(calls, ["secure"]);
  shieldOff(false);
  assert.deepEqual(calls, ["secure", "allow"]);
  shieldOff(false);
  assert.deepEqual(calls, ["secure", "allow"]);
  assert.equal(shieldDepth(), 0);
});

test("below zero never happens and restoring keeps screenshots blocked if the user said so", async () => {
  const calls: string[] = [];
  setShieldApplier(async (mode) => {
    calls.push(mode);
  });
  shieldOff(true);
  assert.equal(shieldDepth(), 0);
  assert.deepEqual(calls, []);
  shieldOn();
  shieldOff(true);
  assert.deepEqual(calls, ["secure", "secure"]);
});

test("every paper-bearing screen mounts the shield", () => {
  for (const file of ["../../app/papers/index.tsx", "../../app/papers/view.tsx", "../components/DocumentContent.tsx", "../components/PaperAttach.tsx"]) {
    const src = read(file);
    assert.match(src, /usePaperShield\(/, file);
  }
  assert.match(read("./paperShield.ts"), /FLAG_SECURE|secure/);
});
