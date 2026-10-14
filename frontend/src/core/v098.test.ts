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
