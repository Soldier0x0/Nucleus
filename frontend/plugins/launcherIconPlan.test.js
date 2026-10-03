const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { adaptiveIconXml, iconPlan } = require("./launcherIconPlan");

test("the launcher icon is an adaptive mark that fills the mask", () => {
  for (const family of ["paper", "metal", "glass", "tiles"]) {
    for (const variant of ["paper", "midnight", "dune", "amoled"]) {
      const plan = iconPlan(family, variant);
      assert.equal(plan.kind, "adaptive");
      assert.equal(plan.masked, true);
      assert.equal(plan.transparent, false);
      assert.equal(plan.emptyCanvas, false);
      assert.notEqual(plan.background.toLowerCase(), "#ffffff");
      assert.match(plan.foreground, /_fg$/);
      const xml = adaptiveIconXml(plan);
      assert.match(xml, /<adaptive-icon/);
      assert.match(xml, new RegExp(`@mipmap/${plan.foreground}`));
      assert.match(xml, new RegExp(`@color/${plan.resource}`));
      assert.doesNotMatch(xml, /#FFFFFF|transparent/i);
    }
  }
});

test("the android icon plugin installs that adaptive mark", () => {
  const plugin = fs.readFileSync(path.join(__dirname, "withLauncherIcons.js"), "utf8");
  const paint = fs.readFileSync(path.join(__dirname, "../scripts/paint-launcher.mjs"), "utf8");
  assert.match(plugin, /iconPlan\(/);
  assert.match(plugin, /adaptiveIconXml\(/);
  assert.match(plugin, /mipmap-anydpi-v26/);
  assert.doesNotMatch(plugin, /#FFFFFF/);
  assert.match(paint, /const outer = 50 \* scale/);
  assert.match(paint, /const stroke = 22 \* scale/);
  assert.match(paint, /buf\[i \+ 3\] = 255/);
});
