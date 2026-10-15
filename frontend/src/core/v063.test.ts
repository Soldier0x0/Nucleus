import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { aboutTitle } from "./about.ts";
import { attentionSwipeOutcome } from "./attention.ts";
import { readiness, roomSummaries } from "./domains.ts";
import { emptyDB } from "./defaults.ts";
import { askToEnable, emergencyLockCard, staysEnabled } from "./featureAccess.ts";
import { attentionItems, serviceEstimate } from "./intelligence.ts";
import { dismissNoticeAction, noticePresentation } from "./notices.ts";
import { hasSampleData, withoutSampleData, withSampleData } from "./sample.ts";
import { applyInbox, filterInbox, memoryKey } from "./smsMoney.ts";
import type { FuelEntry, Txn, Vehicle } from "./types.ts";
import { cloudScope, cloudSignIn, cloudStoreMessage } from "./vaultFile.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

// Settings moved into a hub plus child screens (v0.9.8 phase 9.5), so these
// source checks read every piece that makes up the old single screen.
const readSettings = () =>
  [
    "../../app/(tabs)/settings.tsx",
    "../components/settings/DisplaySettings.tsx",
    "../components/settings/SecuritySettings.tsx",
    "../components/settings/NotificationsSettings.tsx",
    "../components/settings/DataSettings.tsx",
    "../components/settings/AboutSettings.tsx",
  ].map(read).join("\n");

test("the emergency card is public and high, with blood, phone, and plate, only while the switch is on", () => {
  assert.equal(emergencyLockCard({ showOnLock: false, bloodGroup: "O+", phone: "9876543210", plate: "KA 01 AB 1234" }), null);
  assert.equal(emergencyLockCard({ showOnLock: true, bloodGroup: "  ", phone: "", plate: "" }), null);
  const card = emergencyLockCard({ showOnLock: true, bloodGroup: "O+", phone: "9876543210", plate: "KA 01 AB 1234" });
  assert.ok(card);
  assert.equal(card.title, "Emergency");
  assert.equal(card.visibility, "public");
  assert.equal(card.importance, "high");
  assert.match(card.body, /O\+/);
  assert.match(card.body, /9876543210/);
  assert.match(card.body, /KA 01 AB 1234/);
});

test("sign in stores the locked file on the chosen account, and a failure is said on screen", () => {
  const off = cloudSignIn("off");
  assert.equal(off.ok, false);
  if (!off.ok) assert.match(off.message, /Drive or OneDrive/);
  const drive = cloudSignIn("drive");
  assert.equal(drive.ok, true);
  if (drive.ok) {
    assert.equal(drive.signsIn, true);
    assert.equal(drive.saver, "account");
    assert.equal(drive.scope, cloudScope("drive"));
  }
  const one = cloudSignIn("onedrive");
  assert.equal(one.ok, true);
  if (one.ok) {
    assert.equal(one.signsIn, true);
    assert.equal(one.saver, "account");
    assert.equal(one.scope, cloudScope("onedrive"));
  }
  const message = cloudStoreMessage("drive", "cancelled");
  assert.match(message, /Drive/);
  assert.match(message, /cancelled/);
  assert.notEqual(message.trim(), "");
});

test("bank texts ask for notification access and do not request READ_SMS to turn the switch on", () => {
  const sms = askToEnable("sms-inbox");
  assert.equal(sms.permission, "notification-listener");
  assert.notEqual(sms.permission, "android.permission.READ_SMS");
  assert.equal(staysEnabled(sms, false), false);
  assert.equal(staysEnabled(sms, true), true);
  const otp = filterInbox([{ sender: "bank", body: "482913 is your OTP. Do not share it.", at: "2026-10-04T01:00:00" }]);
  assert.equal(otp.kept.length, 0);
  const debit = filterInbox([{ sender: "bank", body: "INR 200.00 debited from A/c XX12. Avl Bal INR 900.00", at: "2026-10-04T01:00:00" }]);
  assert.equal(debit.kept[0]?.kind, "debit");
});

