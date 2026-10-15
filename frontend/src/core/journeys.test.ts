import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { addTripExpense, tripTxns, upsertTrip } from "./domains.ts";
import { isJourneyTrip, transitLabel, tripKindOf } from "./transit.ts";
import { menuSections } from "./menu.ts";
import type { Trip, Txn } from "./types.ts";

const trip = (patch: Partial<Trip>): Trip => ({
  id: "t1",
  name: "Goa 2026",
  destination: "Goa",
  start: "2026-11-01",
  end: "2026-11-05",
  travellers: 2,
  budget: 20000,
  packing: [],
  itinerary: [],
  docs: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});

test("journeys: old rows migrate — a personal trip becomes a journey card", () => {
  const db = normalizeDB({ ...emptyDB(), trips: [trip({})] });
  assert.equal(db.trips[0].kind, "journey");
  assert.equal(isJourneyTrip(db.trips[0]), true);
});

test("journeys: a same-day public ride migrates to daily transit, an overnight one stays a journey", () => {
  const db = normalizeDB({
    ...emptyDB(),
    trips: [
      trip({ mode: "public", transit: "metro", start: "2026-11-01", end: "2026-11-01" }),
      trip({ id: "t2", mode: "public", transit: "train", start: "2026-11-01", end: "2026-11-02" }),
    ],
  });
  assert.equal(db.trips[0].kind, "transit");
  assert.equal(isJourneyTrip(db.trips[0]), false);
  assert.equal(db.trips[1].kind, "journey");
  assert.equal(isJourneyTrip(db.trips[1]), true);
});

test("journeys: an explicit tap wins over the dates", () => {
  const db = normalizeDB({ ...emptyDB(), trips: [trip({ kind: "journey", mode: "public", transit: "cab", start: "2026-11-01", end: "2026-11-01" })] });
  assert.equal(db.trips[0].kind, "journey");
  assert.equal(tripKindOf({ mode: "public", transit: "cab", start: "2026-11-01", end: "2026-11-01" }), "transit");
  assert.equal(tripKindOf({ mode: "personal" }), "journey");
});

test("journeys: a flight gets a name and a same-day flight is daily transit", () => {
  assert.equal(transitLabel("flight"), "Flight");
  assert.equal(tripKindOf({ mode: "public", transit: "flight", start: "2026-11-01", end: "2026-11-01" }), "transit");
  assert.equal(isJourneyTrip(trip({ mode: "public", transit: "flight", start: "2026-11-01", end: "2026-11-02" })), true);
});

test("journeys: expenses carry tripId and tripTxns counts every row once", () => {
  let db = emptyDB();
  const t = trip({});
  db = upsertTrip(db, t);
  db = addTripExpense(db, t.id, { id: "x1", type: "expense", amount: 500, category: "Travel", date: "2026-11-02", note: "Train tickets" });
  db = addTripExpense(db, t.id, { id: "x2", type: "expense", amount: 250, category: "Travel", date: "2026-11-03", note: "Cab or taxi" });
  assert.equal(db.txns[0].tripId, t.id);
  assert.equal(tripTxns(db, t.id).length, 2);
  const manual: Txn = { id: "x3", type: "expense", amount: 100, category: "Travel", date: "2026-11-04", note: "Snacks", tripId: t.id };
  const withManual = { ...db, txns: [...db.txns, manual] };
  assert.equal(tripTxns(withManual, t.id).length, 3);
});

test("journeys: the menu keeps a Journeys link under Money", () => {
  const money = menuSections(emptyDB()).find((section) => section.id === "money");
  assert.ok(money?.links.some((link) => link.id === "journeys" && link.module === "money"));
});

test("journeys: MoneyDesk lists journey cards only and links to the board", () => {
  const src = readFileSync(new URL("../components/MoneyDesk.tsx", import.meta.url), "utf8");
  assert.match(src, /isJourneyTrip/);
  assert.match(src, /money-journeys-open/);
});
