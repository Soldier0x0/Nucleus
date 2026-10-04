import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { ADHD_VOICE, adhdBuddy, adhdOpen, adhdReminder, adhdTimer, adhdView, applyPreset, columnsFor, dismissQuiet, ensureAdhdStep, homeBlocks, homePresetTiles, lastPresetThing, moduleAlerts, noteAdhdDay, parkAdhdTask, presetBoard, presetItems, presetTileTitle, recallAdhdTask, rememberPreset, resumeLines, reviewAdhdDay, rowsFor, setAdhdBuddy, setAdhdMotion, snoozeAdhdReminder, startAdhdTask, swipeScreens, tilePlaceholder, typeAdhdDraft, visiblePresetItems, PRESET_CHOICES } from "./presets.ts";
import { buildDecoyDB } from "./profiles.ts";
import type { DB } from "./types.ts";

const RECORD_KEYS = [
  "vehicles",
  "fuel",
  "services",
  "txns",
  "subscriptions",
  "links",
  "trips",
  "appliances",
  "utilities",
  "chores",
  "notes",
  "rules",
  "ruleFires",
  "customTools",
  "media",
  "funds",
  "debts",
  "netWorth",
  "people",
  "papers",
  "parts",
  "specs",
  "kanban",
  "wiki",
  "templates",
  "netlog",
  "budget",
  "attention",
  "toolHistory",
  "recents",
  "cycle",
] as const;

function records(db: DB) {
  const out: Record<string, unknown> = {};
  for (const key of RECORD_KEYS) out[key] = db[key];
  return out;
}

function filled(): DB {
  const db = emptyDB();
  db.txns.push({ id: "txn-1", type: "expense", amount: 40, category: "Fuel", date: "2026-10-01" });
  db.trips.push({
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
  });
  db.papers.push({ id: "paper-1", kind: "licence", title: "Licence", createdAt: "2026-10-01" });
  db.fuel.push({ id: "fuel-1", vehicleId: "v1", date: "2026-10-01", odometer: 1000, litres: 10, price: 100, total: 1000 });
  db.notes.push({ id: "note-1", title: "List", body: "milk", checklist: [], createdAt: "2026-10-01", updatedAt: "2026-10-01" });
  db.vehicles.push({ id: "v1", name: "Bike", type: "bike", fuelType: "petrol", initialOdometer: 0, serviceIntervalKm: 3000, createdAt: "2026-10-01" });
  return db;
}

test("switching preset does not delete or relocate stored records", () => {
  const db = filled();
  const before = records(db);
  const money = applyPreset(db, "money");
  assert.deepEqual(records(money), before);
  assert.equal(money.txns[0]?.id, "txn-1");
  assert.equal(money.trips.some((trip) => trip.id === "txn-1"), false);
  assert.equal(money.fuel.some((row) => row.id === "txn-1"), false);
  assert.equal(money.txns.some((row) => row.id === "fuel-1"), false);
  assert.equal(money.papers[0]?.id, "paper-1");
  assert.equal(money.settings.homePreset, "money");
  const { homePreset: moneyPreset, ...moneyRest } = money.settings;
  const { homePreset: originalPreset, ...originalRest } = db.settings;
  assert.equal(moneyPreset, "money");
  assert.notEqual(moneyPreset, originalPreset);
  assert.deepEqual(moneyRest, originalRest);

  const travel = applyPreset(money, "travel");
  assert.deepEqual(records(travel), before);
  assert.equal(travel.fuel[0]?.id, "fuel-1");
  assert.equal(travel.settings.currency, db.settings.currency);
  assert.deepEqual(travel.settings.modules, db.settings.modules);
  assert.notDeepEqual(
    presetItems("travel").map((item) => item.id),
    presetItems("money").map((item) => item.id),
  );
});

