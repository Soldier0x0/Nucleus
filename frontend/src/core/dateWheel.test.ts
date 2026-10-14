import assert from "node:assert/strict";
import test from "node:test";
import { daysInMonth, MONTH_CHIPS, wheelISO, wheelYears } from "./dateWheel.ts";

test("wheels: day is clamped to the month (31 Feb -> 28/29 Feb)", () => {
  assert.equal(wheelISO(2026, 1, 31), "2026-02-28");
  assert.equal(wheelISO(2028, 1, 31), "2028-02-29");
  assert.equal(wheelISO(2026, 11, 5), "2026-12-05");
  assert.equal(daysInMonth(2026, 3), 30);
});

test("wheels: years span 30 back to 15 ahead and always include the value", () => {
  const y = wheelYears(2026);
  assert.equal(y[0], 1996);
  assert.equal(y.at(-1), 2041);
  assert.equal(wheelYears(2026, 1980)[0], 1980);
});

test("wheels: quick chips are 1, 3, 6 and 12 months", () => {
  assert.deepEqual([...MONTH_CHIPS], [1, 3, 6, 12]);
});
