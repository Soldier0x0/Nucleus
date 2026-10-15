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

test("capture lexicon acceptance samples from v0.9.2 plan", () => {
  const db = emptyDB();
  db.vehicles.push({ id: "v", name: "Activa", type: "bike", fuelType: "petrol", initialOdometer: 10000, serviceIntervalKm: 3000, createdAt: "2026-01-01" });

  const full = parseCapture(db, "Activa 5.4L 560 full 12450 km");
  assert.ok(full && !("error" in full));
  if (!full || "error" in full) return;
  const saved = full.apply(db);
  assert.equal(saved.fuel[0]?.fillKind, "full");
  assert.equal(saved.fuel[0]?.odometer, 12450);

  const partial = parseCapture(db, "Activa partial 3L 320");
  assert.ok(partial && !("error" in partial));
  if (!partial || "error" in partial) return;
  assert.equal(partial.apply(db).fuel.at(-1)?.fillKind, "partial");

  const odo = parseCapture(db, "Activa odo 12500");
  assert.ok(odo && !("error" in odo));
  if (!odo || "error" in odo) return;
  assert.equal(odo.apply(db).odometerLogs[0]?.odometer, 12500);

  const journey = parseCapture(db, "Activa journey 12450 12510");
  assert.ok(journey && !("error" in journey));
  if (!journey || "error" in journey) return;
  const j = journey.apply(db).vehicleJourneys[0];
  assert.equal(j?.startOdometer, 12450);
  assert.equal(j?.endOdometer, 12510);
  assert.equal(journey.apply(db).trips.length, 0);

  const service = parseCapture(db, "Activa service oil 800");
  assert.ok(service && !("error" in service));
  if (!service || "error" in service) return;
  assert.equal(service.apply(db).services[0]?.kind, "oil");

  const tank = parseCapture(db, "Activa tank 5.3");
  assert.ok(tank && !("error" in tank));
  if (!tank || "error" in tank) return;
  assert.equal(tank.apply(db).vehicles[0]?.tankLitres, 5.3);

  const lunch = parseCapture(db, "450 food lunch");
  assert.ok(lunch && !("error" in lunch));
  if (!lunch || "error" in lunch) return;
  assert.equal(lunch.apply(db).txns[0]?.category, "Food");
  const income = parseCapture(db, "+50000 salary");
  assert.ok(income && !("error" in income));
  if (!income || "error" in income) return;
  assert.equal(income.apply(db).txns[0]?.type, "income");

  const uber = parseCapture(db, "uber 180");
  assert.ok(uber && !("error" in uber));
  if (!uber || "error" in uber) return;
  assert.equal(uber.apply(db).txns[0]?.category, "Travel");

  const hotel = parseCapture(db, "hotel 3200");
  assert.ok(hotel && !("error" in hotel));
  if (!hotel || "error" in hotel) return;
  assert.equal(hotel.apply(db).txns[0]?.category, "Travel");

  const cycle = parseCapture(db, "period started");
  assert.ok(cycle && !("error" in cycle));
  if (!cycle || "error" in cycle) return;
  assert.ok(cycle.apply(db).cycle.days.some((d) => d.bleeding === "flow"));

  const puc = parseCapture(db, "puc expiry 2026-12-01");
  assert.ok(puc && !("error" in puc));
  if (!puc || "error" in puc) return;
  assert.equal(puc.apply(db).papers[0]?.expiry, "2026-12-01");

  const legacy = parseCapture(db, "5.4L @103.7 Activa");
  assert.ok(legacy && !("error" in legacy));
  const sub = parseCapture(db, "netflix 649 monthly");
  assert.ok(sub && !("error" in sub));
  const gro = parseCapture(db, "onion 80 groceries");
  assert.ok(gro && !("error" in gro));
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