test("bank and UPI notices accept both wordings, keep balance lines, and still drop codes", () => {
  const out = filterInbox([
    { sender: "HDFC", body: "INR 200.00 debited from A/c XX12. Avl Bal INR 900.00", at: "2026-10-04T01:00:00" },
    { sender: "HDFC", body: "INR 5,000.00 credited to your account. Avl Bal INR 5,900.00", at: "2026-10-04T01:01:00" },
    { sender: "UPI", body: "You paid INR 120 to Swiggy", at: "2026-10-04T01:02:00" },
    { sender: "UPI", body: "INR 80 sent to Rahul", at: "2026-10-04T01:03:00" },
    { sender: "UPI", body: "INR 45 spent at Cafe", at: "2026-10-04T01:04:00" },
    { sender: "UPI", body: "INR 1,000 received from Amit", at: "2026-10-04T01:05:00" },
    { sender: "UPI", body: "INR 250 added to your account", at: "2026-10-04T01:06:00" },
    { sender: "HDFC", body: "Available balance is INR 1,200.50", at: "2026-10-04T01:07:00" },
    { sender: "BANK", body: "482913 is your OTP. Do not share it.", at: "2026-10-04T01:08:00" },
  ]);
  assert.deepEqual(out.kept.map((row) => row.kind), ["debit", "credit", "debit", "debit", "debit", "credit", "credit", "balance"]);
  assert.deepEqual(out.kept.map((row) => row.amount), [200, 5000, 120, 80, 45, 1000, 250, 1200.5]);
  assert.equal(out.dropped, 1);
  assert.equal(JSON.stringify(out).includes("482913"), false);
  const ask = applyInbox(
    [{ sender: "VX-NEW", body: "INR 80 paid to CAFE", at: "2026-10-04T02:00:00" }],
    { knownSenders: [], ownAccounts: [], memory: [], categoryFor: () => null },
  );
  assert.equal(ask.saved.length, 0);
  assert.equal(ask.asks.length, 1);
  const remembered = applyInbox(
    [{ sender: "VX-NEW", body: "INR 80 paid to CAFE", at: "2026-10-04T02:00:00" }],
    { knownSenders: [], ownAccounts: [], memory: [{ key: memoryKey("VX-NEW"), choice: "category", category: "Food" }], categoryFor: () => null },
  );
  assert.equal(remembered.asks.length, 0);
  assert.equal(remembered.saved[0]?.category, "Food");
  assert.equal(remembered.saved[0]?.amount, 80);
});

test("the screen, the listener, and the upload say what this version does", () => {
  const settings = readSettings();
  const enable = read("../native/enableFeature.ts");
  const cloud = read("../native/cloudFile.ts");
  const android = read("../native/android.ts");
  const gate = read("../components/LockGate.tsx");
  const bank = read("../components/BankTextSync.tsx");
  const manifest = read("../../modules/nucleus-android/android/src/main/AndroidManifest.xml");
  const app = read("../../app.json");
  const kt = read("../../modules/nucleus-android/android/src/main/java/com/nucleus/widgets/NucleusAndroidModule.kt");
  const cardStart = kt.indexOf('Function("showLockCard")');
  const cardEnd = kt.indexOf('Function("hideLockCard")');
  const card = kt.slice(cardStart, cardEnd);
  assert.match(settings, /notification access/i);
  assert.doesNotMatch(settings, /Allow reading texts/);
  assert.match(settings, /emergencyLockCard/);
  assert.match(settings, /storeLockedCopy/);
  assert.match(settings, /settings-cloud-message/);
  assert.match(enable, /notification-listener/);
  assert.match(cloud, /storeLockedFile/);
  assert.doesNotMatch(cloud, /writeLockedFile/);
  assert.match(gate, /askAfterLeave/);
  assert.match(gate, /emergencyLockCard/);
  assert.match(bank, /readBankNotices/);
  assert.doesNotMatch(bank, /readSmsInbox/);
  assert.match(manifest, /NotificationListenerService/);
  // v0.9.8: READ_SMS is gone; bank texts come from notification access only.
  assert.equal(JSON.parse(app).expo.android.permissions.includes("android.permission.READ_SMS"), false);
  assert.match(card, /IMPORTANCE_HIGH/);
  assert.doesNotMatch(card, /IMPORTANCE_DEFAULT/);
  assert.match(card, /VISIBILITY_PUBLIC/);
  assert.match(kt, /storeLockedFile/);
  assert.match(kt, /getAuthToken/);
  assert.doesNotMatch(kt, /Function\("readSms"\)/);
  assert.match(kt, /Function\("clearIconRestart"\)/);
  const apply = android.slice(android.indexOf("export function applyLauncherIcon"));
  const setAt = apply.indexOf("setLauncherIcon");
  const clearAt = apply.indexOf("clearIconRestart");
  assert.ok(setAt >= 0 && clearAt > setAt);
});

