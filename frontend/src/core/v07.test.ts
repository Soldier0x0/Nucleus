import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeDB } from "./defaults.ts";
import { LAUNCHER_ALIASES, launcherIconChange } from "./launcher.ts";
import { askOnRelaunch } from "./lockPolicy.ts";
import { CAN_TOGGLE_SYSTEM_LOCATION, locationPhase, placeFromFix } from "./locationAsk.ts";
import { grewMost } from "./moneyDesk.ts";
import { homePresetTiles } from "./presets.ts";
import { isPersonalTrip, transitExpense, transitLabel } from "./transit.ts";
import { dataHealth, dueDayLabel } from "./life.ts";
import { withoutSampleData } from "./sample.ts";
import type { DB } from "./types.ts";

function upgradedPhone(): DB {
  return normalizeDB({
    version: 1,
    settings: {
      sampleIds: [],
      sampleBudget: { monthly: 9000, categories: { Rent: 4000 } },
    },
    budget: { monthly: 45000, categories: { Food: 6000, Shopping: 4000 } },
    vehicles: [
      {
        id: "bike",
        name: "City",
        type: "bike",
        body: "naked",
        fuelType: "petrol",
        initialOdometer: 12000,
        serviceIntervalKm: 3000,
        createdAt: "2026-01-01",
      },
    ],
    txns: [
      { id: "in", type: "income", amount: 2000, category: "Salary", date: "2026-09-01", note: "Pay" },
      { id: "e177", type: "expense", amount: 177, category: "Groceries", date: "2026-09-02", note: "Market" },
      { id: "e100", type: "expense", amount: 100, category: "Food", date: "2026-09-03", note: "Lunch" },
      { id: "fuel-copy", type: "expense", amount: 560, category: "Fuel", date: "2026-08-01", note: "Activa · 5.6 L" },
      { id: "service-copy", type: "expense", amount: 450, category: "Vehicle", date: "2026-08-02", note: "Activa · Engine oil" },
      { id: "own-fuel", type: "expense", amount: 80, category: "Fuel", date: "2026-09-04", note: "City · 4 L" },
    ],
  });
}

test("an upgraded phone drops Activa mirror notes and keeps the real rows", () => {
  const db = upgradedPhone();
  assert.deepEqual(db.settings.sampleIds, []);
  assert.equal(db.vehicles.some((row) => row.name === "Activa"), false);
  const next = withoutSampleData(db);
  const notes = next.txns.map((row) => row.note);
  assert.equal(notes.includes("Activa · 5.6 L"), false);
  assert.equal(notes.includes("Activa · Engine oil"), false);
  assert.equal(next.txns.some((row) => row.type === "income" && row.amount === 2000), true);
  assert.equal(next.txns.some((row) => row.type === "expense" && row.amount === 177), true);
  assert.equal(next.txns.some((row) => row.type === "expense" && row.amount === 100), true);
  assert.equal(next.txns.some((row) => row.note === "City · 4 L"), true);
  assert.equal(next.vehicles.some((row) => row.body === "naked" && row.name === "City"), true);
  const states = Object.fromEntries(LAUNCHER_ALIASES.map((alias) => [alias, "default" as const]));
  const icon = launcherIconChange(states, "IconMetalDune");
  assert.equal(icon.changed, true);
  assert.deepEqual(icon.enable, ["IconMetalDune"]);
  assert.equal(askOnRelaunch({ lockEnabled: true, marked: true, phoneLocked: false, fullyClosed: false }), false);
  assert.equal(askOnRelaunch({ lockEnabled: true, marked: true, phoneLocked: true, fullyClosed: false }), true);
  assert.equal(askOnRelaunch({ lockEnabled: true, marked: true, phoneLocked: false, fullyClosed: true }), true);
});

