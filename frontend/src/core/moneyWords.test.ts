import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { parseCapture } from "./capture.ts";
import { categoryFromOther, classifyMoney, exportBounds, itemTotals, moneyCsv, moneySuggestions } from "./moneyWords.ts";
import type { Txn } from "./types.ts";

test("breakfast, samosa, carrots and a bare food word", () => {
  assert.deepEqual(classifyMoney("breakfast", "expense"), { category: "Food", item: "Breakfast" });
  assert.deepEqual(classifyMoney("samosa", "expense"), { category: "Food", item: "Snacks" });
  assert.deepEqual(classifyMoney("carrots", "expense"), { category: "Groceries", item: "Carrot" });
  assert.deepEqual(classifyMoney("food", "expense"), { category: "Food" });
  assert.equal(classifyMoney("mario", "expense"), null);
});

test("concert, accident and dividend stay on their own rows", () => {
  assert.deepEqual(classifyMoney("concert", "expense"), { category: "Entertainment", item: "Concert" });
  assert.deepEqual(classifyMoney("accident", "expense"), { category: "Vehicle", item: "Accident" });
  assert.deepEqual(classifyMoney("stand-up", "expense"), { category: "Entertainment", item: "Comedy" });
  assert.deepEqual(classifyMoney("dividend", "income"), { category: "Dividend" });
});

test("suggestions need two letters", () => {
  assert.equal(moneySuggestions("s", "expense").length, 0);
  const snacks = moneySuggestions("sam", "expense").map((s) => s.label);
  assert.ok(snacks.includes("Snacks"));
});

test("a typed Other name replaces Other", () => {
  assert.equal(categoryFromOther("  School fees  "), "School fees");
  assert.equal(categoryFromOther("   "), "Other");
  assert.equal(categoryFromOther("x".repeat(80)).length, 40);
});

test("item totals keep carrots separate from milk", () => {
  const txns: Txn[] = [
    { id: "a", type: "expense", amount: 40, category: "Groceries", item: "Carrot", date: "2026-10-01" },
    { id: "b", type: "expense", amount: 20, category: "Groceries", item: "Carrot", date: "2026-10-02" },
    { id: "c", type: "expense", amount: 60, category: "Groceries", item: "Milk", date: "2026-10-02" },
    { id: "d", type: "expense", amount: 10, category: "Food", item: "Lunch", date: "2026-10-02" },
  ];
  assert.deepEqual(itemTotals(txns, "Groceries"), [
    ["Carrot", 60],
    ["Milk", 60],
  ]);
});

test("csv lists the month, the Monday week, and the carrot line", () => {
  const txns: Txn[] = [{ id: "a", type: "expense", amount: 60, category: "Groceries", item: "Carrot", date: "2026-10-03", note: "carrots" }];
  const csv = moneyCsv(txns, "INR", "2026-10-01", "2026-10-03");
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /Monthly totals/);
  assert.match(csv, /Weekly totals/);
  assert.match(csv, /2026-09-28,60\.00,0\.00/);
  assert.match(csv, /Groceries,Carrot,60\.00,carrots/);
  assert.match(csv, /Date,Type,Category,Item,Amount,Note/);
});

test("export bounds", () => {
  assert.deepEqual(exportBounds("2026-10-03", "month"), { from: "2026-10-01", to: "2026-10-03" });
  assert.deepEqual(exportBounds("2026-10-03", "30"), { from: "2026-09-04", to: "2026-10-03" });
  assert.deepEqual(exportBounds("2026-10-03", "custom", "2026-10-20", "2026-10-01"), { from: "2026-10-01", to: "2026-10-20" });
});

test("capture still reads 450 food lunch and files samosa under snacks", () => {
  const db = emptyDB();
  const lunch = parseCapture(db, "450 food lunch");
  assert.ok(lunch && !("error" in lunch));
  if (!lunch || "error" in lunch) return;
  const next = lunch.apply(db);
  assert.equal(next.txns[0].category, "Food");
  assert.equal(next.txns[0].note, "lunch");
  assert.equal(next.txns[0].item, "Lunch");
  const snack = parseCapture(db, "40 samosa");
  assert.ok(snack && !("error" in snack));
  if (!snack || "error" in snack) return;
  const saved = snack.apply(db);
  assert.equal(saved.txns[0].category, "Food");
  assert.equal(saved.txns[0].item, "Snacks");
  assert.equal(saved.txns[0].note, "samosa");
});
