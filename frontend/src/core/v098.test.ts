import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { deleteEntity } from "./actions.ts";
import { newReminder, overdueReminders, plainReminders, reminderProblem, snoozeReminder, upsertReminder, setReminderDone } from "./reminders.ts";
import { logDose, medicineNotices, medicineProblem, newMedicine, removeMedicine, upsertMedicine } from "./medicines.ts";
import { menuSections } from "./menu.ts";
import { bankInboxAutoOn } from "./bankAccess.ts";
import { heldSuggestions } from "./moneyWords.ts";
import { reminderInputs, shouldWarnDenied } from "./reminderSync.ts";
import { SYNC_COLLECTIONS } from "./syncStamp.ts";
import { channelSeries, serviceCostByYear, vehicleStats } from "./intelligence.ts";
import { classifyChannel, learnMerchantChannel, seedChannel } from "./merchantTable.ts";
import { categorySplit } from "./moneyDesk.ts";
import { transitExpense } from "./transit.ts";
import { publicTransitSpend, vehicleFuelSpendMonth } from "./travelSpend.ts";
import { monthKey, todayISO } from "./format.ts";
import type { Txn, Vehicle } from "./types.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("old files load with empty reminders and medicines, and both sync", () => {
  const raw = JSON.parse(JSON.stringify(emptyDB())) as Record<string, unknown>;
  delete raw.reminders;
  delete raw.medicines;
  const db = normalizeDB(raw);
  assert.deepEqual(db.reminders, []);
  assert.deepEqual(db.medicines, []);
  assert.ok((SYNC_COLLECTIONS as readonly string[]).includes("reminders"));
  assert.ok((SYNC_COLLECTIONS as readonly string[]).includes("medicines"));
});

test("a reminder needs a title, a date and an HH:MM time", () => {
  assert.equal(reminderProblem({ title: "", date: "2030-01-01", time: "09:00" }), "Add a title");
  assert.equal(reminderProblem({ title: "Dentist", date: undefined, time: "09:00" }), "Pick a date");
  assert.equal(reminderProblem({ title: "Dentist", date: "2030-01-01", time: "9" }), "Enter the time as HH:MM");
  assert.equal(reminderProblem({ title: "Dentist", date: "2030-01-01", time: "09:00" }), null);
});

test("plain reminders go to the OS while open and in the future; snooze moves the time; done stops it", () => {
  const now = new Date(2030, 0, 1, 8, 0).getTime();
  const r = newReminder({ title: "Call dentist", date: "2030-01-01", time: "09:00" });
  let db = upsertReminder(emptyDB(), r);
  assert.equal(plainReminders(db, now).length, 1);
  assert.equal(plainReminders(db, now)[0]?.key, `plain:${r.id}`);
  const later = new Date(2030, 0, 1, 10, 0).getTime();
  assert.equal(plainReminders(db, later).length, 0);
  assert.equal(overdueReminders(db, later).length, 1);
  db = snoozeReminder(db, r.id, 3_600_000, later);
  assert.equal(plainReminders(db, later)[0]?.at.getTime(), later + 3_600_000);
  db = setReminderDone(db, r.id, true);
  assert.equal(plainReminders(db, later).length, 0);
  assert.equal(db.reminders.length, 1);
});

test("deleting a document removes the reminder attached to it, and leaves plain ones", () => {
  let db = emptyDB();
  db = { ...db, papers: [{ id: "p1", kind: "insurance", title: "Policy", createdAt: "2030-01-01" }] };
  db = upsertReminder(db, newReminder({ title: "Renew", date: "2030-02-01", time: "09:00", attach: { kind: "paper", id: "p1" } }));
  db = upsertReminder(db, newReminder({ title: "Plain", date: "2030-02-01", time: "09:00" }));
  const next = deleteEntity(db, { kind: "paper", id: "p1" });
  assert.deepEqual(next.reminders.map((r) => r.title), ["Plain"]);
});