test("an upgraded phone gets the budget from before the demo", () => {
  const db = upgradedPhone();
  assert.deepEqual(db.settings.sampleIds, []);
  const next = withoutSampleData(db);
  assert.deepEqual(next.budget, { monthly: 9000, categories: { Rent: 4000 } });
  assert.equal(next.settings.sampleBudget, undefined);
  const bare = upgradedPhone();
  bare.settings.sampleBudget = undefined;
  bare.budget = { monthly: 45000, categories: { Food: 6000, Shopping: 4000 } };
  const cleared = withoutSampleData(bare);
  assert.deepEqual(cleared.budget, { monthly: 0, categories: {} });
  assert.equal(cleared.txns.some((row) => row.type === "income" && row.amount === 2000), true);
  assert.equal(cleared.txns.some((row) => row.amount === 177), true);
  assert.equal(cleared.txns.some((row) => row.amount === 100), true);
  assert.equal(cleared.vehicles.some((row) => row.body === "naked"), true);
  const own = upgradedPhone();
  own.budget = { monthly: 3000, categories: { Food: 500 } };
  assert.deepEqual(withoutSampleData(own).budget, { monthly: 3000, categories: { Food: 500 } });
});

test("a repeated vehicle expense names both notes", () => {
  const db = upgradedPhone();
  db.txns.push({ id: "dup-fuel", type: "expense", amount: 450, category: "Vehicle", date: "2026-08-02", note: "Activa · 5.6 L" });
  const dup = dataHealth(db).find((issue) => issue.id.startsWith("dup:"));
  assert.ok(dup);
  assert.match(dup.title, /Activa · Engine oil/);
  assert.match(dup.title, /Activa · 5\.6 L/);
  assert.notEqual(dup.title, "Two Vehicle expenses on 2026-08-02");
  assert.match(dup.detail, /Activa · Engine oil/);
  assert.match(dup.detail, /Activa · 5\.6 L/);
});

test("a past home date says it was due, and does not say late", () => {
  assert.equal(dueDayLabel(-3), "was due 3 days ago");
  assert.equal(dueDayLabel(0), "today");
  assert.equal(dueDayLabel(4), "4 days");
  assert.doesNotMatch(dueDayLabel(-1), /late|overdue|missed|behind|fail/i);
  const home = readFileSync(new URL("../../app/home/index.tsx", import.meta.url), "utf8");
  const chores = readFileSync(new URL("../components/HomeLife.tsx", import.meta.url), "utf8");
  const widgets = readFileSync(new URL("./widgets.ts", import.meta.url), "utf8");
  const rules = readFileSync(new URL("./rules.ts", import.meta.url), "utf8");
  const attention = readFileSync(new URL("./intelligence.ts", import.meta.url), "utf8");
  assert.equal(home.includes("d late"), false);
  assert.equal(chores.includes("d late"), false);
  assert.equal(widgets.includes("days overdue"), false);
  assert.equal(rules.includes("overdue by ${-x.days} days"), false);
  assert.equal(attention.includes("urgent once overdue"), false);
  assert.equal(attention.includes("overdue by ${-d} days"), false);
  assert.equal(attention.includes("overdue by ${-x.days} days"), false);
});

test("a module that is off is hidden on the home screen and the records stay", () => {
  const db = upgradedPhone();
  const before = db.txns.map((row) => row.id);
  const moneyOff = {
    ...db,
    settings: {
      ...db.settings,
      modules: db.settings.modules.map((row) => (row.id === "money" ? { ...row, enabled: false } : row)),
    },
  };
  const moneyTiles = homePresetTiles(moneyOff, "money", "real").map((item) => item.id);
  assert.equal(moneyTiles.includes("balance"), false);
  assert.equal(moneyTiles.includes("spending"), false);
  assert.deepEqual(moneyOff.txns.map((row) => row.id), before);
  const cycleOff = {
    ...db,
    settings: {
      ...db.settings,
      modules: db.settings.modules.map((row) => (row.id === "cycle" ? { ...row, enabled: false } : row)),
    },
  };
  assert.equal(homePresetTiles(cycleOff, "home", "real").some((item) => item.id === "cycle"), false);
  assert.deepEqual(cycleOff.cycle.days, db.cycle.days);
});

