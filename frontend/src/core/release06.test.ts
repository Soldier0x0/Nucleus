import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { ICON_CLAIMS_FULL_TRANSPARENCY, ICON_GROUND_OPAQUE, MARK_CANVAS, MARK_OUTER_RADIUS, MARK_STROKE, markFillRatio } from "./iconFill.ts";
import { shouldAskBiometric } from "./lockPolicy.ts";
import { askToEnable, lockScreenVisibility, staysEnabled } from "./featureAccess.ts";
import { applyInbox, countsAsSpending, decideBankLine, filterInbox, memoryKey } from "./smsMoney.ts";
import { balanceOverTime, cashRow, categorySplit, dayBefore, monthFlow, namedCategories, priceChange, quietDelivery, repeatingBills, unusedCategories, yearlyMoneyCsv } from "./moneyDesk.ts";
import { cropToPage, flagMismatch, readReceiptWords, receiptCounts } from "./receiptPage.ts";
import { accessMode, askUnsynced, bundleForFile, canOpenFile, cloudScope, defaultCloud, describeContents, replaceAllowed, uploadNotices } from "./vaultFile.ts";
import { resolveLayout } from "./layouts.ts";
import { cycleHomeWidget, shadeHasDate } from "./cycleWidget.ts";
import { ownSearch } from "./ownSearch.ts";
import { suggestShared } from "./recordLinks.ts";
import { OFFLINE_MAP, rangeLeft, remindSaveWeather, reusableStops, serviceLeft, timeline, weatherAlong } from "./tripMath.ts";
import { homeLine, oneDueToday } from "./dueGreeting.ts";
import { shareBill, shareStop } from "./shareLine.ts";
import { buildDecoyDB, shownInDecoy } from "./profiles.ts";
import { resolveLook } from "./looks.ts";
import type { LookId, ThemeKey } from "./types.ts";

test("the launcher mark fills the circle and stays opaque under the mask", () => {
  assert.ok(markFillRatio() >= 0.82);
  assert.ok(MARK_OUTER_RADIUS * 2 >= 82);
  assert.ok(MARK_OUTER_RADIUS * 2 >= 100);
  assert.ok(MARK_OUTER_RADIUS - MARK_STROKE < (72 / 108) * (MARK_CANVAS / 2));
  assert.equal(ICON_GROUND_OPAQUE, true);
  assert.equal(ICON_CLAIMS_FULL_TRANSPARENCY, false);
});

test("biometrics wait for a locked phone or a cold start", () => {
  assert.equal(shouldAskBiometric(true, "cold-start", 0), true);
  assert.equal(shouldAskBiometric(true, "phone-locked", 5_000), true);
  assert.equal(shouldAskBiometric(true, "still-unlocked", 40_000), false);
  assert.equal(shouldAskBiometric(true, "still-unlocked", 30_000), false);
  assert.equal(shouldAskBiometric(false, "cold-start", 0), false);
});

test("turning a feature on asks for the permission it needs", () => {
  const emergency = askToEnable("emergency-card");
  const alerts = askToEnable("lock-alerts");
  const sms = askToEnable("sms-inbox");
  const look = askToEnable("look");
  assert.equal(emergency.permission, "android.permission.POST_NOTIFICATIONS");
  assert.equal(emergency.lockScreen, true);
  assert.equal(alerts.lockScreen, true);
  assert.equal(alerts.permission, "android.permission.POST_NOTIFICATIONS");
  assert.equal(sms.permission, "android.permission.READ_SMS");
  assert.equal(sms.lockScreen, false);
  assert.equal(look.permission, null);
  assert.equal(staysEnabled(emergency, false), false);
  assert.equal(staysEnabled(emergency, true), true);
  assert.equal(staysEnabled(look, false), true);
  assert.equal(lockScreenVisibility(), "public");
});