test("sample rows can be removed and entries the user added stay", () => {
  const lunch: Txn = { id: "lunch", type: "expense", amount: 180, category: "Food", date: "2026-10-01", note: "lunch" };
  const salary: Txn = { id: "pay", type: "income", amount: 85000, category: "Salary", date: "2026-09-01", note: "Salary" };
  const city: Vehicle = { id: "city", name: "City", type: "car", fuelType: "petrol", initialOdometer: 10, serviceIntervalKm: 10000, createdAt: "2026-01-01T00:00:00.000Z" };
  const real = emptyDB();
  real.txns = [lunch, salary];
  real.vehicles = [city];
  real.budget = { monthly: 12000, categories: { Food: 3000 } };
  real.subscriptions = [{ id: "gym", name: "Gym", amount: 999, cycle: "monthly", nextRenewal: "2026-11-01", category: "Health", active: true }];
  const mixed = withSampleData(real);
  const activa = mixed.vehicles.find((row) => row.plate === "KA 01 AB 1234");
  assert.ok(activa);
  const mine: FuelEntry = { id: "my-fill", vehicleId: activa.id, date: "2026-10-03", odometer: 27000, litres: 4, price: 100, total: 400 };
  const withMine = { ...mixed, fuel: [...mixed.fuel, mine], appliances: [...mixed.appliances, { id: "fridge", name: "Fridge", room: "Kitchen", createdAt: "2026-01-01T00:00:00.000Z", plans: [] }] };
  assert.equal(hasSampleData(withMine), true);
  const cleaned = withoutSampleData(withMine);
  assert.deepEqual(cleaned.txns.filter((row) => row.id === "lunch"), [lunch]);
  assert.deepEqual(cleaned.txns.filter((row) => row.id === "pay"), [salary]);
  assert.equal(cleaned.txns.some((row) => row.note === "BESCOM bill"), false);
  assert.equal(cleaned.txns.some((row) => row.note === "Train tickets"), false);
  assert.ok(cleaned.vehicles.some((row) => row.id === "city"));
  assert.equal(cleaned.vehicles.some((row) => row.name === "Swift"), false);
  assert.equal(cleaned.vehicles.some((row) => row.id === activa.id), false);
  assert.ok(cleaned.fuel.some((row) => row.id === "my-fill"));
  assert.equal(cleaned.fuel.some((row) => row.total === 3312), false);
  assert.equal(cleaned.subscriptions.some((row) => row.name === "Netflix"), false);
  assert.ok(cleaned.subscriptions.some((row) => row.id === "gym"));
  assert.equal(cleaned.appliances.some((row) => row.name === "Bedroom AC"), false);
  assert.ok(cleaned.appliances.some((row) => row.id === "fridge"));
  assert.equal(cleaned.trips.some((row) => row.name === "Goa 2026"), false);
  assert.deepEqual(cleaned.budget, { monthly: 12000, categories: { Food: 3000 } });
  assert.equal(hasSampleData(cleaned), false);

  const legacy = withSampleData(emptyDB());
  const untagged = {
    ...legacy,
    settings: { ...legacy.settings, sampleIds: [], sampleBudget: undefined },
    txns: [...legacy.txns, lunch],
    budget: { monthly: 9999, categories: { Food: 100 } },
  };
  const fromOld = withoutSampleData(untagged);
  assert.ok(fromOld.txns.some((row) => row.id === "lunch"));
  assert.equal(fromOld.txns.some((row) => row.note === "Salary"), false);
  assert.equal(fromOld.vehicles.some((row) => row.plate === "KA 01 AB 1234"), false);
  assert.equal(fromOld.budget.monthly, 9999);
  const settings = readSettings();
  assert.match(settings, /settings-sample-remove-button/);
  assert.match(settings, /withoutSampleData/);
});

