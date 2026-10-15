import assert from "node:assert/strict";
import test from "node:test";
import { RIDE_CHECKLIST_DEFAULTS, newRideChecklist, rideChecklistProgress, rideChecklistTemplate, toggleRideChecklistItem } from "./rideChecklists.ts";
import type { Vehicle } from "./types.ts";

const vehicle = (patch: Partial<Vehicle> = {}): Vehicle => ({ id: "v1", name: "Activa", type: "bike", fuelType: "petrol", initialOdometer: 1000, serviceIntervalKm: 3000, createdAt: "2026-01-01T00:00:00.000Z", ...patch });

test("ride checklist: a bike and a car get a sane default per type", () => {
  assert.ok(RIDE_CHECKLIST_DEFAULTS.bike.includes("Helmet"));
  assert.ok(RIDE_CHECKLIST_DEFAULTS.car.includes("First-aid kit"));
  assert.ok(RIDE_CHECKLIST_DEFAULTS.other.length > 0);
  assert.deepEqual(rideChecklistTemplate(vehicle()), RIDE_CHECKLIST_DEFAULTS.bike);
  assert.deepEqual(rideChecklistTemplate(vehicle({ type: "car" })), RIDE_CHECKLIST_DEFAULTS.car);
});

test("ride checklist: a saved template wins over the default, blanks fall back", () => {
  assert.deepEqual(rideChecklistTemplate(vehicle({ rideChecklist: ["Helmet", "Fuel"] })), ["Helmet", "Fuel"]);
  assert.deepEqual(rideChecklistTemplate(vehicle({ rideChecklist: ["   "] })), RIDE_CHECKLIST_DEFAULTS.bike);
});

test("ride checklist: copy-on-use gives fresh ids and never mutates the source", () => {
  const saved = ["Helmet", "Fuel"];
  const copy = newRideChecklist(saved);
  assert.deepEqual(copy.map((item) => item.text), saved);
  assert.notEqual(copy[0].id, copy[1].id);
  for (const item of copy) assert.equal(item.done, false);
  const ticked = toggleRideChecklistItem(copy, copy[0].id);
  assert.equal(ticked[0].done, true);
  assert.equal(copy[0].done, false);
  assert.deepEqual(saved, ["Helmet", "Fuel"]);
  assert.deepEqual(rideChecklistProgress(ticked), { done: 1, total: 2 });
  assert.deepEqual(rideChecklistProgress(toggleRideChecklistItem(ticked, ticked[0].id)), { done: 0, total: 2 });
});

test("ride checklist: empty texts are dropped", () => {
  const copy = newRideChecklist(["Helmet", "  ", ""]);
  assert.equal(copy.length, 1);
  assert.equal(copy[0].text, "Helmet");
});