test("bank texts keep debit, credit, and balance, and drop codes immediately", () => {
  const otp = "482913 is your OTP. Do not share it with anyone.";
  const out = filterInbox([
    { sender: "VK-BANK", body: otp, at: "2026-10-02T10:00:00" },
    { sender: "VM-HDFC", body: "INR 200.00 debited from A/c XX12 on 02-10-26. Avl Bal INR 900.00", at: "2026-10-02T11:00:00" },
    { sender: "VM-HDFC", body: "INR 5,000.00 credited to your account. Avl Bal INR 5,900.00", at: "2026-10-02T12:00:00" },
    { sender: "VM-HDFC", body: "Available balance is INR 1,200.50", at: "2026-10-02T13:00:00" },
    { sender: "VM-SHOP", body: "Your order of shoes is out for delivery", at: "2026-10-02T14:00:00" },
  ]);
  assert.equal(JSON.stringify(out).includes("482913"), false);
  assert.equal(out.kept.length, 3);
  assert.equal(out.kept[0].kind, "debit");
  assert.equal(out.kept[0].amount, 200);
  assert.equal(out.kept[1].kind, "credit");
  assert.equal(out.kept[1].amount, 5000);
  assert.equal(out.kept[2].kind, "balance");
  assert.equal(out.kept[2].amount, 1200.5);
  assert.equal(out.dropped, 2);
});

test("an unknown sender, unclear category, or own-account transfer asks once", () => {
  const base = { sender: "VX-NEWBANK", body: "INR 80.00 debited at CAFE", kind: "debit" as const, knownSenders: ["HDFC"], ownAccounts: ["XX99"], memory: [], category: null as string | null };
  const first = decideBankLine(base);
  assert.equal(first.outcome, "ask");
  if (first.outcome !== "ask") return;
  assert.equal(first.notification.actions.length, 3);
  const remembered = decideBankLine({ ...base, memory: [{ key: memoryKey(base.sender), choice: "category", category: "Food" }] });
  assert.equal(remembered.outcome, "save");
  if (remembered.outcome !== "save") return;
  assert.equal(remembered.category, "Food");
  assert.equal(remembered.transfer, false);

  const unclear = decideBankLine({ ...base, sender: "HDFC", knownSenders: ["HDFC"], category: null });
  assert.equal(unclear.outcome, "ask");
  if (unclear.outcome !== "ask") return;
  assert.equal(unclear.reason, "category");

  const transfer = decideBankLine({ ...base, sender: "HDFC", knownSenders: ["HDFC"], body: "INR 400.00 transferred to your own account XX99", category: "Transfer" });
  assert.equal(transfer.outcome, "ask");
  if (transfer.outcome !== "ask") return;
  assert.equal(transfer.reason, "transfer");
  const kept = decideBankLine({ ...base, sender: "HDFC", knownSenders: ["HDFC"], body: "INR 400.00 transferred to your own account XX99", category: "Transfer", memory: [{ key: memoryKey("HDFC"), choice: "transfer" }] });
  assert.equal(kept.outcome, "save");
  if (kept.outcome !== "save") return;
  assert.equal(kept.transfer, true);
  assert.equal(countsAsSpending({ kind: "debit", transfer: true }), false);
  assert.equal(countsAsSpending({ kind: "debit", transfer: false }), true);

  const ledger = applyInbox(
    [
      { sender: "HDFC", body: "INR 200.00 debited at Cafe", at: "2026-10-02T11:00:00" },
      { sender: "HDFC", body: "Available balance is INR 1,200.50", at: "2026-10-02T13:00:00" },
      { sender: "BANK", body: "482913 is your OTP. Do not share it.", at: "2026-10-02T10:00:00" },
    ],
    { knownSenders: ["HDFC"], ownAccounts: [], memory: [], categoryFor: () => "Food" },
  );
  assert.equal(ledger.saved.length, 2);
  assert.equal(ledger.saved[0].amount, 200);
  assert.equal(ledger.saved[0].transfer, false);
  assert.equal(ledger.saved[1].balance, 1200.5);
  assert.equal(ledger.saved[1].amount, 0);
  assert.equal(ledger.dropped, 1);
  assert.equal(JSON.stringify(ledger).includes("482913"), false);
  const ask = applyInbox(
    [{ sender: "VX-NEW", body: "INR 80.00 debited at CAFE", at: "2026-10-02T11:00:00" }],
    { knownSenders: [], ownAccounts: [], memory: [], categoryFor: () => null },
  );
  assert.equal(ask.saved.length, 0);
  assert.equal(ask.asks.length, 1);
  assert.equal(ask.asks[0].notification.actions.length, 3);
});

