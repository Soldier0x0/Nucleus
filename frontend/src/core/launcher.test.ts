import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LAUNCHER_ALIASES, defaultLauncher, launcherIconChange, markPalette, resolveLauncher } from "./launcher.ts";
import { askAfterIconTap, askOnRelaunch } from "./lockPolicy.ts";

test("paper press on paper is the default alias", () => {
  const resolved = resolveLauncher(defaultLauncher(), "midnight");
  assert.equal(resolved.alias, "IconPaperPaper");
  assert.equal(resolved.family, "paper");
  assert.equal(resolved.variant, "paper");
});

test("match follows the theme and a fixed choice does not", () => {
  assert.equal(resolveLauncher({ family: "metal", variant: "match" }, "dune").alias, "IconMetalDune");
  assert.equal(resolveLauncher({ family: "metal", variant: "match" }, "graphite").alias, "IconMetalMidnight");
  assert.equal(resolveLauncher({ family: "glass", variant: "match" }, "system", "light").alias, "IconGlassPaper");
  assert.equal(resolveLauncher({ family: "glass", variant: "match" }, "system", "dark").alias, "IconGlassMidnight");
  assert.equal(resolveLauncher({ family: "tiles", variant: "amoled" }, "paper").alias, "IconTilesAmoled");
});

test("sixteen pictures, one alias each", () => {
  assert.equal(LAUNCHER_ALIASES.length, 16);
  assert.equal(new Set(LAUNCHER_ALIASES).size, 16);
});

test("the lock mark uses the paper-press colours", () => {
  const paper = markPalette("paper", "paper");
  assert.equal(paper.ring, "#1A1A1A");
  assert.equal(paper.core, "#C9843A");
  assert.equal(markPalette("paper", "amoled").ground, "#000000");
});

test("the activity alias stays put when that picture is already showing", () => {
  const fresh = Object.fromEntries(LAUNCHER_ALIASES.map((alias) => [alias, "default" as const]));
  const same = launcherIconChange(fresh, "IconPaperPaper");
  assert.equal(same.changed, false);
  assert.deepEqual(same.enable, []);
  assert.deepEqual(same.disable, []);

  const showing = Object.fromEntries(LAUNCHER_ALIASES.map((alias) => [alias, alias === "IconMetalDune" ? "enabled" as const : "disabled" as const]));
  const still = launcherIconChange(showing, "IconMetalDune");
  assert.equal(still.changed, false);
  assert.deepEqual(still.enable, []);
  assert.deepEqual(still.disable, []);

  const next = launcherIconChange(showing, "IconGlassPaper");
  assert.equal(next.changed, true);
  assert.deepEqual(next.enable, ["IconGlassPaper"]);
  assert.deepEqual(next.disable, ["IconMetalDune"]);
});

test("changing the icon on an unlocked phone does not ask, and a lock or a full close still does", () => {
  const showing = Object.fromEntries(LAUNCHER_ALIASES.map((alias) => [alias, alias === "IconPaperPaper" ? "enabled" as const : "disabled" as const]));
  const changed = { lockEnabled: true, states: showing, nextAlias: "IconMetalDune" };
  assert.equal(askAfterIconTap({ ...changed, phoneLocked: false, fullyClosed: false }), false);
  assert.equal(askAfterIconTap({ ...changed, phoneLocked: true, fullyClosed: false }), true);
  assert.equal(askAfterIconTap({ ...changed, phoneLocked: false, fullyClosed: true }), true);
  assert.equal(askOnRelaunch({ lockEnabled: true, marked: true, phoneLocked: false, fullyClosed: false }), true);
  assert.equal(askOnRelaunch({ lockEnabled: true, marked: true, phoneLocked: true, fullyClosed: false }), true);
  assert.equal(askOnRelaunch({ lockEnabled: true, marked: true, phoneLocked: false, fullyClosed: true }), true);
  assert.equal(askOnRelaunch({ lockEnabled: true, marked: false, phoneLocked: false, fullyClosed: true }), true);
  assert.equal(askOnRelaunch({ lockEnabled: true, marked: false, phoneLocked: false, fullyClosed: false }), true);
  assert.equal(askOnRelaunch({ lockEnabled: false, marked: true, phoneLocked: false, fullyClosed: false }), false);
});

test("tapping the icon on an unlocked phone does not ask, and a lock or a full close still does", () => {
  const showing = Object.fromEntries(LAUNCHER_ALIASES.map((alias) => [alias, alias === "IconPaperPaper" ? "enabled" as const : "disabled" as const]));
  const tap = { lockEnabled: true, states: showing, nextAlias: "IconPaperPaper" };
  assert.equal(askAfterIconTap({ ...tap, phoneLocked: false, fullyClosed: false }), false);
  assert.equal(askAfterIconTap({ ...tap, phoneLocked: true, fullyClosed: false }), true);
  assert.equal(askAfterIconTap({ ...tap, phoneLocked: false, fullyClosed: true }), true);
  assert.equal(askAfterIconTap({ ...tap, lockEnabled: false, phoneLocked: true, fullyClosed: true }), false);
});

test("setLauncherIcon returns before any alias write when the picture is unchanged", () => {
  const kt = readFileSync(new URL("../../modules/nucleus-android/android/src/main/java/com/nucleus/widgets/NucleusAndroidModule.kt", import.meta.url), "utf8");
  const start = kt.indexOf('Function("setLauncherIcon")');
  const end = kt.indexOf("private inner class SaveLockedFileContract");
  const body = kt.slice(start, end);
  const guard = body.indexOf("if (launcherAliasUnchanged(");
  const write = body.indexOf("setComponentEnabledSetting");
  assert.ok(guard >= 0);
  assert.ok(write > guard);
  const between = body.slice(guard, write);
  assert.match(between, /return@Function/);
  const remembered = between.indexOf("rememberIconRestart");
  const returned = between.indexOf("return@Function");
  assert.ok(remembered > returned, "the unlock mark is written only after the unchanged icon has already returned");
  assert.match(body, /getComponentEnabledSetting/);
  assert.match(kt, /Function\("consumeIconRestart"\)/);
});