test("a medicine needs a name and a time; taken does not delete the series", () => {
  assert.equal(medicineProblem("", "08:00"), "Add the medicine name");
  assert.equal(medicineProblem("Vit D", ""), "Add at least one time");
  assert.match(medicineProblem("Vit D", "8am") ?? "", /HH:MM/);
  assert.equal(medicineProblem("Vit D", "08:00, 21:00"), null);
  const med = newMedicine("Vit D", [{ hour: 8, minute: 0 }, { hour: 21, minute: 0 }]);
  let db = upsertMedicine(emptyDB(), med);
  const now = new Date(2030, 0, 1, 7, 0);
  assert.equal(medicineNotices(db, now, 1).length, 2);
  db = logDose(db, med.id, "2030-01-01", "08:00", "taken");
  assert.equal(db.medicines.length, 1);
  assert.equal(medicineNotices(db, now, 1).length, 1);
  db = logDose(db, med.id, "2030-01-01", "08:00", "skipped");
  assert.equal(db.medicines[0]?.log.length, 1);
  assert.equal(removeMedicine(db, med.id).medicines.length, 0);
});

test("menu hides modules that are off, drops empty sections, and follows the module order", () => {
  const db = emptyDB();
  const ids = menuSections(db).map((s) => s.id);
  assert.ok(ids.includes("vehicle") && ids.includes("money") && ids.includes("reminders"));
  const off = { ...db, settings: { ...db.settings, modules: db.settings.modules.map((m) => (m.id === "papers" ? { ...m, enabled: false } : m)) } };
  assert.equal(menuSections(off).some((s) => s.id === "documents"), false);
  const devOff = { ...db, settings: { ...db.settings, modules: db.settings.modules.map((m) => (["tools", "builder", "rules", "net", "lab", "dev"].includes(m.id) ? { ...m, enabled: false } : m)) } };
  assert.equal(menuSections(devOff).some((s) => s.id === "devlab"), false);
  const moneyFirst = { ...db, settings: { ...db.settings, modules: [db.settings.modules.find((m) => m.id === "money")!, ...db.settings.modules.filter((m) => m.id !== "money")] } };
  assert.equal(menuSections(moneyFirst)[0]?.id, "money");
});

test("bottom bar is Today, Attention and Settings; Modules moved to its own screen", () => {
  const tabs = read("../../app/(tabs)/_layout.tsx");
  assert.doesNotMatch(tabs, /name="modules"/);
  assert.match(tabs, /tab-today/);
  assert.match(tabs, /tab-attention/);
  assert.match(tabs, /tab-settings/);
  assert.match(read("../../app/modules.tsx"), /Header title="Modules"/);
  assert.match(read("../../app/(tabs)/index.tsx"), /today-menu-button/);
});

test("channels: new ids with a sound, the handler plays sound, bank asks use their own channel", () => {
  const notify = read("./notify.ts");
  assert.match(notify, /shouldPlaySound: true/);
  assert.match(notify, /nucleus-reminders-v2/);
  assert.match(notify, /nucleus-sms-ask/);
  assert.doesNotMatch(notify, /sound: null/);
  assert.match(read("../components/BankTextSync.tsx"), /CHANNELS\.smsAsk/);
});

test("reminders sync again when their data changes, not once per session", () => {
  const src = read("./useReminders.ts");
  assert.match(src, /reminderInputs\(db\)/);
  assert.doesNotMatch(src, /syncedThisSession/);
  const db = emptyDB();
  const before = reminderInputs(db);
  const after = reminderInputs(upsertReminder(db, newReminder({ title: "x", date: "2030-01-01", time: "09:00" })));
  assert.notEqual(before, after);
  assert.equal(shouldWarnDenied({ pending: 1, granted: false, canAskAgain: false, warned: false }), true);
  assert.equal(shouldWarnDenied({ pending: 1, granted: false, canAskAgain: false, warned: true }), false);
  assert.equal(shouldWarnDenied({ pending: 0, granted: false, canAskAgain: false, warned: false }), false);
});