test("a reminder dismiss clears the notice and does not open the app", () => {
  for (const kind of ["bill", "fuel", "service", "backup"] as const) {
    const card = noticePresentation(kind);
    assert.equal(card.ongoing, false);
    assert.equal(card.sticky, false);
    assert.equal(card.dismissClears, true);
    assert.equal(card.dismissOpensApp, false);
  }
  const emergency = noticePresentation("emergency");
  assert.equal(emergency.ongoing, true);
  assert.equal(emergency.dismissClears, false);
  assert.equal(dismissNoticeAction().options.opensAppToForeground, false);
  const quiet = read("../components/QuietSync.tsx");
  assert.match(quiet, /dismissNoticeAction\(/);
  assert.match(quiet, /dismissNotificationAsync/);
  assert.match(quiet, /noticePresentation\(/);
  const kt = read("../../modules/nucleus-android/android/src/main/java/com/nucleus/widgets/NucleusAndroidModule.kt");
  const cardStart = kt.indexOf('Function("showLockCard")');
  const cardEnd = kt.indexOf('Function("hideLockCard")');
  assert.match(kt.slice(cardStart, cardEnd), /setOngoing\(true\)/);
});

test("a short attention swipe snaps back and the bedroom AC line does not say overdue", () => {
  assert.equal(attentionSwipeOutcome(30, 360), "snap-back");
  assert.equal(attentionSwipeOutcome(160, 360), "snap-back");
  assert.equal(attentionSwipeOutcome(-40, 360), "snap-back");
  assert.equal(attentionSwipeOutcome(220, 360), "snooze");
  assert.equal(attentionSwipeOutcome(-220, 360), "done");
  const screen = read("../../app/(tabs)/attention.tsx");
  assert.match(screen, /attentionSwipeThreshold/);
  assert.match(screen, /attention-done-/);
  assert.match(screen, /attention-snooze-/);
  assert.match(screen, /attention-why-/);
  const ac = attentionItems(withSampleData(emptyDB())).find((item) => item.title.includes("Bedroom AC"));
  assert.ok(ac);
  assert.doesNotMatch(ac.title, /overdue/i);
  assert.doesNotMatch(ac.why.rule, /overdue/i);
  assert.match(ac.title, /was due/);
});

test("a gap names the missing document or unpacked item", () => {
  const db = withSampleData(emptyDB());
  const goa = db.trips.find((trip) => trip.name === "Goa 2026");
  assert.ok(goa);
  const unpacked = goa.packing.filter((item) => !item.done).map((item) => item.name);
  assert.ok(unpacked.length > 0 && unpacked.length <= 4);
  const ready = readiness(db, goa);
  const line = ready.missing.join(" · ");
  assert.match(line, /Travel insurance/);
  for (const name of unpacked) assert.match(line, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(line, /document missing/i);
  assert.doesNotMatch(line, /Packing \d+%/);
  const several = readiness(emptyDB(), {
    ...goa,
    packing: [{ id: "socks", name: "Socks", category: "Clothing", done: true }],
    docs: [
      { id: "pass", name: "Passport / ID", have: false },
      { id: "tickets", name: "Tickets", have: false },
      { id: "hotel", name: "Hotel booking", have: true },
    ],
  });
  const severalLine = several.missing.join(" · ");
  assert.match(severalLine, /Passport \/ ID/);
  assert.match(severalLine, /Tickets/);
  assert.doesNotMatch(severalLine, /Hotel booking/);
  assert.doesNotMatch(severalLine, /\d+ document/);
  const blank = readiness(emptyDB(), {
    ...goa,
    budget: 10,
    packing: [],
    docs: [{ id: "blank", name: "  ", have: false }],
  });
  const blankLine = blank.missing.join(" · ");
  assert.match(blankLine, /Could not tell/);
  assert.doesNotMatch(blankLine, /\d/);
  const tripLine = attentionItems(db).find((item) => item.title.includes("Goa 2026"));
  assert.ok(tripLine);
  assert.match(tripLine.title, /Travel insurance/);
  assert.doesNotMatch(tripLine.title, /thing/);
  const home = emptyDB();
  home.appliances = [{ id: "b", name: "Fridge", room: "Kitchen", plans: [{ id: "p", name: "Filter", everyMonths: 3, lastDone: "2020-01-01" }], createdAt: "2026-01-01" }];
  home.chores = [{ id: "c", name: "Bins", everyDays: 7, lastDone: "2020-01-01", room: "Kitchen" }];
  const kitchen = roomSummaries(home, "2026-06-01").find((room) => room.room === "Kitchen");
  assert.match(kitchen?.line ?? "", /Filter/);
  assert.match(kitchen?.line ?? "", /Bins/);
  assert.doesNotMatch(kitchen?.line ?? "", /\d/);
  const vehicle = { id: "v", name: "City", type: "car" as const, fuelType: "petrol" as const, initialOdometer: 1000, serviceIntervalKm: 10000, createdAt: "2026-01-01" };
  const estimate = serviceEstimate({ ...emptyDB(), vehicles: [vehicle], services: [{ id: "s", vehicleId: "v", date: "2026-01-01", odometer: 1000, kind: "oil", cost: 1, details: {} }] }, vehicle);
  const serviceCopy = `${estimate.explanation} ${estimate.facts.map((fact) => fact.value).join(" ")}`;
  assert.match(serviceCopy, /Could not tell/);
  assert.doesNotMatch(serviceCopy, /of 3 needed/);
  assert.doesNotMatch(serviceCopy, /\d+ more/);
  const today = read("../../app/(tabs)/index.tsx");
  const travelList = read("../../app/travel/index.tsx");
  const travel = read("../../app/travel/[id].tsx");
  assert.doesNotMatch(today, /missing\.length\} need attention/);
  assert.doesNotMatch(travelList, /missing\.length\} need attention/);
  assert.doesNotMatch(travel, /missing\.length\} need attention/);
  assert.doesNotMatch(today, /things need attention/);
});

test("about shows the installed version and follows a later stamp", () => {
  assert.equal(aboutTitle("0.6.3"), "Nucleus 0.6.3");
  assert.equal(aboutTitle("0.8"), "Nucleus 0.8");
  assert.equal(aboutTitle(" 0.6.4 "), "Nucleus 0.6.4");
  assert.notEqual(aboutTitle("0.6.3"), "Nucleus 2.0");
  const settings = readSettings();
  assert.doesNotMatch(settings, /Nucleus 2\.0/);
  assert.match(settings, /aboutTitle\(installedVersion\(\)\)/);
  const kt = read("../../modules/nucleus-android/android/src/main/java/com/nucleus/widgets/NucleusAndroidModule.kt");
  const start = kt.indexOf('Function("installedVersion")');
  assert.ok(start >= 0);
  const body = kt.slice(start, start + 800);
  assert.match(body, /versionName/);
  assert.doesNotMatch(body, /"2\.0"/);
  assert.doesNotMatch(body, /"0\.6\.3"/);
});
