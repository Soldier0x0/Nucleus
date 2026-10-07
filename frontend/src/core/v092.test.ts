import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { parseCapture } from "./capture.ts";
import { parseFuelDraft } from "./fuelCapture.ts";
import { classifyMoney } from "./moneyWords.ts";
import { fuelMileagePoints, motorPolicyBadges, serviceLeftLine } from "./vehicleMath.ts";
import { vehicleDocTileIds, vehicleDocBoardItems } from "./vehicleDocs.ts";
import { paperIsPdf } from "./paperNormalize.ts";
import { buildDeveloperLog, scrubStack } from "./devLogs.ts";
import type { FuelEntry } from "./types.ts";

test("fuel mileage uses full-to-full chain and ignores partial top-ups", () => {
  const entries: FuelEntry[] = [
    { id: "1", vehicleId: "v", date: "2026-04-01", odometer: 1000, litres: 5, price: 100, total: 500, fillKind: "full" },
    { id: "2", vehicleId: "v", date: "2026-04-05", odometer: 1100, litres: 2, price: 100, total: 200, fillKind: "partial" },
    { id: "3", vehicleId: "v", date: "2026-04-10", odometer: 1200, litres: 5, price: 100, total: 500, fillKind: "full" },
  ];
  const points = fuelMileagePoints(entries);
  assert.equal(points.length, 1);
  assert.equal(points[0]?.value, 40);
});

test("motor policy badges stay on one tile — no RSA board tile", () => {
  const db = emptyDB();
  db.vehicles.push({ id: "v", name: "Activa", type: "bike", fuelType: "petrol", initialOdometer: 0, serviceIntervalKm: 3000, createdAt: "2026-01-01" });
  db.papers.push({
    id: "m1",
    kind: "insurance",
    title: "Comprehensive",
    motorCover: "comprehensive",
    vehicleId: "v",
    rsaAddOn: true,
    zeroDepAddOn: true,
    createdAt: "2026-01-01",
  });
  assert.deepEqual(vehicleDocTileIds(db, "v"), ["vdoc-motor"]);
  assert.deepEqual(motorPolicyBadges(db.papers[0]), ["RSA", "ZeroDep"]);
  const board = vehicleDocBoardItems(db);
  assert.equal(board[0]?.id, "vdoc-motor");
  assert.equal(board[0]?.size, "large");
});

test("normalize keeps legacy fuel rows as full fills", () => {
  const db = normalizeDB({
    version: 1,
    fuel: [{ id: "f1", vehicleId: "v", date: "2026-04-01", odometer: 100, litres: 5, price: 100, total: 500 }],
  });
  assert.equal(db.fuel[0]?.fillKind, "full");
});

test("capture understands partial fill and timed fuel phrases", () => {
  const db = emptyDB();
  db.vehicles.push({ id: "v", name: "Activa", type: "bike", fuelType: "petrol", initialOdometer: 1000, serviceIntervalKm: 3000, createdAt: "2026-01-01" });
  const draft = parseFuelDraft(db, "Activa partial 5L 560 2026-04-02 14:30");
  assert.equal(draft?.fillKind, "partial");
  assert.equal(draft?.loggedAt, "2026-04-02T14:30:00");
  const cap = parseCapture(db, "40 samosa");
  assert.ok(cap && "apply" in cap);
});

test("money and travel lexicon samples still resolve", () => {
  assert.equal(classifyMoney("netflix 649", false)?.category, "Subscriptions");
  assert.equal(classifyMoney("metro card", false)?.item, "Metro");
  assert.equal(classifyMoney("puc renewal", false)?.category, "Vehicle");
});

test("developer log scrubs stacks and omits capture text", () => {
  const stack = scrubStack("Error: boom\n    at Object.foo (main.js:12:34)\n    at bar 987654321");
  assert.ok(stack?.includes("n"));
  const log = buildDeveloperLog();
  assert.match(log, /schema: nucleus-dev-log/);
  assert.ok(!log.includes("samosa"));
});

test("pdf mime normalize for viewer path", () => {
  const paper = { id: "p", kind: "insurance" as const, title: "Policy", file: "data:application/pdf;base64,JVBERi0=", mime: "application/pdf", createdAt: "2026-01-01" };
  assert.equal(paperIsPdf(paper), true);
});

test("vehicle journeys stay separate from travel trips", () => {
  const db = emptyDB();
  db.vehicles.push({ id: "v", name: "Bike", type: "bike", fuelType: "petrol", initialOdometer: 0, serviceIntervalKm: 3000, createdAt: "2026-01-01" });
  db.vehicleJourneys.push({ id: "j1", vehicleId: "v", startAt: "2026-04-01T08:00:00", startOdometer: 100, endAt: "2026-04-01T18:00:00", endOdometer: 180 });
  db.trips.push({ id: "t1", name: "Goa", destination: "Goa", start: "2026-04-01", end: "2026-04-05", travellers: 1, budget: 0, packing: [], itinerary: [], docs: [], createdAt: "2026-01-01" });
  assert.equal(db.trips.length, 1);
  assert.equal(db.vehicleJourneys.length, 1);
  assert.equal(serviceLeftLine(3000).includes("to service"), true);
});