test("bank texts switch turns on when access is granted, unless the person turned it off", () => {
  assert.equal(bankInboxAutoOn({ accessOn: true, inboxOn: false, turnedOff: false }), true);
  assert.equal(bankInboxAutoOn({ accessOn: true, inboxOn: false, turnedOff: true }), false);
  assert.equal(bankInboxAutoOn({ accessOn: false, inboxOn: false, turnedOff: false }), false);
});

test("money suggestions stay while typing a space and go when the note is cleared", () => {
  const prev = ["Lunch"];
  assert.deepEqual(heldSuggestions(prev, [], "lun "), ["Lunch"]);
  assert.deepEqual(heldSuggestions(prev, ["Lunch box"], "lunch b"), ["Lunch box"]);
  assert.deepEqual(heldSuggestions(prev, [], ""), []);
});

test("v0.9.8: Transport folds into Travel, in the budget too, and custom names stay", () => {
  const raw = JSON.parse(JSON.stringify(emptyDB())) as Record<string, any>;
  raw.txns = [
    { id: "t1", type: "expense", amount: 40, category: "Transport", date: "2026-10-01", note: "Cab" },
    { id: "t2", type: "expense", amount: 60, category: "Travel", date: "2026-10-02", note: "Hotel" },
  ];
  raw.budget = { monthly: 5000, categories: { Transport: 400, Travel: 600, Food: 100 } };
  raw.settings.moneyNames = ["Transport"];
  const db = normalizeDB(raw);
  assert.deepEqual(db.txns.map((t) => t.category), ["Travel", "Travel"]);
  assert.deepEqual(db.budget.categories, { Travel: 1000, Food: 100 });
  assert.deepEqual(db.settings.moneyNames, ["Transport"]);
});

test("v0.9.8: an old file folds Travel off once; turning it back on sticks", () => {
  const raw = JSON.parse(JSON.stringify(emptyDB())) as Record<string, any>;
  delete raw.settings.travelFolded;
  raw.settings.modules = raw.settings.modules.map((m: any) => (m.id === "travel" ? { ...m, enabled: true, hidden: false } : m));
  const once = normalizeDB(raw);
  const travel = once.settings.modules.find((m) => m.id === "travel");
  assert.equal(travel?.enabled, false);
  assert.equal(travel?.hidden, true);
  assert.equal(once.settings.travelFolded, true);
  const backOn = { ...once, settings: { ...once.settings, modules: once.settings.modules.map((m) => (m.id === "travel" ? { ...m, enabled: true, hidden: false } : m)) } };
  assert.equal(normalizeDB(backOn).settings.modules.find((m) => m.id === "travel")?.enabled, true);
});

test("v0.9.8: a transit fare is Travel and never mixes with bike fuel", () => {
  const db = emptyDB();
  const fare = transitExpense(40, "cab", "2026-10-01");
  assert.equal(fare.category, "Travel");
  const month = monthKey("2026-10-01");
  const bike: Vehicle = { id: "v", name: "Bike", type: "bike", fuelType: "petrol", initialOdometer: 0, serviceIntervalKm: 3000, createdAt: "2026-01-01" };
  const next = { ...db, vehicles: [bike], txns: [{ id: "fare", ...fare }], fuel: [{ id: "f1", vehicleId: "v", date: "2026-10-01", odometer: 1500, litres: 5, price: 100, total: 500 }] };
  assert.equal(publicTransitSpend(next, month, "cab"), 40);
  assert.equal(publicTransitSpend(next, month), 40);
  assert.equal(vehicleFuelSpendMonth(next, month), 500);
});

