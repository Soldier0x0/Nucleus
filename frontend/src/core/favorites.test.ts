import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { favoriteCards } from "./favorites.ts";
import { emptyDB } from "./defaults.ts";

const settingsOn = (on: string[]) => ({ modules: emptyDB().settings.modules.map((m) => ({ ...m, enabled: on.includes(m.id) })) });

test("cards drop with their module", () => {
  assert.deepEqual(favoriteCards(settingsOn(["money", "vehicles"])), ["attention", "reminder", "budget", "spend", "service"]);
  assert.deepEqual(favoriteCards(settingsOn(["vehicles"])), ["attention", "reminder", "service"]);
  assert.deepEqual(favoriteCards(settingsOn(["money"])), ["attention", "reminder", "budget", "spend"]);
  assert.deepEqual(favoriteCards(settingsOn(["notes"])), ["attention", "reminder"]);
});

test("a single-module shell keeps only that module's cards", () => {
  assert.deepEqual(favoriteCards(settingsOn(["money", "vehicles"]), "vehicles"), ["attention", "reminder", "service"]);
  assert.deepEqual(favoriteCards(settingsOn(["money", "vehicles"]), "money"), ["attention", "reminder", "budget", "spend"]);
  assert.deepEqual(favoriteCards(settingsOn(["money", "vehicles"]), "notes"), ["attention", "reminder"]);
});

test("the Favourites screen scopes itself and masks money in privacy mode", () => {
  const screen = readFileSync(new URL("../../app/(tabs)/favorites.tsx", import.meta.url), "utf8");
  assert.match(screen, /favoriteCards\(db\.settings, single\)/);
  assert.match(screen, /nativeModuleShellId\(db\.settings\)/);
  assert.match(screen, /privacyMode/);
  assert.match(screen, /testID="favorites-budget-ring"/);
  assert.match(screen, /testID="favorites-spend-chart"/);
  assert.match(screen, /testID="favorites-attention"/);
  assert.match(screen, /testID="favorites-reminder"/);
  assert.match(screen, /testID="favorites-service"/);
});