test("a preset lists more than four relevant items in a stable priority order", () => {
  const travel = presetItems("travel").map((item) => item.id);
  const money = presetItems("money").map((item) => item.id);
  assert.ok(travel.length > 4);
  assert.ok(money.length > 4);
  assert.deepEqual(presetItems("travel").map((item) => item.id), travel);
  assert.deepEqual(presetItems("money").map((item) => item.id), money);
  assert.equal(travel[0], "route");
  assert.equal(money[0], "balance");
  const travelOrder = ["route", "mileage", "fuel", "papers"];
  for (let i = 0; i < travelOrder.length - 1; i++) {
    assert.ok(travel.indexOf(travelOrder[i]) < travel.indexOf(travelOrder[i + 1]));
  }
  for (const id of ["route", "mileage", "fuel", "papers", "vehicle", "service"]) assert.ok(travel.includes(id));
  for (const id of ["balance", "spending", "charts", "receipts", "bills"]) assert.ok(money.includes(id));
  assert.ok(PRESET_CHOICES.length < 10);
  assert.ok(PRESET_CHOICES.some((choice) => choice.id === "custom"));
  assert.equal(PRESET_CHOICES.find((choice) => choice.id === "adhd")?.name, "ADHD mode");
});

test("two small items share a row and a large item stays full width", () => {
  const money = presetItems("money");
  const rows = rowsFor(money);
  assert.equal(rows[0]?.items.length, 1);
  assert.equal(rows[0]?.items[0]?.id, "balance");
  assert.equal(rows[0]?.items[0]?.size, "large");
  assert.equal(rows[1]?.items.length, 2);
  assert.equal(rows[1]?.items[0]?.size, "small");
  assert.equal(rows[1]?.items[1]?.size, "small");
  assert.deepEqual(
    rows.flatMap((row) => row.items.map((item) => item.id)),
    money.map((item) => item.id),
  );

  const travelRows = rowsFor(presetItems("travel"));
  assert.equal(travelRows[0]?.items.length, 1);
  assert.equal(travelRows[0]?.items[0]?.id, "route");
  assert.equal(travelRows[0]?.items[0]?.size, "large");
  assert.equal(travelRows[1]?.items.length, 2);
  assert.equal(travelRows[1]?.items.every((item) => item.size === "small"), true);
});

test("custom uses more than one column when the board is small", () => {
  assert.ok(columnsFor("custom", 3) >= 2);
  assert.equal(columnsFor("custom", 1), 1);
});

test("ADHD mode renders a single next action and does not wipe stored data", () => {
  const db = filled();
  const started = startAdhdTask(db, "Pay the bill");
  const queued = startAdhdTask(started, "Reply to the mail");
  const shown = applyPreset(queued, "adhd");
  assert.deepEqual(records(shown), records(db));
  assert.equal(shown.txns[0]?.id, "txn-1");
  assert.equal(shown.notes[0]?.id, "note-1");
  assert.equal(homeBlocks("adhd", shown).length, 1);

  const view = adhdView(shown);
  assert.equal(view.next?.line, "Pay the bill");
  assert.equal(view.rest, 1);
  assert.equal(view.more, "tap");
  assert.equal(view.type, "plain");
  assert.equal(view.typeSize, "large");
  assert.equal(view.motion, false);
  assert.equal(/streak|score|guilt|failed|lazy|shame/i.test(view.lines.join(" ")), false);
  assert.equal(queued.settings.adhd.tasks[0]?.started, true);

  const away = applyPreset(shown, "money");
  const back = applyPreset(away, "adhd");
  assert.equal(adhdView(back).next?.line, "Pay the bill");
  assert.equal(homeBlocks("adhd", back).length, 1);
  assert.deepEqual(records(back), records(db));

  const reminder = adhdReminder("Pay the bill");
  assert.equal(reminder.line, "Pay the bill");
  assert.equal(reminder.body, "Pay the bill");
  assert.equal(reminder.lines, 1);
  assert.deepEqual(reminder.actions, ["Snooze"]);

  const snoozed = snoozeAdhdReminder(back, "2026-10-04");
  assert.equal(snoozed.settings.adhd.reminder.snoozedUntil, "2026-10-04");
  assert.equal(adhdView(snoozed).next?.line, "Pay the bill");
  assert.deepEqual(records(snoozed), records(db));

  assert.equal(adhdView(setAdhdMotion(snoozed, true)).motion, true);
});

function numericScore(db: DB): number {
  const bag = db.settings.adhd as unknown as { score?: unknown; points?: unknown; streak?: unknown } | undefined;
  const raw = bag?.score ?? bag?.points ?? bag?.streak ?? 0;
  return typeof raw === "number" ? raw : 0;
}