test("v0.9.8: the merchant table knows chains and apps; a learned answer wins", () => {
  assert.equal(seedChannel("KFC"), "in_person");
  assert.equal(seedChannel("dominos 499"), "in_person");
  assert.equal(seedChannel("zomato kfc"), "online_food");
  assert.equal(seedChannel("Blinkit order"), "online_grocery");
  assert.equal(seedChannel("Shenoy Stores"), null);
  assert.equal(classifyChannel([], "Shenoy Stores"), null);
  let db = emptyDB();
  db = learnMerchantChannel(db, "Shenoy Stores", "in_person");
  assert.equal(classifyChannel(db.settings.merchantOverrides, "shenoy stores 240"), "in_person");
  db = learnMerchantChannel(db, "KFC", "online_food");
  assert.equal(classifyChannel(db.settings.merchantOverrides, "kfc 320"), "online_food");
  const round = normalizeDB(JSON.parse(JSON.stringify(db)));
  assert.equal(classifyChannel(round.settings.merchantOverrides, "kfc"), "online_food");
  assert.equal(classifyChannel(round.settings.merchantOverrides, "shenoy"), "in_person");
});

test("v0.9.8: old txns stay untagged and an unknown channel is dropped", () => {
  const raw = JSON.parse(JSON.stringify(emptyDB())) as Record<string, any>;
  raw.txns = [
    { id: "old", type: "expense", amount: 20, category: "Food", date: "2026-10-01" },
    { id: "odd", type: "expense", amount: 30, category: "Food", date: "2026-10-02", channel: "telepathy" },
  ];
  const db = normalizeDB(raw);
  assert.equal(db.txns[0]?.channel, undefined);
  assert.equal(db.txns[1]?.channel, undefined);
});

test("v0.9.8: the pie total is spending without transfers, and channel bars skip untagged", () => {
  const split = categorySplit([
    { id: "a", type: "expense", amount: 100, category: "Food", date: "2026-10-02" },
    { id: "b", type: "expense", amount: 50, category: "Travel", date: "2026-10-03" },
    { id: "c", type: "expense", amount: 70, category: "Food", date: "2026-10-04" },
    { id: "d", type: "expense", amount: 30, category: "Food", date: "2026-10-05", transfer: true },
  ], "2026-10");
  assert.equal(split.reduce((sum, row) => sum + row.amount, 0), 220);
  assert.deepEqual(split.map((row) => [row.category, row.amount]), [["Food", 170], ["Travel", 50]]);
  const today = todayISO();
  const rows: Txn[] = [
    { id: "a", type: "expense", amount: 100, category: "Food", date: today, channel: "online_food" },
    { id: "b", type: "expense", amount: 50, category: "Travel", date: today, channel: "in_person" },
    { id: "c", type: "expense", amount: 70, category: "Food", date: today },
    { id: "d", type: "expense", amount: 30, category: "Food", date: today, transfer: true },
  ];
  const series = channelSeries({ ...emptyDB(), txns: rows }, 6);
  const last = series[series.length - 1];
  assert.equal(series.length, 6);
  assert.equal(last.online, 100);
  assert.equal(last.inPerson, 50);
  assert.equal(last.untagged, 70);
});

test("v0.9.8: service cost buckets per calendar year and the stat is this year", () => {
  const db = emptyDB();
  const v: Vehicle = { id: "v", name: "Bike", type: "bike", fuelType: "petrol", initialOdometer: 0, serviceIntervalKm: 3000, createdAt: todayISO() };
  db.vehicles.push(v);
  const year = todayISO().slice(0, 4);
  db.services.push({ id: "s1", vehicleId: "v", date: `${year}-02-01`, odometer: 1000, kind: "general", cost: 500, details: {} });
  db.services.push({ id: "s2", vehicleId: "v", date: "2020-03-01", odometer: 500, kind: "oil", cost: 300, details: {} });
  const years = serviceCostByYear(db, "v");
  assert.deepEqual(years.map((row) => row.year), ["2020", year]);
  const st = vehicleStats(db, v);
  assert.equal(st.serviceCost, 500);
  assert.equal(st.serviceCostTotal, 800);
});
