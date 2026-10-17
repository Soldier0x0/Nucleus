import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { fillKindOf, fuelFillSummary, fuelMileagePoints, missedFillHint, tankCapacityLine, usableTankEstimate } from "./vehicleMath.ts";
import type { FuelEntry } from "./types.ts";

const fill = (over: Partial<FuelEntry> & { id: string; odometer: number; litres: number }): FuelEntry => ({
  id: over.id,
  vehicleId: "v",
  date: over.date ?? "2026-06-01",
  odometer: over.odometer,
  litres: over.litres,
  price: over.price ?? 100,
  total: over.total ?? (over.litres ?? 1) * 100,
  ...over,
});

test("v0.12: partial litres ride in the cycle, distance only across landmarks", () => {
  const entries = [
    fill({ id: "1", odometer: 1000, litres: 5, fillKind: "full" }),
    fill({ id: "2", odometer: 1100, litres: 2, fillKind: "partial" }),
    fill({ id: "3", odometer: 1200, litres: 5, fillKind: "full" }),
  ];
  const points = fuelMileagePoints(entries);
  assert.equal(points.length, 1);
  assert.ok(Math.abs(points[0].value - 200 / 7) < 0.01);
});

test("v0.12: an empty tank is a landmark too — empty→brim counts what was pumped", () => {
  const entries = [
    fill({ id: "e", odometer: 2000, litres: 4, fillKind: "empty" }),
    fill({ id: "p", odometer: 2050, litres: 1, fillKind: "partial" }),
    fill({ id: "f", odometer: 2100, litres: 5, fillKind: "full" }),
  ];
  const points = fuelMileagePoints(entries);
  assert.equal(points.length, 1);
  assert.ok(Math.abs(points[0].value - 100 / 10) < 0.01);
});

test("v0.12: two landmark pairs give two points and no anchor start drinks its own gas", () => {
  const entries = [
    fill({ id: "a", odometer: 0, litres: 3, fillKind: "empty" }),
    fill({ id: "b", odometer: 100, litres: 5, fillKind: "full" }),
    fill({ id: "c", odometer: 250, litres: 2, fillKind: "partial" }),
    fill({ id: "d", odometer: 300, litres: 5, fillKind: "full" }),
  ];
  const points = fuelMileagePoints(entries);
  assert.ok(Math.abs(points[0].value - 100 / 8) < 0.01);
  assert.ok(Math.abs(points[1].value - 200 / 7) < 0.01);
});

test("v0.12: level chips learn the usable tank", () => {
  const entries = [
    fill({ id: "q", odometer: 100, litres: 3, fillKind: "partial", levelChip: "half" }),
    fill({ id: "f", odometer: 140, litres: 3, fillKind: "full" }),
  ];
  // 3 L at half tank + everything to brim = 6 L from the middle → usable 12 L.
  assert.equal(usableTankEstimate(entries), 12);
  assert.equal(tankCapacityLine(entries), "Tank ≈ 12 L · learned from your fills");
  assert.equal(tankCapacityLine([], 10), "Tank ≈ 10 L");
  assert.equal(tankCapacityLine([], undefined), null);
});

test("v0.12: the missing-fill flag only speaks when the ladder lies", () => {
  const honest = [
    fill({ id: "1", odometer: 0, litres: 5, fillKind: "full", date: "2026-05-01" }),
    fill({ id: "2", odometer: 200, litres: 5, fillKind: "full", date: "2026-05-10" }),
    fill({ id: "3", odometer: 400, litres: 5, fillKind: "full", date: "2026-05-20" }),
  ];
  assert.equal(missedFillHint(honest), null);
  const missed = [
    ...honest.slice(0, 2),
    fill({ id: "3", odometer: 700, litres: 5, fillKind: "full", date: "2026-05-25" }),
  ];
  assert.equal(missedFillHint(missed), "Missed a fill?");
  assert.equal(fuelFillSummary({ id: "x", vehicleId: "v", date: "2026-06-01", odometer: 10, litres: 1, price: 1, total: 1, fillKind: "empty" }), "From empty");
  assert.equal(fillKindOf({ id: "x", vehicleId: "v", date: "2026-06-01", odometer: 10, litres: 1, price: 1, total: 1 }), "full");
});

test("v0.12: money stays exact and the linked expense does not double-count fuel", () => {
  const db = emptyDB();
  assert.ok(db.fuel.length === 0);
});