test("public transport is metro, train, cab or taxi, or bus", () => {
  assert.equal(transitLabel("metro"), "Metro");
  assert.equal(transitLabel("train"), "Train");
  assert.equal(transitLabel("cab"), "Cab or taxi");
  assert.equal(transitLabel("bus"), "Bus");
  assert.equal(isPersonalTrip({}), true);
  assert.equal(isPersonalTrip({ mode: "personal" }), true);
  assert.equal(isPersonalTrip({ mode: "public" }), false);
  const fare = transitExpense(40, "cab", "2026-09-04");
  assert.deepEqual(fare, { type: "expense", amount: 40, category: "Transport", date: "2026-09-04", note: "Cab or taxi" });
  assert.notEqual(fare.category, "Fuel");
  assert.notEqual(fare.category, "Vehicle");
  const travel = readFileSync(new URL("../../app/travel/index.tsx", import.meta.url), "utf8");
  assert.match(travel, /trip-mode-public/);
  assert.match(travel, /trip-transit-cab/);
  assert.match(travel, /Cab or taxi/);
});

test("location is asked once, read once, then stopped", () => {
  assert.equal(CAN_TOGGLE_SYSTEM_LOCATION, false);
  assert.equal(locationPhase({ asked: false, granted: false, read: false }), "ask");
  assert.equal(locationPhase({ asked: true, granted: true, read: false }), "read");
  assert.equal(locationPhase({ asked: true, granted: true, read: true }), "stop");
  assert.equal(locationPhase({ asked: true, granted: false, read: false }), "stop");
  assert.deepEqual(placeFromFix({ lat: 12.97, lon: 77.59 }, "This phone"), { name: "This phone", lat: 12.97, lon: 77.59 });
  const settings = readFileSync(new URL("../../app/(tabs)/settings.tsx", import.meta.url), "utf8");
  const appJson = readFileSync(new URL("../../app.json", import.meta.url), "utf8");
  assert.match(settings, /Nucleus cannot turn the phone's location switch on or off/);
  assert.equal(settings.includes("ACTION_LOCATION_SOURCE_SETTINGS"), false);
  assert.equal(appJson.includes("android.permission.ACCESS_FINE_LOCATION"), true);
  assert.equal(appJson.includes("android.permission.ACCESS_COARSE_LOCATION"), false);
});

test("money names the category that grew most, this month versus last month", () => {
  const rows = [
    { type: "expense" as const, amount: 100, category: "Fuel", date: "2026-08-02" },
    { type: "expense" as const, amount: 400, category: "Fuel", date: "2026-09-02" },
    { type: "expense" as const, amount: 50, category: "Food", date: "2026-08-03" },
    { type: "expense" as const, amount: 80, category: "Food", date: "2026-09-03" },
    { type: "expense" as const, amount: 900, category: "Rent", date: "2026-09-01", transfer: true },
    { type: "income" as const, amount: 2000, category: "Salary", date: "2026-09-01" },
  ];
  const grew = grewMost(rows, "2026-09", "2026-08");
  assert.deepEqual(grew, {
    category: "Fuel",
    thisMonth: 400,
    lastMonth: 100,
    line: "Fuel grew the most. 400 this month, 100 last month.",
  });
  assert.equal("score" in (grew ?? {}), false);
  assert.equal(grewMost([{ type: "expense", amount: 10, category: "Food", date: "2026-08-01" }], "2026-09", "2026-08"), null);
  const desk = readFileSync(new URL("../components/MoneyDesk.tsx", import.meta.url), "utf8");
  assert.match(desk, /money-grew-card/);
  assert.doesNotMatch(desk, /grewMost\([^)]*score/);
});
