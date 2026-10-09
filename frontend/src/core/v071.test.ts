import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bankAccessPrompt, bankInboxAfterReturn } from "./bankAccess.ts";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { homeCard } from "./homeCards.ts";
import { askOnRelaunch } from "./lockPolicy.ts";
import { hasSampleData, withoutSampleData } from "./sample.ts";
import { saveBankNotices } from "./smsMoney.ts";
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
    fuel: [
      { id: "demo-fill", vehicleId: "activa-gone", date: "2026-08-01", odometer: 21600, litres: 5.6, price: 100, total: 560 },
    ],
    services: [
      { id: "demo-service", vehicleId: "activa-gone", date: "2026-08-02", odometer: 6100, kind: "oil", cost: 450, details: {} },
    ],
    links: [
      { id: "link-fill", from: { kind: "fuel", id: "demo-fill" }, to: { kind: "txn", id: "unnamed-a" }, rel: "expense", createdAt: "2026-08-01" },
      { id: "link-service", from: { kind: "service", id: "demo-service" }, to: { kind: "txn", id: "unnamed-b" }, rel: "expense", createdAt: "2026-08-02" },
    ],
    txns: [
      { id: "in", type: "income", amount: 2000, category: "Salary", date: "2026-09-01", note: "Pay" },
      { id: "e177", type: "expense", amount: 177, category: "Groceries", date: "2026-09-02", note: "Market" },
      { id: "e100", type: "expense", amount: 100, category: "Food", date: "2026-09-03", note: "Lunch" },
      { id: "fuel-copy", type: "expense", amount: 560, category: "Fuel", date: "2026-08-01", note: "Activa · 5.6 L" },
      { id: "service-copy", type: "expense", amount: 450, category: "Vehicle", date: "2026-08-02", note: "Activa · Engine oil" },
      { id: "own-fuel", type: "expense", amount: 80, category: "Fuel", date: "2026-09-04", note: "City · 4 L" },
      { id: "unnamed-a", type: "expense", amount: 450, category: "Vehicle", date: "2026-08-02" },
      { id: "unnamed-b", type: "expense", amount: 450, category: "Vehicle", date: "2026-08-02" },
    ],
  });
}

test("an upgraded phone with an empty sample list still removes every demo leftover", () => {
  const db = upgradedPhone();
  assert.deepEqual(db.settings.sampleIds, []);
  assert.equal(hasSampleData(db), true);
  const settings = readFileSync(new URL("../../app/(tabs)/settings.tsx", import.meta.url), "utf8");
  assert.match(settings, /Add sample data/);
  assert.match(settings, /Remove sample data/);
  assert.equal(/hasSampleData\(db\) \?/.test(settings), false);
  const next = withoutSampleData(db);
  assert.equal(next.fuel.some((row) => row.id === "demo-fill"), false);
  assert.equal(next.services.some((row) => row.id === "demo-service"), false);
  assert.equal(next.txns.some((row) => row.note === "Activa · 5.6 L"), false);
  assert.equal(next.txns.some((row) => row.note === "Activa · Engine oil"), false);
  assert.equal(next.txns.some((row) => row.id === "unnamed-a" || row.id === "unnamed-b"), false);
  assert.equal(next.links.some((row) => row.id === "link-fill" || row.id === "link-service"), false);
  assert.deepEqual(next.budget, { monthly: 9000, categories: { Rent: 4000 } });
  assert.equal(next.txns.some((row) => row.type === "income" && row.amount === 2000), true);
  assert.equal(next.txns.some((row) => row.amount === 177), true);
  assert.equal(next.txns.some((row) => row.amount === 100), true);
  assert.equal(next.txns.some((row) => row.note === "City · 4 L"), true);
  assert.equal(next.vehicles.some((row) => row.body === "naked" && row.name === "City"), true);
  assert.equal(hasSampleData(next), false);
});

test("paper, bento, and cards are the default, and a chosen look stays", () => {
  const fresh = emptyDB();
  assert.equal(fresh.settings.theme, "paper");
  assert.equal(fresh.settings.look, "cards");
  assert.equal(fresh.settings.layout, "bento");
  assert.notEqual(fresh.settings.layout, "glass");
  const untouched = normalizeDB({
    version: 1,
    settings: { theme: "midnight", look: "current", layout: "stack" },
  });
  assert.equal(untouched.settings.theme, "paper");
  assert.equal(untouched.settings.look, "cards");
  assert.equal(untouched.settings.layout, "bento");
  const chosen = normalizeDB({
    version: 1,
    settings: { theme: "dune", look: "poster", layout: "glass", appearanceChosen: true },
  });
  assert.equal(chosen.settings.theme, "dune");
  assert.equal(chosen.settings.look, "poster");
  assert.equal(chosen.settings.layout, "glass");
  const picked = normalizeDB({
    version: 1,
    settings: { theme: "amoled", look: "soft", layout: "stack" },
  });
  assert.equal(picked.settings.theme, "amoled");
  assert.equal(picked.settings.look, "soft");
  assert.equal(picked.settings.layout, "bento");
});

