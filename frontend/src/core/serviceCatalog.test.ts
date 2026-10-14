import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { partDue, preTicked, serviceSchedule, vehicleParts } from "./serviceCatalog.ts";
import type { DB, Vehicle } from "./types.ts";

const bike = { id: "v1", name: "Activa", type: "bike", fuelType: "petrol", initialOdometer: 0, serviceIntervalKm: 3000, createdAt: "2026-01-01T00:00:00.000Z" } as Vehicle;
const car = { ...bike, id: "v2", name: "Swift", type: "car", serviceIntervalKm: 10000 } as Vehicle;
const dbWith = (over: Partial<DB>): DB => ({ ...emptyDB(), vehicles: [bike, car], ...over });

test("parts: air-cooled bike has no coolant and has a chain; car has coolant and no chain by default", () => {
  const b = vehicleParts(bike).map((p) => p.id);
  assert.equal(b.includes("coolant"), false);
  assert.equal(vehicleParts(bike).find((p) => p.id === "chain_lube")!.on, true);
  assert.equal(vehicleParts(car).find((p) => p.id === "coolant")!.on, true);
  assert.equal(vehicleParts(car).find((p) => p.id === "chain_sprocket")!.on, false);
  assert.equal(vehicleParts({ ...bike, cooling: "liquid" }).some((p) => p.id === "coolant"), true);
});

test("parts: engine oil seeds from the vehicle's service interval", () => {
  assert.equal(vehicleParts({ ...bike, serviceIntervalKm: 2500 }).find((p) => p.id === "engine_oil")!.everyKm, 2500);
});

test("due (Q2): never serviced, odo 8000, interval 16000 -> 8000 left", () => {
  const db = dbWith({ odometerLogs: [{ id: "o", vehicleId: "v2", at: "2026-06-01T00:00:00Z", odometer: 8000 }] });
  const d = partDue(db, car, { id: "brake_fluid", on: true, everyKm: 16000, everyMonths: 48 }, "2026-06-01");
  assert.equal(d.dueOdo, 16000);
  assert.equal(d.kmLeft, 8000);
  assert.equal(d.state, "ok");
});

test("due: km or months, whichever comes first", () => {
  const db = dbWith({ services: [{ id: "s", vehicleId: "v1", date: "2026-01-10", odometer: 1000, kind: "oil", cost: 0, details: {} }] });
  const oil = vehicleParts(bike).find((p) => p.id === "engine_oil")!;
  assert.equal(partDue(db, bike, oil, "2026-02-01", 1200).state, "ok");
  assert.equal(partDue(db, bike, oil, "2026-04-15", 1200).state, "due");
  assert.equal(partDue(db, bike, oil, "2026-02-01", 3800).state, "soon");
  assert.equal(partDue(db, bike, oil, "2026-02-01", 4100).state, "due");
});

test("service log: parts done in a visit reset only those parts; due parts are pre-ticked", () => {
  const db = dbWith({ services: [{ id: "s", vehicleId: "v1", date: "2026-05-01", odometer: 6000, kind: "general", parts: ["engine_oil"], cost: 0, details: {} }], odometerLogs: [{ id: "o", vehicleId: "v1", at: "2026-05-02T00:00:00Z", odometer: 6100 }] });
  const sched = serviceSchedule(db, bike, "2026-05-02");
  assert.equal(sched.find((d) => d.part.id === "engine_oil")!.state, "ok");
  assert.equal(sched.find((d) => d.part.id === "air_filter")!.state, "due");
  assert.equal(sched[0].state, "due");
  assert.ok(preTicked(db, bike, "2026-05-02").includes("air_filter"));
  assert.equal(preTicked(db, bike, "2026-05-02").includes("engine_oil"), false);
});
