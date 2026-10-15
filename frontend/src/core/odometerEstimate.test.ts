import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { odometerEstimate, odometerEstimateLabel, odometerReadings } from "./fuelCapture.ts";
import type { Vehicle } from "./types.ts";

const bike = (): Vehicle => ({ id: "v1", name: "Activa", type: "bike", fuelType: "petrol", initialOdometer: 1000, serviceIntervalKm: 3000, createdAt: "2026-01-01T00:00:00.000Z" });

const fill = (id: string, date: string, odometer: number) => ({ id, vehicleId: "v1", date, odometer, litres: 5, price: 100, total: 500 });
const log = (id: string, at: string, odometer: number) => ({ id, vehicleId: "v1", at, odometer });

test("odometer estimate: average daily km from the typed readings", () => {
  const db = emptyDB();
  const v = bike();
  db.vehicles.push(v);
  db.fuel.push(fill("f1", "2026-03-01", 1100));
  db.fuel.push(fill("f2", "2026-03-21", 1500));
  // 400 km over 20 days = 20 km/day. Ten days later the odometer reads ~1,700.
  const est = odometerEstimate(db, v, "2026-03-31");
  assert.equal(est.value, 1700);
  assert.equal(est.estimated, true);
  assert.equal(est.stale, false);
  assert.equal(est.perDay, 20);
  assert.equal(est.daysAgo, 10);
  assert.equal(est.lastDate, "2026-03-21");
  assert.equal(odometerEstimateLabel(est), "~1,700");
});

test("odometer estimate: readings come from fills, logs and services; estimated fills are ignored", () => {
  const db = emptyDB();
  const v = bike();
  db.vehicles.push(v);
  db.fuel.push(fill("f1", "2026-03-01", 1000));
  db.fuel.push({ ...fill("f2", "2026-03-05", 9999), odometerEstimated: true });
  db.odometerLogs.push(log("o1", "2026-03-11T09:00:00", 1600));
  db.services.push({ id: "s1", vehicleId: "v1", date: "2026-03-21", odometer: 2000, kind: "general", cost: 500, details: {} });
  const rows = odometerReadings(db, v);
  assert.deepEqual(rows.map((row) => row.odometer), [1000, 1600, 2000]);
  const est = odometerEstimate(db, v, "2026-03-26");
  assert.equal(est.readings, 3);
  // 1,000 km over 20 days = 50/day. Five days later ≈ 2,250.
  assert.equal(est.value, 2250);
});

test("odometer estimate: live at 30 days, stale after, and the stale value does not move", () => {
  const db = emptyDB();
  const v = bike();
  db.vehicles.push(v);
  db.fuel.push(fill("f1", "2026-03-01", 1000));
  db.fuel.push(fill("f2", "2026-03-11", 1200));
  const at30 = odometerEstimate(db, v, "2026-04-10");
  assert.equal(at30.daysAgo, 30);
  assert.equal(at30.estimated, true);
  assert.equal(at30.stale, false);
  assert.equal(at30.value, 1800);
  const at31 = odometerEstimate(db, v, "2026-04-11");
  assert.equal(at31.daysAgo, 31);
  assert.equal(at31.estimated, false);
  assert.equal(at31.stale, true);
  assert.equal(at31.value, 1200);
  assert.equal(odometerEstimateLabel(at31), "1,200");
});

test("odometer estimate: a reading typed today clears the estimate at once", () => {
  const db = emptyDB();
  const v = bike();
  db.vehicles.push(v);
  db.fuel.push(fill("f1", "2026-03-01", 1000));
  db.fuel.push(fill("f2", "2026-03-11", 1200));
  db.odometerLogs.push(log("o1", "2026-04-10T08:00:00", 1850));
  const est = odometerEstimate(db, v, "2026-04-10");
  assert.equal(est.daysAgo, 0);
  assert.equal(est.estimated, false);
  assert.equal(est.stale, false);
  assert.equal(est.value, 1850);
});

test("odometer estimate: no readings keeps the starting odometer and shows no tilde", () => {
  const db = emptyDB();
  const v = bike();
  db.vehicles.push(v);
  const est = odometerEstimate(db, v, "2026-04-10");
  assert.equal(est.value, 1000);
  assert.equal(est.estimated, false);
  assert.equal(est.lastDate, null);
  assert.equal(est.readings, 0);
  assert.equal(odometerEstimateLabel(est), "1,000");
});

test("odometer estimate: a single old reading goes stale but is never projected", () => {
  const db = emptyDB();
  const v = bike();
  db.vehicles.push(v);
  db.fuel.push(fill("f1", "2026-01-01", 1500));
  const est = odometerEstimate(db, v, "2026-03-01");
  assert.equal(est.estimated, false);
  assert.equal(est.stale, true);
  assert.equal(est.value, 1500);
});