test("a day with no finished task does not decrease any score and is not labeled a miss", () => {
  const db = emptyDB();
  const day = reviewAdhdDay(db, []);
  assert.equal(day.missed, false);
  assert.equal(day.delta, 0);
  assert.equal(day.quota, null);
  assert.equal(day.label, "break");
  assert.equal(/miss|loss|quota|streak|points/i.test(day.label), false);
  assert.notEqual(day.tone, "red");
  assert.deepEqual(day.marks, []);

  const noted = noteAdhdDay(db, []);
  assert.equal(numericScore(noted), numericScore(db));
  assert.ok(numericScore(noted) >= numericScore(db));
  assert.deepEqual(noted.settings.adhd.finished, db.settings.adhd.finished);
  assert.equal(/miss/i.test(JSON.stringify(noted.settings.adhd.finished)), false);
  assert.deepEqual(records(noted), records(db));
});

const PRESSURE = /overdue|\bmissed\b|behind|\blate\b|\bfail|streak|\bscore\b|points|quota|congrat|good job|welcome back|hurry/i;

test("every preset shows its tiles when there is no data", () => {
  const db = emptyDB();
  for (const preset of ["money", "travel", "home", "desk", "workshop"] as const) {
    const shown = visiblePresetItems(db, preset);
    const catalog = presetItems(preset);
    assert.ok(catalog.length > 4, preset);
    assert.deepEqual(shown.map((item) => item.id), catalog.map((item) => item.id));
    assert.equal(shown[0]?.size, "large");
  }
  const custom = visiblePresetItems(db, "custom").map((item) => item.id);
  assert.deepEqual(custom, db.settings.tiles.filter((tile) => tile.enabled).map((tile) => tile.id));
  assert.ok(custom.includes("weather"));
  assert.ok(custom.includes("trip"));
  assert.ok(custom.includes("budget"));
  const money = applyPreset(db, "money");
  assert.equal(money.settings.homePreset, "money");
  assert.deepEqual(money.txns, db.txns);
  assert.deepEqual(money.trips, db.trips);
  assert.deepEqual(money.notes, db.notes);
  for (const id of ["attention", "weather", "trip", "budget", "vehicle", "home", "subscriptions", "notes", "tools"]) {
    const copy = tilePlaceholder(id);
    assert.ok(copy.title.trim().length > 0, id);
    assert.ok(copy.line.trim().length > 0, id);
    assert.equal(PRESSURE.test(`${copy.title} ${copy.line}`), false, id);
  }
});

test("the decoy board hides cycle and money tiles", () => {
  const decoy = buildDecoyDB(emptyDB());
  const home = presetBoard(decoy, "home", "decoy").map((item) => item.id);
  assert.equal(home.includes("cycle"), false);
  assert.equal(home.includes("chores"), true);
  assert.equal(presetBoard(decoy, "money", "decoy").length, 0);
  const custom = presetBoard(decoy, "custom", "decoy").map((item) => item.id);
  assert.equal(custom.includes("budget"), false);
  assert.equal(custom.includes("subscriptions"), false);
  assert.equal(custom.includes("weather"), true);
  assert.ok(presetBoard(emptyDB(), "money", "real").length > 4);
});

test("a preset still lists every tile when only some records exist", () => {
  const bare = emptyDB();
  bare.trips.push({
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
  });
  const shown = visiblePresetItems(bare, "travel").map((item) => item.id);
  assert.equal(shown.includes("fuel"), true);
  assert.equal(shown.includes("mileage"), true);
  assert.equal(shown[0], "route");
  assert.deepEqual(shown, presetItems("travel").map((item) => item.id));

  const rich = filled();
  rich.fuel.push({ id: "fuel-2", vehicleId: "v1", date: "2026-10-02", odometer: 1200, litres: 8, price: 100, total: 800 });
  rich.services.push({ id: "svc-1", vehicleId: "v1", date: "2026-09-01", odometer: 900, kind: "general", cost: 20, details: {} });
  rich.txns.push({ id: "txn-photo", type: "expense", amount: 12, category: "Food", date: "2026-10-02", photo: "page" });
  rich.txns.push({ id: "rent-1", type: "expense", amount: 10, category: "Rent", date: "2026-08-01", note: "Rent" });
  rich.txns.push({ id: "rent-2", type: "expense", amount: 10, category: "Rent", date: "2026-09-01", note: "Rent" });
  rich.budget = { monthly: 100, categories: {} };
  rich.subscriptions.push({ id: "sub-1", name: "News", amount: 5, cycle: "monthly", nextRenewal: "2026-10-20", category: "Subscriptions", active: true });
  const travel = visiblePresetItems(rich, "travel").map((item) => item.id);
  const money = visiblePresetItems(rich, "money").map((item) => item.id);
  assert.ok(travel.length > 4);
  assert.ok(money.length > 4);
  assert.deepEqual(travel, presetItems("travel").map((item) => item.id).filter((id) => travel.includes(id)));
  assert.equal(travel[0], "route");
  assert.ok(travel.indexOf("mileage") < travel.indexOf("fuel"));
  assert.ok(money.includes("receipts"));
  assert.equal(visiblePresetItems(filled(), "money").some((item) => item.id === "receipts"), true);
});

