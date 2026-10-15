import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { BOARD_CIRCLE, applyPreset, columnsFor, dismissQuiet, homeBlocks, homePresetTiles, lastPresetThing, moduleAlerts, presetBoard, presetItems, presetTileTitle, rememberPreset, rowFlex, rowsFor, showsCustomizeHome, swipePages, swipeScreens, swipeStartIndex, swipeWrap, tileModule, tilePlaceholder, visiblePresetItems, PRESET_CHOICES } from "./presets.ts";
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

/** v0.9.8: travel is folded off by default, so board tests turn it back on. */
function travelOn(db: DB): DB {
  return {
    ...db,
    settings: {
      ...db.settings,
      modules: db.settings.modules.map((m) => (m.id === "travel" ? { ...m, enabled: true, hidden: false } : m)),
    },
  };
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

const PRESSURE = /overdue|\bmissed\b|behind|\blate\b|\bfail|streak|\bscore\b|points|quota|congrat|good job|welcome back|hurry/i;

function numericScore(db: DB): number {
  const bag = db.settings as unknown as { score?: unknown; points?: unknown; streak?: unknown };
  const raw = bag.score ?? bag.points ?? bag.streak ?? 0;
  return typeof raw === "number" ? raw : 0;
}

test("every preset shows its tiles when there is no data", () => {
  const db = travelOn(emptyDB());
  for (const preset of ["money", "travel", "home", "desk", "workshop"] as const) {
    const shown = visiblePresetItems(db, preset);
    const catalog = presetItems(preset);
    assert.ok(catalog.length > 4, preset);
    const on = catalog.filter((item) => {
      const moduleId = tileModule(item.id);
      if (!moduleId) return true;
      return db.settings.modules.find((row) => row.id === moduleId)?.enabled !== false;
    });
    assert.deepEqual(shown.map((item) => item.id), on.map((item) => item.id));
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
  const bare = travelOn(emptyDB());
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
  assert.equal(shown.includes("transitmetro"), true);
  assert.equal(shown[0], "route");
  assert.deepEqual(shown, presetItems("travel").map((item) => item.id));

  const rich = travelOn(filled());
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
  assert.ok(travel.indexOf("transitmetro") < travel.indexOf("heading"));
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
  const db = travelOn(emptyDB());
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
  for (const id of [...money, ...travel]) {
    assert.notEqual(presetTileTitle(id), "Open");
    assert.ok(presetTileTitle(id).length > 0, id);
  }
  const home = readFileSync(new URL("../../app/(tabs)/index.tsx", import.meta.url), "utf8");
  const modes = readFileSync(new URL("../components/HomeModes.tsx", import.meta.url), "utf8");
  assert.match(home, /<SwipeHome[\s\S]*preset=\{preset\}/);
  assert.match(modes, /homePresetTiles\(/);
  assert.match(modes, /presetTileTitle\(/);
  const swipe = modes.slice(modes.indexOf("export function SwipeHome"), modes.indexOf("export function HeadsUpCard"));
  assert.match(swipe, /swipeScreens\(/);
  assert.match(swipe, /swipeStartIndex\(preset\)/);
  assert.match(swipe, /contentOffset/);
  assert.equal(/contentOffset=\{\{\s*x:\s*0/.test(swipe), false);
});

test("travel opens on the travel tiles and money opens on the money tiles", () => {
  const db = travelOn(emptyDB());
  const travel = homePresetTiles(db, "travel", "real").map((item) => item.id);
  const money = homePresetTiles(db, "money", "real").map((item) => item.id);
  assert.deepEqual(travel.slice(0, 5), ["route", "transitmetro", "transittrain", "transitcab", "transitbus"]);
  assert.deepEqual(money.slice(0, 5), ["balance", "spending", "charts", "receipts", "bills"]);
  assert.equal(swipeScreens("travel")[swipeStartIndex("travel")], "travel");
  assert.equal(swipeScreens("money")[swipeStartIndex("money")], "money");
  assert.notEqual(swipeScreens("travel")[swipeStartIndex("travel")], "money");
});

test("money, travel, and home do not show the dashed customize box", () => {
  assert.equal(showsCustomizeHome("money"), false);
  assert.equal(showsCustomizeHome("travel"), false);
  assert.equal(showsCustomizeHome("home"), false);
  assert.equal(showsCustomizeHome("custom"), true);
  assert.equal(showsCustomizeHome("desk"), true);
  assert.equal(showsCustomizeHome("workshop"), true);
  const home = readFileSync(new URL("../../app/(tabs)/index.tsx", import.meta.url), "utf8");
  assert.match(home, /showsCustomizeHome\(preset\)/);
  assert.match(home, /borderStyle: "dashed"/);
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

test("v0.9.8: ADHD mode is gone and an old ADHD file opens on Custom with no ADHD data", () => {
  const raw = JSON.parse(JSON.stringify(emptyDB())) as Record<string, any>;
  raw.settings.homePreset = "adhd";
  raw.settings.adhd = { tasks: [{ id: "a", line: "Pay the bill" }], finished: [], reminder: { line: "Pay" } };
  const db = normalizeDB(raw);
  assert.equal(db.settings.homePreset, "custom");
  assert.equal("adhd" in db.settings, false);
  assert.equal(PRESET_CHOICES.some((choice) => (choice.id as string) === "adhd"), false);
  assert.equal((BOARD_CIRCLE as string[]).includes("adhd"), false);
});