test("money charts, bills, cash, and a yearly export stay on the ledger", () => {
  const rows = [
    { id: "in", type: "income" as const, amount: 1000, category: "Salary", date: "2026-10-01" },
    { id: "food", type: "expense" as const, amount: 200, category: "Food", date: "2026-10-02", note: "Cafe" },
    { id: "move", type: "expense" as const, amount: 500, category: "Transfer", date: "2026-10-03", transfer: true },
    { id: "cash", type: "expense" as const, amount: 40, category: "Food", date: "2026-10-04", cash: true, note: "Tea" },
    cashRow("cash-2", 15, "Snacks", "2026-10-05"),
    { id: "old", type: "expense" as const, amount: 9, category: "Food", date: "2025-12-01" },
    { id: "net1", type: "expense" as const, amount: 199, category: "Subscriptions", date: "2026-08-04", note: "Netflix" },
    { id: "net2", type: "expense" as const, amount: 249, category: "Subscriptions", date: "2026-09-04", note: "Netflix" },
  ];
  assert.deepEqual(monthFlow(rows, "2026-10"), { in: 1000, out: 255 });
  assert.deepEqual(categorySplit(rows, "2026-10").find((c) => c.category === "Food")?.amount, 240);
  assert.equal(categorySplit(rows, "2026-10").some((c) => c.category === "Transfer"), false);
  const balances = balanceOverTime(rows.filter((r) => r.date.startsWith("2026-10") && r.id !== "cash-2"));
  assert.equal(balances[balances.length - 1].balance, 1000 - 200 - 40);
  assert.deepEqual(namedCategories(["Groceries", "Rent"]), ["Groceries", "Rent"]);
  assert.deepEqual(unusedCategories(["Food", "Rent"], rows), ["Rent"]);
  const bills = repeatingBills(rows);
  const netflix = bills.find((b) => b.name === "Netflix");
  assert.ok(netflix);
  assert.equal(netflix?.next, "2026-10-04");
  assert.equal(dayBefore(netflix?.next ?? ""), "2026-10-03");
  const change = priceChange(rows, "Netflix");
  assert.equal(change?.previous, 199);
  assert.equal(change?.latest, 249);
  assert.equal(change?.changed, true);
  const quiet = quietDelivery(new Date(2026, 9, 2, 23, 15), { enabled: true, from: 22, to: 7 });
  assert.equal(quiet.getHours(), 7);
  assert.equal(quietDelivery(new Date(2026, 9, 2, 9, 0), { enabled: true, from: 22, to: 7 }).getHours(), 9);
  const csv = yearlyMoneyCsv(rows, "INR", "2026");
  assert.equal(csv.includes("2025-12-01"), false);
  assert.equal(csv.includes("2026-10-02"), true);
  assert.equal(/cycle|buddy|cramps/i.test(csv), false);
  assert.equal(csv.includes("Date,Type,Category,Item,Amount,Note"), true);
  assert.equal(/\bshe\b|\bher\b/i.test(csv), false);
});

test("a receipt is cropped to the page, read from the words, and confirmed", () => {
  const page = { x: 20, y: 40, w: 400, h: 700 };
  const crop = cropToPage({ w: 480, h: 900 }, page);
  assert.deepEqual(crop, page);
  const words = readReceiptWords("Cafe Roma\n02/10/2026\nCoffee 120\nTotal 450.00\n");
  assert.equal(words.shop, "Cafe Roma");
  assert.equal(words.amount, 450);
  assert.equal(words.date, "2026-10-02");
  assert.equal(words.source, "words");
  assert.equal(receiptCounts(false), false);
  assert.equal(receiptCounts(true), true);
  assert.equal(flagMismatch(450, 400), true);
  assert.equal(flagMismatch(450, 450), false);
});

