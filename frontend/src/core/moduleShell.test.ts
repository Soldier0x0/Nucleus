import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { moduleTabLabel, nativeModuleShellId, singleModuleId } from "./modules.ts";
import { PRESET_CHOICES } from "./presets.ts";

const modulesOn = (on: string[], hidden: string[] = []) => emptyDB().settings.modules.map((m) => ({ ...m, enabled: on.includes(m.id), hidden: hidden.includes(m.id) }));

test("the shell needs exactly one module on and not hidden", () => {
  assert.equal(singleModuleId(modulesOn(["vehicles"])), "vehicles");
  assert.equal(singleModuleId(modulesOn(["vehicles", "money"])), null);
  assert.equal(singleModuleId(modulesOn([])), null);
  assert.equal(singleModuleId(modulesOn(["vehicles"], ["vehicles"])), null);
});

test("nativeModuleShell: false turns the shell off", () => {
  assert.equal(nativeModuleShellId({ modules: modulesOn(["vehicles"]) }), "vehicles");
  assert.equal(nativeModuleShellId({ modules: modulesOn(["vehicles"]), nativeModuleShell: true }), "vehicles");
  assert.equal(nativeModuleShellId({ modules: modulesOn(["vehicles"]), nativeModuleShell: false }), null);
});

test("the module tab keeps its short name", () => {
  assert.equal(moduleTabLabel("vehicles"), "Vehicle");
  assert.equal(moduleTabLabel("papers"), "Documents");
  assert.equal(moduleTabLabel("health"), "Health");
});

test("v0.9.8: the Money, Vehicle and Desk chips are gone; Favourites is the landing", () => {
  assert.equal(PRESET_CHOICES.some((choice) => choice.id === "money" || choice.id === "vehicle" || choice.id === "desk"), false);
  assert.equal(PRESET_CHOICES.some((choice) => choice.id === "custom"), true);
  assert.match(readFileSync(new URL("../../app/index.tsx", import.meta.url), "utf8"), /FAVORITES_ROUTE/);
});

test("v0.12: the tab bar is Favourites, Today, Attention, Settings — no hidden tabs", () => {
  const tabs = readFileSync(new URL("../../app/(tabs)/_layout.tsx", import.meta.url), "utf8");
  assert.match(tabs, /tab-favorites/);
  assert.match(tabs, /tab-today/);
  assert.match(tabs, /tab-attention/);
  assert.match(tabs, /tab-settings/);
  assert.doesNotMatch(tabs, /href: null/);
  assert.doesNotMatch(tabs, /name="modules"/);
  const home = readFileSync(new URL("../../app/(tabs)/index.tsx", import.meta.url), "utf8");
  assert.match(home, /nativeModuleShellId\(db\.settings\)/);
  assert.match(home, /MODULE_HOME\[shell\]/);
});

test("v0.12: the boot route waits for the lock and lands on Favourites; reopen is gone", () => {
  const boot = readFileSync(new URL("../../app/index.tsx", import.meta.url), "utf8");
  assert.match(boot, /useLockSignal\(\)/);
  assert.match(boot, /FAVORITES_ROUTE/);
  assert.doesNotMatch(boot, /reopenTarget|pendingReopen|takePendingReopen/);
  const layout = readFileSync(new URL("../../app/(tabs)/_layout.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(layout, /takePendingReopen|ReopenOnce/);
  const gate = readFileSync(new URL("../components/LockGate.tsx", import.meta.url), "utf8");
  assert.match(gate, /publishLockState\(locked\)/);
});
