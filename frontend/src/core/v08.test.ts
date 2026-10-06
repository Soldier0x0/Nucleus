import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { billBoardItems, billReminder, repeatingBillBoard, setBillMark } from "./bills.ts";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { documentBoardItems, missingDocumentNames } from "./documents.ts";
import { homeCard } from "./homeCards.ts";
import { homeBoardCanMove, reorderHomeTiles } from "./homeOrder.ts";
import { presentHome } from "./layouts.ts";
import { columnsFor, presetItems, showsCustomizeHome, swipeScreens, visiblePresetItems, PRESET_CHOICES } from "./presets.ts";
import { withSampleData, withoutSampleData } from "./sample.ts";
import type { Subscription, Trip, Vehicle } from "./types.ts";

const GUILT = /overdue|\bmissed\b|behind|\blate\b|\bfail/i;
const BARE_COUNT = /\d+\s+documents?\s+missing/i;

function trip(docs: Trip["docs"]): Trip {
  return {
    id: "trip-1",
    name: "Goa",
    destination: "Goa",
    start: "2026-10-10",
    end: "2026-10-14",
    travellers: 1,
    budget: 10,
    packing: [],
    itinerary: [],
    docs,
    createdAt: "2026-01-01",
  };
}

function vehicle(partial: Pick<Vehicle, "id" | "name" | "type"> & Partial<Vehicle>): Vehicle {
  return {
    fuelType: "petrol",
    initialOdometer: 0,
    serviceIntervalKm: 5000,
    createdAt: "2026-01-01",
    ...partial,
  };
}

function bill(partial: Pick<Subscription, "id" | "name" | "category"> & Partial<Subscription>): Subscription {
  return {
    amount: 1000,
    cycle: "monthly",
    nextRenewal: "2026-10-12",
    active: true,
    ...partial,
  };
}

test("a missing document is named, and a bare count is not used", () => {
  const db = emptyDB();
  db.trips.push(trip([
    { id: "ins", name: "Travel insurance", have: false },
    { id: "pass", name: "Passport / ID", have: true },
    { id: "tickets", name: "Tickets", have: false },
    { id: "blank", name: "  ", have: false },
  ]));
  db.vehicles.push(vehicle({ id: "bike", name: "City scooter", type: "bike" }));
  db.vehicles.push(vehicle({ id: "car", name: "Family car", type: "car", insuranceExpiry: "2027-01-01" }));
  const names = missingDocumentNames(db);
  const line = names.join(" · ");
  assert.ok(names.includes("Travel insurance"));
  assert.ok(names.includes("Tickets"));
  assert.equal(names.includes("Passport / ID"), false);
  assert.ok(names.includes("City scooter insurance"));
  assert.equal(names.includes("Family car insurance"), false);
  assert.equal(names.some((name) => /\bcar\b/i.test(name) && name.startsWith("City scooter")), false);
  assert.equal(line.includes("bike insurance"), false);
  assert.doesNotMatch(line, BARE_COUNT);
  assert.doesNotMatch(line, /document missing/i);
  assert.match(line, /Could not tell which document/);

  const card = homeCard(db, "docgaps");
  const cardLine = card.lines.join(" · ");
  assert.match(cardLine, /Travel insurance/);
  assert.match(cardLine, /Tickets/);
  assert.match(cardLine, /City scooter insurance/);
  assert.doesNotMatch(cardLine, BARE_COUNT);
  assert.doesNotMatch(cardLine, GUILT);

  const covered = emptyDB();
  covered.vehicles.push(vehicle({ id: "bike", name: "City scooter", type: "bike" }));
  covered.papers.push({ id: "paper", kind: "insurance", title: "City scooter insurance", vehicleId: "bike", createdAt: "2026-01-01" });
  assert.equal(missingDocumentNames(covered).includes("City scooter insurance"), false);
});