test("one locked file describes itself, and cloud sync stays optional", () => {
  const db = emptyDB();
  db.txns = [{ id: "t", type: "expense", amount: 10, category: "Food", date: "2026-10-01" }];
  db.notes = [{ id: "n", title: "List", body: "", checklist: [], createdAt: "2026-10-01", updatedAt: "2026-10-01" }];
  db.trips = [{ id: "trip", name: "Goa", destination: "Goa", start: "2026-11-01", end: "2026-11-03", travellers: 1, budget: 0, packing: [], itinerary: [], docs: [], createdAt: "2026-10-01" }];
  db.cycle = { ...db.cycle, days: [{ id: "d", date: "2026-09-01", bleeding: "flow" }] };
  db.settings.biometricEnabled = true;
  db.settings.unlockMethod = "both";
  const line = describeContents(db);
  assert.match(line, /1 money entry/);
  assert.match(line, /1 cycle day/);
  assert.match(line, /1 note/);
  assert.match(line, /1 trip/);
  assert.match(line, /settings/);
  assert.equal(/\bshe\b|\bher\b/i.test(line), false);
  assert.equal(replaceAllowed(true, false), false);
  assert.equal(replaceAllowed(true, true), true);
  const bundled = bundleForFile(db);
  assert.equal(bundled.txns.length, 1);
  assert.equal(bundled.notes.length, 1);
  assert.equal(bundled.trips.length, 1);
  assert.equal(bundled.cycle.days.length, 1);
  assert.equal(JSON.stringify(bundled).toLowerCase().includes("biometric"), false);
  assert.equal(canOpenFile({ passphrase: "correct horse", samePhone: false, biometricOk: true }), true);
  assert.equal(canOpenFile({ passphrase: "", samePhone: true, biometricOk: true }), true);
  assert.equal(canOpenFile({ passphrase: "", samePhone: false, biometricOk: true }), false);
  assert.equal(accessMode(true), "edit");
  assert.equal(accessMode(false), "read-only");
  assert.equal(defaultCloud(), "off");
  assert.equal(cloudScope("drive"), "https://www.googleapis.com/auth/drive.file");
  assert.notEqual(cloudScope("drive"), "https://www.googleapis.com/auth/drive");
  assert.equal(cloudScope("onedrive"), "https://graph.microsoft.com/Files.ReadWrite.AppFolder");
  assert.equal(uploadNotices(false).length, 1);
  assert.equal(uploadNotices(true).length, 0);
  assert.equal(askUnsynced({ provider: "drive", lastSyncAt: null, unlockedAt: "2026-10-03T08:00:00", asked: false }), true);
  assert.equal(askUnsynced({ provider: "drive", lastSyncAt: null, unlockedAt: "2026-10-03T08:00:00", asked: true }), false);
  assert.equal(askUnsynced({ provider: "off", lastSyncAt: null, unlockedAt: "2026-10-03T08:00:00", asked: false }), false);
  assert.equal(askUnsynced({ provider: "drive", lastSyncAt: "2026-10-03T09:00:00", unlockedAt: "2026-10-03T08:00:00", asked: false }), false);
});

test("glass and bento sit on every look and on paper, midnight, dune, and amoled", () => {
  const looks: LookId[] = ["current", "soft", "tight", "plain", "cards", "ink", "signal", "poster"];
  const themes: ThemeKey[] = ["paper", "midnight", "dune", "amoled"];
  const current = resolveLook("current");
  for (const look of looks) {
    for (const theme of themes) {
      const glass = resolveLayout("glass", look, theme);
      const bento = resolveLayout("bento", look, theme);
      assert.equal(glass.frost, true);
      assert.equal(glass.bento, false);
      assert.equal(glass.theme, theme);
      assert.equal(glass.look.id, look);
      assert.equal(bento.bento, true);
      assert.equal(bento.frost, false);
      assert.equal(bento.look.id, look);
    }
  }
  const overCurrent = resolveLayout("glass", "current", "paper");
  assert.deepEqual(overCurrent.look.radius, current.radius);
  assert.deepEqual(overCurrent.look.type, current.type);
  assert.equal(overCurrent.look.space, current.space);
  assert.equal(resolveLayout("stack", "current", "midnight").frost, false);
});

