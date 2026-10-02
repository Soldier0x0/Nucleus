import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { choreDueDate, roomSummaries, utilityEstimate } from "./domains.ts";
import { buildDecoyDB, parseProfileIndex, persistDocumentKey, pickPinMatch } from "./profiles.ts";

test("primary pin wins when both match", () => {
  assert.equal(pickPinMatch(true, true), "primary");
  assert.equal(pickPinMatch(false, true), "decoy");
  assert.equal(pickPinMatch(false, false), "none");
});

test("decoy writes never target the real document", () => {
  assert.equal(persistDocumentKey("real"), "nucleus.db.v1");
  assert.equal(persistDocumentKey("decoy"), "nucleus.profile.decoy.v1");
});

test("a broken profile index falls back to Personal", () => {
  assert.equal(parseProfileIndex(null).activeId, "personal");
  assert.equal(parseProfileIndex("{").profiles[0].name, "Personal");
  const parsed = parseProfileIndex(JSON.stringify({ activeId: "missing", profiles: [{ id: "work", name: " Work " }] }));
  assert.equal(parsed.activeId, "work");
  assert.equal(parsed.profiles[0].name, "Work");
});

test("decoy data does not keep real records", () => {
  const real = emptyDB();
  real.settings.currency = "EUR";
  real.settings.theme = "dune";
  real.settings.emergency = { ...real.settings.emergency, bloodGroup: "O+", showOnLock: true };
  real.txns = [{ id: "secret-txn", type: "expense", amount: 99999, category: "Other", date: "2026-01-01" }];
  const decoy = buildDecoyDB(real);
  assert.equal(decoy.txns.some((t) => t.id === "secret-txn"), false);
  assert.ok(decoy.vehicles.length > 0);
  assert.equal(decoy.settings.currency, "EUR");
  assert.equal(decoy.settings.theme, "dune");
  assert.equal(decoy.settings.onboarded, true);
  assert.equal(decoy.settings.emergency.bloodGroup, "O+");
  assert.equal(decoy.settings.emergency.showOnLock, true);
});

test("utility estimate uses earlier bills, and chores count from the last done date", () => {
  const bills = [
    { id: "a", kind: "electricity" as const, date: "2026-01-01", amount: 100 },
    { id: "b", kind: "electricity" as const, date: "2026-02-01", amount: 200 },
    { id: "c", kind: "electricity" as const, date: "2026-03-01", amount: 300 },
  ];
  const est = utilityEstimate(bills, "electricity");
  assert.equal(est.last?.amount, 300);
  assert.equal(est.usual, 150);
  assert.equal(choreDueDate({ id: "c", name: "Bins", everyDays: 7, lastDone: "2026-01-01" }, "2026-01-08"), 0);
  assert.equal(choreDueDate({ id: "c", name: "Bins", everyDays: 7, lastDone: "2026-01-01" }, "2026-01-10"), -2);
});

test("room summaries group appliances and chores", () => {
  const db = emptyDB();
  db.appliances = [
    { id: "a", name: "AC", room: "Bedroom", plans: [], createdAt: "2026-01-01" },
    { id: "b", name: "Fridge", room: "Kitchen", plans: [{ id: "p", name: "Filter", everyMonths: 3, lastDone: "2020-01-01" }], createdAt: "2026-01-01" },
  ];
  db.chores = [{ id: "c", name: "Bins", everyDays: 7, lastDone: "2020-01-01", room: "Kitchen" }];
  const rooms = roomSummaries(db, "2026-06-01");
  const kitchen = rooms.find((r) => r.room === "Kitchen");
  assert.equal(kitchen?.status, "urgent");
  assert.equal(kitchen?.appliances, 1);
  assert.equal(rooms.find((r) => r.room === "Bedroom")?.status, "ok");
});