test("a saved city shows the forecast, and each card opens its own place", () => {
  const db = emptyDB();
  db.settings.homeCity = { name: "Gokarna, Karnataka, India", lat: 14.55, lon: 74.32, country: "India", countryCode: "IN" };
  const weather = homeCard(db, "weather", { temp: 28, label: "Clear" });
  assert.equal(weather.title, "Weather");
  assert.match(weather.lines.join(" "), /Gokarna/);
  assert.match(weather.lines.join(" "), /28/);
  assert.equal(weather.lines.includes("Home city"), false);
  assert.match(weather.route, /section=weather/);
  const attention = homeCard(db, "attention");
  assert.match(attention.lines.join(" "), /All caught up/);
  assert.match(attention.lines.join(" "), /\b0\b/);
  assert.notEqual(attention.lines[0], "Open");
  assert.match(attention.route, /attention/);
  assert.ok(attention.icon);
  const trip = homeCard(db, "trip");
  assert.equal(trip.title, "Trip");
  assert.match(trip.route, /^\/travel/);
  const budget = homeCard(db, "budget");
  assert.match(budget.lines.join(" "), /0/);
  assert.match(budget.route, /sheet=budget/);
  const balance = homeCard(db, "balance");
  assert.notEqual(balance.lines[0], balance.title);
  assert.ok(balance.icon);
  const modes = readFileSync(new URL("../components/HomeModes.tsx", import.meta.url), "utf8");
  assert.match(modes, /homeCard\(/);
  assert.match(modes, /<Icon /);
  assert.doesNotMatch(modes, /FadeIn|LinearTransition/);
  const settings = readFileSync(new URL("../../app/(tabs)/settings.tsx", import.meta.url), "utf8");
  assert.match(settings, /settings-weather/);
  assert.match(settings, /section === "weather"|section == "weather"|params\.section/);
  const money = readFileSync(new URL("../../app/money/index.tsx", import.meta.url), "utf8");
  assert.match(money, /params\.sheet === "budget"/);
});

test("google pay, phonepe, and bank notices save once notification access is on", () => {
  const saved = saveBankNotices(
    [
      { sender: "Paid", body: "You paid INR 250 to Cafe", at: "2026-10-04T03:00:00", app: "com.google.android.apps.nbu.paisa.user" },
      { sender: "PhonePe", body: "INR 90 sent to Rahul", at: "2026-10-04T03:01:00", app: "com.phonepe.app" },
      { sender: "HDFC Bank", body: "INR 400.00 debited from A/c XX12", at: "2026-10-04T03:02:00", app: "com.snapwork.hdfc" },
    ],
    { ownAccounts: [], memory: [], categoryFor: () => null },
  );
  assert.equal(saved.asks.length, 0);
  assert.equal(saved.saved.length, 3);
  assert.equal(saved.saved.every((row) => row.category === "Other" || row.category.length > 0), true);
  const unknown = saveBankNotices(
    [{ sender: "VX-NEW", body: "INR 80 paid to CAFE", at: "2026-10-04T03:03:00" }],
    { ownAccounts: [], memory: [], categoryFor: () => null },
  );
  assert.equal(unknown.saved.length, 0);
  assert.equal(unknown.asks.length, 1);
  const transfer = saveBankNotices(
    [{ sender: "Google Pay", body: "INR 400.00 sent to your own account XX99", at: "2026-10-04T03:04:00", app: "com.google.android.apps.nbu.paisa.user" }],
    { ownAccounts: ["XX99"], memory: [], categoryFor: () => "Transfer" },
  );
  assert.equal(transfer.saved.length, 0);
  assert.equal(transfer.asks[0]?.reason, "transfer");
  const prompt = bankAccessPrompt();
  const copy = `${prompt.line} ${prompt.blockedLine}`;
  assert.match(copy, /Allow restricted settings first/);
  assert.match(copy, /notification access/i);
  assert.match(copy, /not SMS/);
  assert.equal(prompt.grantsItself, false);
  assert.equal(bankInboxAfterReturn({ asked: true, accessOn: true, inboxOn: false }), true);
  assert.equal(bankInboxAfterReturn({ asked: true, accessOn: false, inboxOn: false }), false);
  assert.equal(bankInboxAfterReturn({ asked: false, accessOn: true, inboxOn: false }), false);
  const settings = readFileSync(new URL("../../app/(tabs)/settings.tsx", import.meta.url), "utf8");
  const sync = readFileSync(new URL("../components/BankTextSync.tsx", import.meta.url), "utf8");
  const kotlin = readFileSync(new URL("../../modules/nucleus-android/android/src/main/java/com/nucleus/widgets/BankNoticeService.kt", import.meta.url), "utf8");
  assert.match(settings, /bankInboxAfterReturn/);
  assert.match(settings, /bankTextsAsked/);
  assert.doesNotMatch(settings, /setNotificationListenerAccessGranted/);
  assert.match(sync, /saveBankNotices/);
  assert.doesNotMatch(sync, /readSmsInbox/);
  assert.match(kotlin, /"app"/);
  assert.doesNotMatch(kotlin, /setNotificationListenerAccessGranted/);
});

test("an icon restart still asks for the lock, and the gate does not skip on install-over", () => {
  assert.equal(askOnRelaunch({ lockEnabled: true, marked: true, phoneLocked: false, fullyClosed: false }), true);
  assert.equal(askOnRelaunch({ lockEnabled: true, marked: true, phoneLocked: true, fullyClosed: false }), true);
  const kotlin = readFileSync(new URL("../../modules/nucleus-android/android/src/main/java/com/nucleus/widgets/NucleusAndroidModule.kt", import.meta.url), "utf8");
  const gate = readFileSync(new URL("../components/LockGate.tsx", import.meta.url), "utf8");
  assert.match(kotlin, /rememberIconRestart/);
  assert.match(kotlin, /DONT_KILL_APP/);
  assert.doesNotMatch(kotlin, /startForeground|Process\.killProcess|System\.exit/);
  assert.doesNotMatch(gate, /consumeIconRestart/);
  assert.match(gate, /s\.onboarded && s\.lockEnabled/);
});
