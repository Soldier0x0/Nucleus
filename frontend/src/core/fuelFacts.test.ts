import assert from "node:assert/strict";
import test from "node:test";
import { fuelFactsPatch } from "./fuelCapture.ts";

test("M20: a cleared fuel date is not written", () => {
  assert.deepEqual(fuelFactsPatch("", "HP Koramangala", ""), { station: "HP Koramangala" });
  assert.equal("date" in fuelFactsPatch("", "", ""), false);
});

test("M20: a picked date and a real odometer are written", () => {
  assert.deepEqual(fuelFactsPatch("2026-10-12", "", "12450"), { date: "2026-10-12", station: "", odometer: 12450 });
});

test("M20: a blank or non-numeric odometer is skipped", () => {
  assert.equal("odometer" in fuelFactsPatch("2026-10-12", "", "  "), false);
  assert.equal("odometer" in fuelFactsPatch("2026-10-12", "", "12k"), false);
});
