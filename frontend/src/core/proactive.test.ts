import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { applyPreset } from "./presets.ts";
import { dismissHeadsUp, nextHeadsUp, rememberHeadsUp } from "./proactive.ts";
import type { DB, Trip, Vehicle } from "./types.ts";

const PRESSURE = /overdue|\bmissed\b|behind|\blate\b|\bfail|streak|\bscore\b|points|quota|congrat|good job|hurry/i;
const TODAY = "2026-10-03";

function vehicle(): Vehicle {
  return { id: "v1", name: "Bike", type: "bike", fuelType: "petrol", initialOdometer: 1000, serviceIntervalKm: 5000, createdAt: "2026-09-01" };
}

function trip(): Trip {
  return {
    id: "trip-1",
    name: "Coast",
    destination: "Goa",
    start: "2026-10-10",
    end: "2026-10-12",
    travellers: 1,
    budget: 0,
    packing: [],
    itinerary: [],
    docs: [],
    createdAt: "2026-10-01",
  };
}

function withBill(): DB {
  const db = emptyDB();
  db.txns.push(
    { id: "rent-1", type: "expense", amount: 10, category: "Rent", date: "2026-08-04", note: "Rent" },
    { id: "rent-2", type: "expense", amount: 10, category: "Rent", date: "2026-09-04", note: "Rent" },
  );
  return db;
}

test("one quiet heads-up comes from stored data and a second one waits", () => {
  const db = withBill();
  db.vehicles.push(vehicle());
  db.trips.push(trip());
  db.fuel.push(
    { id: "f1", vehicleId: "v1", date: "2026-09-01", odometer: 1000, litres: 10, price: 100, total: 1000 },
    { id: "f2", vehicleId: "v1", date: "2026-09-15", odometer: 1150, litres: 10, price: 100, total: 1000 },
  );
  db.services.push({ id: "svc", vehicleId: "v1", date: "2026-09-01", odometer: 10000, kind: "general", cost: 1, details: {} });
  db.fuel.push({ id: "f3", vehicleId: "v1", date: "2026-10-01", odometer: 14600, litres: 1, price: 100, total: 100 });
  const one = nextHeadsUp(db, TODAY);
  assert.equal(Array.isArray(one), false);
  assert.ok(one);
  assert.equal(one?.id.startsWith("bill:"), true);
  assert.equal(one?.sound, false);
  assert.equal(one?.tone, "plain");
  assert.equal(PRESSURE.test(one?.line ?? ""), false);
  assert.deepEqual(one?.actions, []);

  const next = nextHeadsUp(dismissHeadsUp(db, one?.id ?? ""), TODAY);
  assert.notEqual(next?.id, one?.id);
  assert.equal(Array.isArray(next), false);
  assert.ok(next);
  assert.equal(PRESSURE.test(next?.line ?? ""), false);
});

test("dismissing a heads-up has no penalty and does not mark anything missed", () => {
  const db = withBill();
  const one = nextHeadsUp(db, TODAY);
  assert.equal(one?.id.startsWith("bill:"), true);
  const dismissed = dismissHeadsUp(db, one?.id ?? "");
  assert.equal(nextHeadsUp(dismissed, TODAY), null);
  assert.deepEqual(dismissed.txns, db.txns);
  assert.deepEqual(dismissed.trips, db.trips);
  assert.equal(JSON.stringify(dismissed.attention).includes("missed"), false);
});

test("an unsure heads-up asks once and remembers the answer", () => {
  const db = emptyDB();
  db.vehicles.push({ ...vehicle(), initialOdometer: 0, serviceIntervalKm: 10000 });
  db.trips.push(trip());
  db.fuel.push({ id: "f1", vehicleId: "v1", date: "2026-10-01", odometer: 10, litres: 5, price: 100, total: 500 });
  const ask = nextHeadsUp(db, TODAY);
  assert.equal(ask?.actions.includes("Yes"), true);
  assert.equal(ask?.actions.includes("No"), true);
  assert.equal(ask?.sound, false);
  assert.equal(PRESSURE.test(ask?.line ?? ""), false);
  const remembered = rememberHeadsUp(db, ask?.id ?? "", "No");
  assert.equal(nextHeadsUp(remembered, TODAY), null);
  assert.deepEqual(remembered.txns, db.txns);
  assert.deepEqual(remembered.fuel, db.fuel);
});

test("proactive heads-ups wait while ADHD mode is on", () => {
  const db = applyPreset(withBill(), "adhd");
  assert.equal(nextHeadsUp(db, TODAY), null);
});

test("fuel that will not cover the planned trip is the one heads-up", () => {
  const db = emptyDB();
  db.vehicles.push({ ...vehicle(), initialOdometer: 1000, serviceIntervalKm: 20000 });
  db.trips.push(trip());
  db.fuel.push(
    { id: "f1", vehicleId: "v1", date: "2026-09-01", odometer: 1000, litres: 10, price: 100, total: 1000 },
    { id: "f2", vehicleId: "v1", date: "2026-09-15", odometer: 1100, litres: 2, price: 100, total: 200 },
  );
  db.services.push({ id: "svc", vehicleId: "v1", date: "2026-10-01", odometer: 1400, kind: "general", cost: 1, details: {} });
  const one = nextHeadsUp(db, TODAY);
  assert.equal(Array.isArray(one), false);
  assert.equal(one?.id, "fuel:trip-1");
  assert.match(one?.line ?? "", /Fuel for Coast/);
  assert.equal(one?.sound, false);
  assert.equal(one?.tone, "plain");
  assert.deepEqual(one?.actions, []);
  assert.equal(PRESSURE.test(one?.line ?? ""), false);
});

test("a service interval already past is not a heads-up", () => {
  const db = emptyDB();
  db.vehicles.push({ ...vehicle(), initialOdometer: 0, serviceIntervalKm: 1000 });
  db.services.push({ id: "svc", vehicleId: "v1", date: "2026-01-01", odometer: 0, kind: "general", cost: 1, details: {} });
  db.fuel.push({ id: "f1", vehicleId: "v1", date: "2026-09-01", odometer: 2000, litres: 5, price: 1, total: 5 });
  assert.equal(nextHeadsUp(db, TODAY), null);
});

test("a backup that has not synced since unlock can be the one heads-up", () => {
  const db = emptyDB();
  db.settings.cloud = { provider: "drive", lastSyncAt: undefined, askedSinceUnlock: false, unlockedAt: "2026-10-03T08:00:00" };
  const one = nextHeadsUp(db, TODAY);
  assert.equal(one?.id, "backup");
  assert.equal(one?.sound, false);
  assert.match(one?.line ?? "", /synced/i);
  assert.equal(PRESSURE.test(one?.line ?? ""), false);
});
