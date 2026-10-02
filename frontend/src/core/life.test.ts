import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { parseCapture } from "./capture.ts";
import { calendarEvents, dataHealth, fuelLabel, inferBody, morningLine, vehicleOwnership, weekLeft } from "./life.ts";

test("a model name picks a body without a network lookup", () => {
  assert.equal(inferBody({ type: "bike", name: "Activa", make: "Honda", model: "Activa 6G" }), "scooter");
  assert.equal(inferBody({ type: "bike", name: "Duke", model: "390" }), "naked");
  assert.equal(inferBody({ type: "bike", make: "Yamaha", model: "R15 V4" }), "sport");
  assert.equal(inferBody({ type: "bike", model: "Classic 350" }), "cruiser");
  assert.equal(inferBody({ type: "car", name: "Swift", model: "VXi" }), "hatchback");
  assert.equal(inferBody({ type: "car", make: "Honda", model: "City" }), "sedan");
  assert.equal(inferBody({ type: "car", model: "Creta" }), "suv");
});

test("hybrid names the fuel it pairs with", () => {
  assert.equal(fuelLabel({ fuelType: "hybrid", hybridFrom: "petrol" }), "Petrol hybrid");
  assert.equal(fuelLabel({ fuelType: "hybrid", hybridFrom: "diesel" }), "Diesel hybrid");
  assert.equal(fuelLabel({ fuelType: "cng" }), "CNG");
});

test("capture reads 450 food lunch as an expense", () => {
  const db = emptyDB();
  const hit = parseCapture(db, "450 food lunch");
  assert.ok(hit && !("error" in hit));
  if (!hit || "error" in hit) return;
  const next = hit.apply(db);
  assert.equal(next.txns.length, 1);
  assert.equal(next.txns[0].amount, 450);
  assert.equal(next.txns[0].category, "Food");
  assert.equal(next.txns[0].note, "lunch");
  assert.match(hit.label, /Food/);
  assert.match(hit.label, /lunch/);
});

test("week left splits what remains across the days still in the month", () => {
  const db = emptyDB();
  db.budget.monthly = 3100;
  db.txns.push({ id: "a", type: "expense", amount: 1000, category: "Food", date: "2026-10-01" });
  const w = weekLeft(db, "2026-10-25");
  assert.equal(w.spent, 1000);
  assert.equal(w.daysLeft, 7);
  assert.equal(w.left, 2100);
  assert.equal(w.thisWeek, 2100);
});

test("ownership adds fuel, service and a manual vehicle expense once", () => {
  const db = emptyDB();
  db.vehicles.push({ id: "v", name: "Activa", type: "bike", fuelType: "petrol", initialOdometer: 1000, serviceIntervalKm: 3000, createdAt: "2026-01-01" });
  db.fuel.push({ id: "f", vehicleId: "v", date: "2026-02-01", odometer: 1600, litres: 5, price: 100, total: 500 });
  db.services.push({ id: "s", vehicleId: "v", date: "2026-03-01", odometer: 2000, kind: "oil", cost: 800, details: {} });
  db.txns.push({ id: "t", type: "expense", amount: 200, category: "Vehicle", date: "2026-03-02" });
  db.links.push({ id: "l", from: { kind: "vehicle", id: "v" }, to: { kind: "txn", id: "t" }, rel: "expense", createdAt: "2026-03-02" });
  const own = vehicleOwnership(db, "v");
  assert.ok(own);
  assert.equal(own?.fuel, 500);
  assert.equal(own?.service, 800);
  assert.equal(own?.other, 200);
  assert.equal(own?.total, 1500);
  assert.equal(own?.distance, 1000);
  assert.equal(own?.perKm, 1.5);
});

test("data health flags a backwards odometer and a repeated expense", () => {
  const db = emptyDB();
  db.vehicles.push({ id: "v", name: "Activa", type: "bike", fuelType: "petrol", initialOdometer: 5000, serviceIntervalKm: 3000, createdAt: "2026-01-01" });
  db.fuel.push({ id: "f", vehicleId: "v", date: "2026-02-01", odometer: 4000, litres: 4, price: 100, total: 400 });
  db.txns.push(
    { id: "a", type: "expense", amount: 80, category: "Food", date: "2026-04-01" },
    { id: "b", type: "expense", amount: 80, category: "Food", date: "2026-04-01" },
  );
  const issues = dataHealth(db);
  assert.ok(issues.some((i) => i.id.startsWith("odo:")));
  assert.ok(issues.some((i) => i.id.startsWith("dup:")));
});

test("the calendar and the morning line use dates already stored", () => {
  const db = emptyDB();
  db.vehicles.push({ id: "v", name: "Activa", type: "bike", fuelType: "petrol", initialOdometer: 1, serviceIntervalKm: 3000, insuranceExpiry: "2026-10-09", createdAt: "2026-01-01" });
  const events = calendarEvents(db);
  assert.equal(events[0]?.title, "Activa insurance");
  assert.match(morningLine(db, "2026-10-02"), /Activa insurance in 7 days/);
});