test("the cycle widget is the next window, and the shade has no date", () => {
  const widget = cycleHomeWidget({ line: "Guess · 12 Oct – 16 Oct", paused: false });
  assert.equal(widget.window, "Guess · 12 Oct – 16 Oct");
  assert.equal(shadeHasDate(widget.shade), false);
  assert.equal(/cramps|food|remedy|mood|arousal/i.test(`${widget.window} ${widget.shade}`), false);
  assert.equal(cycleHomeWidget({ line: "Paused", paused: true }).window, "Paused");
  assert.equal(shadeHasDate(cycleHomeWidget(null).shade), false);
});

test("search covers notes, money, cycle, and trips, and the decoy hides cycle and money", () => {
  const db = emptyDB();
  db.notes = [{ id: "n", title: "Market list", body: "apples", checklist: [], createdAt: "2026-10-01", updatedAt: "2026-10-01" }];
  db.txns = [{ id: "t", type: "expense", amount: 80, category: "Food", date: "2026-10-02", note: "Cafe Roma" }];
  db.cycle = { ...db.cycle, days: [{ id: "d", date: "2026-09-01", bleeding: "flow", symptom: "cramps" }] };
  db.trips = [{ id: "trip", name: "Goa road", destination: "Goa", start: "2026-11-01", end: "2026-11-03", travellers: 1, budget: 0, packing: [], itinerary: [], docs: [], createdAt: "2026-10-01" }];
  const notes = ownSearch(db, "apples", "real");
  const money = ownSearch(db, "Cafe Roma", "real");
  const cycle = ownSearch(db, "cramps", "real");
  const trips = ownSearch(db, "Goa", "real");
  assert.equal(notes.some((g) => g.items.some((i) => i.title.includes("Market"))), true);
  assert.equal(money.some((g) => g.items.some((i) => i.title.includes("Cafe") || i.subtitle.includes("Cafe"))), true);
  assert.equal(cycle.some((g) => g.title === "Cycle"), true);
  assert.equal(trips.some((g) => g.items.some((i) => i.route === "/travel/trip")), true);
  const decoy = buildDecoyDB(db);
  decoy.cycle = db.cycle;
  decoy.txns = db.txns;
  decoy.notes = db.notes;
  assert.equal(ownSearch(decoy, "cramps", "decoy").some((g) => g.title === "Cycle"), false);
  assert.equal(ownSearch(decoy, "Cafe Roma", "decoy").some((g) => g.title === "Transactions"), false);
  assert.equal(ownSearch(decoy, "apples", "decoy").some((g) => g.items.some((i) => i.title.includes("Market"))), true);
});

test("records that share a date or an amount can be linked", () => {
  const links = suggestShared({
    debits: [{ id: "deb", date: "2026-10-02", amount: 450 }],
    receipts: [{ id: "rec", date: "2026-10-02", amount: 450 }],
    trips: [{ id: "trip", start: "2026-10-01", end: "2026-10-04" }],
    fuel: [{ id: "fuel", date: "2026-10-02", total: 1800 }],
    periods: [{ id: "per", date: "2026-09-12" }],
    missedWork: [{ id: "work", date: "2026-09-12" }],
  });
  assert.equal(links.some((l) => l.fromId === "deb" && l.toId === "rec"), true);
  assert.equal(links.some((l) => l.fromId === "trip" && l.toId === "fuel" && l.because === "date"), true);
  assert.equal(links.some((l) => l.fromId === "per" && l.toId === "work" && l.because === "date"), true);
  const none = suggestShared({
    debits: [{ id: "deb", date: "2026-01-01", amount: 10 }],
    receipts: [{ id: "rec", date: "2026-02-02", amount: 99 }],
    trips: [{ id: "trip", start: "2026-03-01", end: "2026-03-02" }],
    fuel: [{ id: "fuel", date: "2026-04-04", total: 50 }],
    periods: [{ id: "per", date: "2026-05-05" }],
    missedWork: [{ id: "work", date: "2026-06-06" }],
  });
  assert.equal(none.length, 0);
});

