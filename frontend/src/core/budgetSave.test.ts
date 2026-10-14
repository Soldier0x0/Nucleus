import assert from "node:assert/strict";
import test from "node:test";
import { budgetCleared } from "./budgetSave.ts";

const prev = { monthly: 30000, categories: { Food: 8000, Fuel: 3000 } };

test("L7: setting the monthly budget to 0 warns that it was cleared", () => {
  assert.equal(budgetCleared(prev, { monthly: 0, categories: prev.categories }), true);
});

test("L7: dropping a category limit (0 or blank) warns that it was cleared", () => {
  assert.equal(budgetCleared(prev, { monthly: 30000, categories: { Food: 8000 } }), true);
});

test("L7: a normal edit or a first budget does not warn", () => {
  assert.equal(budgetCleared(prev, { monthly: 32000, categories: { Food: 9000, Fuel: 3000, Rent: 15000 } }), false);
  assert.equal(budgetCleared({ monthly: 0, categories: {} }, { monthly: 0, categories: {} }), false);
  assert.equal(budgetCleared({ monthly: 0, categories: { Food: 0 } }, { monthly: 5000, categories: {} }), false);
});