test("documents is its own board, short cards sit two-up, and a fuller card keeps the row", () => {
  const empty = emptyDB();
  assert.equal(empty.settings.theme, "paper");
  assert.equal(empty.settings.look, "cards");
  assert.equal(empty.settings.layout, "bento");
  assert.equal(PRESET_CHOICES.some((choice) => choice.id === "documents" && choice.name === "Documents"), true);
  assert.equal(showsCustomizeHome("documents"), false);
  assert.equal(homeBoardCanMove("documents"), false);
  assert.equal(reorderHomeTiles(empty, "documents", "docids", 1), empty);
  assert.equal(columnsFor("documents", 4), 2);
  assert.ok(swipeScreens("documents").includes("documents"));
  assert.equal(swipeScreens("money").includes("docgaps"), false);
  assert.equal(presetItems("money").some((item) => item.id === "docgaps"), false);

  const quiet = documentBoardItems(empty);
  assert.ok(quiet.length > 4);
  assert.equal(quiet.every((item) => item.size === "small"), true);
  const quietRows = presentHome("bento", quiet);
  assert.equal(quietRows.cardMin, 0);
  assert.equal(quietRows.rows[0]?.items.length, 2);
  assert.deepEqual(visiblePresetItems(empty, "documents").map((item) => item.id), quiet.map((item) => item.id));

  const named = emptyDB();
  named.trips.push(trip([
    { id: "ins", name: "Travel insurance", have: false },
    { id: "tickets", name: "Tickets", have: false },
  ]));
  const full = documentBoardItems(named);
  assert.equal(full[0]?.id, "docgaps");
  assert.equal(full[0]?.size, "large");
  const packed = presentHome("bento", full);
  assert.equal(packed.rows[0]?.items.length, 1);
  assert.equal(packed.rows[0]?.items[0]?.size, "large");
  assert.equal(packed.rows[1]?.items.length, 2);
  assert.equal(packed.rows[1]?.items.every((item) => item.size === "small"), true);

  const one = emptyDB();
  one.trips.push(trip([{ id: "ins", name: "Travel insurance", have: false }]));
  const short = presentHome("bento", documentBoardItems(one));
  assert.equal(short.rows[0]?.items.length, 2);
  assert.equal(short.rows[0]?.items.every((item) => item.size === "small"), true);

  const papers = readFileSync(new URL("../../app/papers/index.tsx", import.meta.url), "utf8");
  assert.match(papers, /missingDocumentNames\(/);
  assert.match(papers, /title="Documents"/);
  assert.doesNotMatch(papers, /document missing/i);
  const modes = readFileSync(new URL("../components/HomeModes.tsx", import.meta.url), "utf8");
  assert.match(modes, /NAMED_TILES/);
  assert.match(modes, /shown\.lines/);
});

test("papers and trip docs stay in the encrypted backup on this phone", () => {
  const db = emptyDB();
  db.papers.push({ id: "lic", kind: "licence", title: "Driving licence", createdAt: "2026-01-01" });
  db.trips.push(trip([{ id: "ins", name: "Travel insurance", have: false }]));
  const restored = normalizeDB(JSON.parse(JSON.stringify(db)));
  assert.equal(restored.papers[0]?.title, "Driving licence");
  assert.equal(restored.trips[0]?.docs[0]?.name, "Travel insurance");
  const backup = readFileSync(new URL("./backup.ts", import.meta.url), "utf8");
  assert.match(backup, /data: db/);
  assert.match(backup, /encryptWithPassword/);
  const privacy = readFileSync(new URL("./privacyCopy.ts", import.meta.url), "utf8");
  assert.match(privacy, /papers/);
  assert.match(privacy, /encrypted file on this phone/);
});

test("repeating bills are their own board and stay apart from one-off expenses", () => {
  const db = emptyDB();
  db.subscriptions.push(
    bill({ id: "rent", name: "Rent", category: "Rent", amount: 18000 }),
    bill({ id: "emi", name: "Home EMI", category: "Loan EMI", amount: 12000, nextRenewal: "2026-10-20" }),
    bill({ id: "news", name: "News", category: "Subscriptions", amount: 199, nextRenewal: "2026-11-01" }),
  );
  db.txns.push(
    { id: "oil-1", type: "expense", amount: 450, category: "Vehicle", date: "2026-08-02", note: "Activa · Engine oil" },
    { id: "oil-2", type: "expense", amount: 450, category: "Vehicle", date: "2026-09-02", note: "Activa · Engine oil" },
    { id: "fuel", type: "expense", amount: 560, category: "Fuel", date: "2026-08-01", note: "Activa · 5.6 L" },
    { id: "shop", type: "expense", amount: 80, category: "Groceries", date: "2026-10-03", note: "Weekly groceries" },
  );
  const names = repeatingBillBoard(db, "2026-10-06").map((row) => row.name);
  assert.deepEqual(names, ["Rent", "Home EMI", "News"]);
  assert.equal(names.some((name) => name.includes("Activa")), false);
  assert.equal(names.includes("Weekly groceries"), false);

  const due = homeCard(db, "billdue");
  assert.match(due.lines.join(" · "), /Rent/);
  assert.match(due.lines.join(" · "), /Home EMI/);
  assert.doesNotMatch(due.lines.join(" · "), /Activa|Weekly groceries/);
  assert.doesNotMatch(due.lines.join(" · "), GUILT);

  assert.equal(PRESET_CHOICES.some((choice) => choice.id === "bills" && choice.name === "Bills"), true);
  assert.equal(showsCustomizeHome("bills"), false);
  assert.equal(homeBoardCanMove("bills"), false);
  assert.equal(columnsFor("bills", 3), 2);
  assert.ok(swipeScreens("bills").includes("bills"));
  assert.equal(presetItems("money").some((item) => item.id === "billdue"), false);
  assert.equal(swipeScreens("money").includes("documents"), true);

  const open = billBoardItems(db, "2026-10-06");
  assert.equal(open.find((item) => item.id === "billdue")?.size, "large");
  const packed = presentHome("bento", open);
  assert.equal(packed.rows[0]?.items.length, 1);
  assert.equal(packed.rows[0]?.items[0]?.size, "large");
  assert.equal(packed.rows[1]?.items.length, 2);

  const lone = emptyDB();
  lone.subscriptions.push(bill({ id: "rent", name: "Rent", category: "Rent" }));
  const short = presentHome("bento", billBoardItems(lone, "2026-10-06"));
  assert.equal(short.rows[0]?.items.length, 2);
  assert.equal(short.rows[0]?.items.every((item) => item.size === "small"), true);

  const sampled = withSampleData(emptyDB());
  const sampleNames = repeatingBillBoard(sampled).map((row) => row.name);
  assert.equal(sampleNames.some((name) => name.includes("Activa")), false);
  assert.equal(sampleNames.includes("Rent"), false);
  const cleaned = withoutSampleData(sampled);
  assert.equal(repeatingBillBoard(cleaned).some((row) => row.name.includes("Activa")), false);
  assert.equal(repeatingBillBoard(cleaned).some((row) => row.name === "Netflix"), false);
});

test("due, paid, and snooze stay ordinary reminders", () => {
  const db = emptyDB();
  db.subscriptions.push(bill({ id: "rent", name: "Rent", category: "Rent", nextRenewal: "2026-10-02" }));
  const today = "2026-10-06";
  const due = repeatingBillBoard(db, today)[0];
  assert.ok(due);
  assert.equal(due.mark, "due");
  const dueLine = billReminder(due);
  assert.match(dueLine, /Rent is due/);
  assert.doesNotMatch(dueLine, GUILT);

  const snoozed = setBillMark(db, "rent", "snoozed", today);
  assert.equal(snoozed.subscriptions[0]?.nextRenewal, "2026-10-02");
  assert.equal(snoozed.txns.length, 0);
  const snoozeRow = repeatingBillBoard(snoozed, today)[0];
  assert.equal(snoozeRow?.mark, "snoozed");
  assert.match(billReminder(snoozeRow!), /Rent is snoozed/);
  assert.doesNotMatch(billReminder(snoozeRow!), GUILT);

  const paid = setBillMark(db, "rent", "paid", today);
  assert.equal(paid.subscriptions[0]?.nextRenewal, "2026-11-02");
  const paidRow = repeatingBillBoard(paid, today)[0];
  assert.equal(paidRow?.mark, "paid");
  assert.match(billReminder(paidRow!), /Rent is paid/);
  assert.doesNotMatch(billReminder(paidRow!), GUILT);
  const again = setBillMark(paid, "rent", "due", today);
  assert.equal(repeatingBillBoard(again, today)[0]?.mark, "due");

  const screen = readFileSync(new URL("../../app/bills/index.tsx", import.meta.url), "utf8");
  assert.match(screen, /Due/);
  assert.match(screen, /Paid/);
  assert.match(screen, /Snooze/);
  assert.match(screen, /setBillMark\(/);
  assert.doesNotMatch(screen, GUILT);
  assert.doesNotMatch(screen, /Activa/);
  assert.doesNotMatch(screen, /repeatingBills\(/);
});

test("v0.8 does not add a music player", () => {
  assert.equal(existsSync(new URL("../../app/music/index.tsx", import.meta.url)), false);
  const pkg = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
  assert.equal(pkg.includes("expo-audio"), false);
  assert.equal(pkg.includes("expo-av"), false);
});
