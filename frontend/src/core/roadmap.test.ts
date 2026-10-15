import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { mergeDB } from "./merge.ts";
import { applyPack, buildPack, packChoices, parsePack } from "./packs.ts";
import { looksLikeReceipt, parseReceipt } from "./receipt.ts";
import { backlinks, linkedTitles } from "./wiki.ts";
import { widgetSnapshot } from "./widgets.ts";
import type { Rule, WikiPage } from "./types.ts";

test("receipt text keeps the total, the date and the first shop line", () => {
  const read = parseReceipt("Cafe Roma\n02/10/2026\nCoffee 120\nTotal 450.00\n");
  assert.equal(read.merchant, "Cafe Roma");
  assert.equal(read.amount, 450);
  assert.equal(read.date, "2026-10-02");
  assert.equal(looksLikeReceipt("Cafe Roma\nTotal 450"), true);
  assert.equal(looksLikeReceipt("450 food lunch"), false);
});

test("wiki links and backlinks use the title inside brackets", () => {
  const pages: WikiPage[] = [
    { id: "a", title: "Activa", body: "Service notes. See [[Workshop]].", createdAt: "", updatedAt: "" },
    { id: "b", title: "Workshop", body: "Call before noon.", createdAt: "", updatedAt: "" },
  ];
  assert.deepEqual(linkedTitles(pages[0].body), ["Workshop"]);
  assert.deepEqual(backlinks(pages, "Workshop").map((p) => p.title), ["Activa"]);
  assert.equal(backlinks(pages, "Activa").length, 0);
});

test("a pack adds only the approved rows and skips a name you already have", () => {
  const rule: Rule = { id: "r1", name: "Renewals", trigger: { kind: "renewal", value: 5 }, actions: ["attention"], enabled: true, createdAt: "2026-01-01" };
  const pack = parsePack(JSON.stringify(buildPack("Trip", { rules: [rule], tools: [], checklists: [{ title: "Before leaving", items: ["Passport"] }], templates: [{ name: "Hill", groups: [{ category: "Clothing", items: ["Jacket"] }] }] })));
  const db = emptyDB();
  db.rules.push({ ...rule, id: "mine" });
  const choices = packChoices(db, pack);
  assert.equal(choices.find((c) => c.kind === "rule")?.already, true);
  const next = applyPack(db, pack, choices.map((c) => c.key));
  assert.equal(next.rules.length, 1);
  assert.equal(next.notes.length, 1);
  assert.equal(next.notes[0].checklist[0].text, "Passport");
  assert.equal(next.templates[0].name, "Hill");
  assert.equal(applyPack(next, pack, choices.map((c) => c.key)).notes.length, 1);
});

test("widgets hide an amount in privacy mode and count a future date", () => {
  const db = emptyDB();
  db.budget.monthly = 3100;
  db.txns.push({ id: "t", type: "expense", amount: 1000, category: "Food", date: "2026-10-02" });
  db.vehicles.push({ id: "v", name: "Activa", type: "bike", fuelType: "petrol", initialOdometer: 0, serviceIntervalKm: 3000, insuranceExpiry: "2026-10-09", createdAt: "2026-01-01" });
  db.trips.push({ id: "trip", name: "Goa", destination: "Goa", start: "2026-10-12", end: "2026-10-16", travellers: 2, budget: 0, packing: [], itinerary: [], docs: [], createdAt: "2026-01-01" });
  const open = widgetSnapshot(db, "2026-10-02");
  assert.equal(open.countdown?.title, "Activa insurance");
  assert.equal(open.countdown?.days, 7);
  assert.equal(open.trip?.when, "Starts in 10 days");
  assert.match(open.budget.value, /2/);
  db.settings.privacyMode = true;
  const hidden = widgetSnapshot(db, "2026-10-02");
  assert.equal(hidden.budget.value, "Hidden");
  assert.equal(hidden.privacy, true);
});

test("a file from another phone keeps both wiki pages", () => {
  const mine = emptyDB();
  const theirs = emptyDB();
  mine.wiki.push({ id: "a", title: "Home", body: "", createdAt: "", updatedAt: "" });
  theirs.wiki.push({ id: "b", title: "Workshop", body: "[[Home]]", createdAt: "", updatedAt: "" });
  theirs.rules.push({ id: "r", name: "Renewals", trigger: { kind: "renewal", value: 3 }, actions: ["attention"], enabled: true, createdAt: "" });
  const merged = mergeDB(mine, theirs);
  assert.deepEqual(merged.wiki.map((p) => p.title).sort(), ["Home", "Workshop"]);
  assert.equal(merged.rules.length, 1);
  assert.equal(merged.settings.currency, mine.settings.currency);
});