test("trip math warns from mileage, service kilometers, and saved weather", () => {
  const stops = timeline([
    { id: "b", kind: "snack", name: "Chai", at: "2026-10-02T11:00" },
    { id: "a", kind: "fuel", name: "Pump", at: "2026-10-02T08:00" },
  ]);
  assert.deepEqual(stops.map((s) => s.id), ["a", "b"]);
  const low = rangeLeft(15, 10, 140);
  assert.equal(low.remainingKm, 10);
  assert.equal(low.warn, true);
  const fine = rangeLeft(15, 40, 10);
  assert.equal(fine.warn, false);
  assert.equal(serviceLeft(12000, 10000, 5000), 3000);
  const reused = reusableStops(
    [{ id: "old", kind: "snack", name: "Dhaba", at: "2026-01-01T12:00" }],
    [{ id: "now", kind: "fuel", name: "Pump", at: "2026-10-02T08:00" }],
  );
  assert.equal(reused[0].name, "Dhaba");
  assert.equal(reusableStops([{ id: "old", kind: "snack", name: "Pump", at: "2026-01-01" }], [{ id: "now", kind: "fuel", name: "Pump", at: "2026-10-02" }]).length, 0);
  assert.equal(remindSaveWeather(false), true);
  assert.equal(remindSaveWeather(true), false);
  assert.equal(OFFLINE_MAP, false);
  assert.equal(weatherAlong(false, ["Pune", "Goa"]).available, false);
  assert.deepEqual(weatherAlong(true, ["Pune", "Goa"]).cities, ["Pune", "Goa"]);
});

test("the greeting names the one thing due today", () => {
  const due = oneDueToday(
    [
      { title: "Rent", date: "2026-10-03" },
      { title: "Oil change", date: "2026-10-03" },
      { title: "Insurance", date: "2026-10-04" },
    ],
    "2026-10-03",
  );
  const line = homeLine(9, "Asha", due?.title ?? null);
  assert.equal(line, "Oil change is due today");
  assert.equal(line.includes("Rent"), false);
  assert.equal(line.includes("Asha"), false);
  assert.equal(/\bshe\b|\bher\b/i.test(line), false);
  assert.equal(homeLine(9, "Asha", null), "Good morning, Asha");
  assert.equal(oneDueToday([{ title: "Rent", date: "2026-10-04" }], "2026-10-03"), null);
});

test("one stop or one bill can be handed to one person", () => {
  const bill = shareBill("Rae", { name: "Electricity", amount: 820 });
  const stop = shareStop("Rae", { name: "Dhaba" });
  assert.equal(bill.includes("Rae"), true);
  assert.equal(bill.includes("Electricity"), true);
  assert.equal(bill.includes("820"), true);
  assert.equal(bill.includes("Rent"), false);
  assert.equal(stop.includes("Dhaba"), true);
  assert.equal(stop.includes("\n"), false);
  assert.equal(/\bshe\b|\bher\b/i.test(`${bill} ${stop}`), false);
});

test("the decoy hides cycle and money", () => {
  const real = emptyDB();
  real.txns = [{ id: "secret-txn", type: "expense", amount: 99999, category: "Other", date: "2026-01-01" }];
  real.cycle = { ...real.cycle, buddyName: "Mango" };
  const decoy = buildDecoyDB(real);
  assert.equal(decoy.txns.some((t) => t.id === "secret-txn"), false);
  assert.equal(decoy.txns.length, 0);
  assert.equal(decoy.settings.modules.some((m) => m.id === "cycle"), false);
  assert.equal(decoy.settings.modules.find((m) => m.id === "money")?.enabled, false);
  assert.equal(shownInDecoy("cycle"), false);
  assert.equal(shownInDecoy("money"), false);
  assert.equal(shownInDecoy("notes"), true);
  assert.equal(JSON.stringify(decoy).includes("Mango"), false);
});
