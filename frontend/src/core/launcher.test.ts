import assert from "node:assert/strict";
import test from "node:test";
import { LAUNCHER_ALIASES, defaultLauncher, markPalette, resolveLauncher } from "./launcher.ts";

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