test("a preset remembers the last thing done in it", () => {
  const saved = rememberPreset(filled(), "money", "txn-1");
  assert.equal(lastPresetThing(saved, "money"), "txn-1");
  const away = rememberPreset(applyPreset(saved, "travel"), "travel", "trip-1");
  assert.equal(lastPresetThing(away, "money"), "txn-1");
  assert.equal(lastPresetThing(away, "travel"), "trip-1");
});

test("money and travel show different tiles, and each title names that tile", () => {
  const db = emptyDB();
  const money = homePresetTiles(db, "money", "real").map((item) => item.id);
  const travel = homePresetTiles(db, "travel", "real").map((item) => item.id);
  assert.deepEqual(money, presetItems("money").map((item) => item.id));
  assert.deepEqual(travel, presetItems("travel").map((item) => item.id));
  assert.equal(money.includes("route"), false);
  assert.equal(money.includes("fuel"), false);
  assert.equal(travel.includes("balance"), false);
  assert.equal(travel.includes("receipts"), false);
  assert.ok(money.length > 0);
  assert.ok(travel.length > 0);
  const named = (id: string) => presetTileTitle(id).toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const id of [...money, ...travel]) {
    assert.equal(named(id), id, id);
    assert.notEqual(presetTileTitle(id), "Open");
  }
  const home = readFileSync(new URL("../../app/(tabs)/index.tsx", import.meta.url), "utf8");
  const modes = readFileSync(new URL("../components/HomeModes.tsx", import.meta.url), "utf8");
  assert.equal(home.includes("SwipeHome"), false);
  assert.equal(modes.includes("swipeScreens("), false);
  assert.match(modes, /homePresetTiles\(/);
  assert.match(modes, /presetTileTitle\(/);
});

test("money and travel each stay on their own board", () => {
  assert.deepEqual(swipeScreens("money"), ["money"]);
  assert.deepEqual(swipeScreens("travel"), ["travel"]);
  assert.deepEqual(swipeScreens("home"), ["home"]);
  assert.deepEqual(swipeScreens("adhd"), ["adhd"]);
});

test("travel opens on the travel tiles and money opens on the money tiles", () => {
  const db = emptyDB();
  const travel = homePresetTiles(db, "travel", "real").map((item) => item.id);
  const money = homePresetTiles(db, "money", "real").map((item) => item.id);
  assert.deepEqual(travel.slice(0, 5), ["route", "mileage", "fuel", "papers", "vehicle"]);
  assert.deepEqual(money.slice(0, 5), ["balance", "spending", "charts", "receipts", "bills"]);
  assert.deepEqual(swipeScreens("travel"), ["travel"]);
  assert.notEqual(swipeScreens("travel")[0], "money");
  assert.deepEqual(swipeScreens("money"), ["money"]);
  const home = readFileSync(new URL("../../app/(tabs)/index.tsx", import.meta.url), "utf8");
  assert.match(home, /<PresetGrid preset=\{preset\} \/>/);
  assert.equal(home.includes("SwipeHome"), false);
});

test("the timer shows time already spent and does not count down", () => {
  const early = adhdTimer({ startedAt: 0, now: 120_000, lastMs: 600_000, bufferMs: 300_000 });
  const later = adhdTimer({ startedAt: 0, now: 180_000, lastMs: 600_000, bufferMs: 300_000 });
  assert.equal(early.spentMs, 120_000);
  assert.ok(later.spentMs > early.spentMs);
  assert.equal(early.lastMs, 600_000);
  assert.equal(early.bufferMs, 300_000);
  assert.equal(early.countsDown, false);
  assert.equal(early.remainingMs, null);
  assert.equal(early.deadline, null);
  assert.equal(PRESSURE.test(early.label), false);
  assert.equal(/left|remain|deadline/i.test(early.label), false);
});

test("one tap opens the field that needs filling and seeds the first known word", () => {
  const db = emptyDB();
  db.txns.push({ id: "shop-1", type: "expense", amount: 10, category: "Food", date: "2026-10-01", item: "Morning Cafe", note: "tea" });
  db.txns.push({ id: "gap-1", type: "expense", amount: 12, category: "Food", date: "2026-10-02" });
  const opened = ensureAdhdStep(db);
  const step = adhdOpen(opened);
  assert.equal(step?.kind, "money");
  assert.equal(step?.recordId, "gap-1");
  assert.equal(step?.field, "note");
  assert.equal(step?.seed, "Morning");
  assert.match(step?.route ?? "", /gap-1/);
  assert.match(step?.route ?? "", /field=note/);
});

test("leaving and coming back keeps typed text and does not comment on the gap", () => {
  const db = emptyDB();
  db.txns.push({ id: "gap-1", type: "expense", amount: 12, category: "Food", date: "2026-10-02", item: "Depot" });
  const typed = typeAdhdDraft(ensureAdhdStep(db), "Depot lunch");
  const back = applyPreset(applyPreset(typed, "money"), "adhd");
  assert.equal(adhdOpen(back)?.draft, "Depot lunch");
  const lines = resumeLines(back, 5 * 60 * 60 * 1000);
  assert.deepEqual(lines, ["Depot lunch"]);
  assert.equal(PRESSURE.test(lines.join(" ")), false);
  assert.deepEqual(records(back), records(db));
});

test("a parked task comes back only when asked", () => {
  const opened = ensureAdhdStep(filled());
  const step = adhdOpen(opened);
  assert.ok(step);
  const parked = parkAdhdTask(opened, step.id);
  assert.equal(adhdOpen(parked), null);
  assert.equal(homeBlocks("adhd", parked).length, 0);
  const recalled = recallAdhdTask(parked, step.id);
  assert.equal(adhdOpen(recalled)?.id, step.id);
  assert.equal(homeBlocks("adhd", recalled).length, 1);
});

test("the buddy stays off until turned on and does not see private data or speak", () => {
  assert.equal(emptyDB().settings.adhd?.buddyOn ?? true, false);
  assert.equal(ADHD_VOICE, false);
  const db = filled();
  db.cycle = { ...db.cycle, buddyName: "Mango" };
  const quiet = adhdBuddy(db);
  assert.equal(quiet.line, "");
  assert.equal(quiet.voice, false);
  const on = setAdhdBuddy(ensureAdhdStep(db), true);
  const buddy = adhdBuddy(on);
  assert.equal(buddy.line, "Needs attention");
  assert.equal(buddy.voice, false);
  const text = JSON.stringify(buddy);
  assert.equal(text.includes("40"), false);
  assert.equal(/goa|mango|cycle|period|cramp/i.test(text), false);
  assert.equal(adhdBuddy(setAdhdBuddy(on, false)).line, "");
});

test("other module alerts stay off during ADHD mode", () => {
  const db = filled();
  const items = [{ id: "bill" }, { id: "service" }];
  assert.deepEqual(moduleAlerts(applyPreset(db, "adhd"), items), []);
  assert.deepEqual(moduleAlerts(applyPreset(db, "money"), items), items);
});

test("dismissing an alert has no penalty and does not mark a miss", () => {
  const db = filled();
  const next = dismissQuiet(db, "heads:1");
  assert.equal(next.attention["heads:1"]?.status, "dismissed");
  assert.notEqual(next.attention["heads:1"]?.status, "missed");
  assert.equal(numericScore(next), numericScore(db));
  assert.deepEqual(next.txns, db.txns);
  assert.deepEqual(next.trips, db.trips);
  assert.equal(PRESSURE.test(JSON.stringify(next.attention["heads:1"])), false);
});
