const assert = require("node:assert/strict");
const test = require("node:test");
const { nextAndroidVersion } = require("./next-android-version");

test("the first release is 0.1", () => {
  assert.equal(nextAndroidVersion([]), "0.1");
  assert.equal(nextAndroidVersion([""]), "0.1");
});

test("the next tag is one step above the highest v0.N", () => {
  assert.equal(nextAndroidVersion(["v0.1", "v0.4", "v0.2"]), "0.5");
  assert.equal(nextAndroidVersion(["v0.9"]), "0.10");
});

test("version 1 and other shapes are ignored", () => {
  assert.equal(nextAndroidVersion(["v1.0.0", "v0.2.1", "1.0.0", "v0.3"]), "0.4");
});

test("without a changelog the next release is still the next minor", () => {
  assert.equal(nextAndroidVersion(["v0.6"]), "0.7");
  assert.equal(nextAndroidVersion(["v0.6"], ""), "0.7");
});

test("one unpublished patch heading is the next release", () => {
  const tags = ["v0.1", "v0.2", "v0.3", "v0.4", "v0.5", "v0.6"];
  const changelog = "## v0.6.1\n\n- Presets show their tiles.\n\n## v0.6\n\n- Shipped.\n";
  assert.equal(nextAndroidVersion(tags, changelog), "0.6.1");
  const again = "## v0.6.2\n\n- Next.\n\n## v0.6.1\n\n- Done.\n\n## v0.6\n\n- Shipped.\n";
  assert.equal(nextAndroidVersion(["v0.6", "v0.6.1"], again), "0.6.2");
  const patch = "## v0.6.3\n\n- Card.\n\n## v0.6.2\n\n- Boards.\n\n## v0.6\n\n- Shipped.\n";
  assert.equal(nextAndroidVersion(["v0.6", "v0.6.1", "v0.6.2"], patch), "0.6.3");
});

test("one skipped patch heading is that release", () => {
  const changelog = "## v0.8.2\n\n- Folded.\n\n## v0.8\n\n- Shipped.\n";
  assert.equal(nextAndroidVersion(["v0.1", "v0.2", "v0.8"], changelog), "0.8.2");
});

test("two unpublished headings stay on the next minor", () => {
  const changelog = "## v0.7\n\n- Later.\n\n## v0.6.1\n\n- Patch.\n\n## v0.6\n\n- Shipped.\n";
  assert.equal(nextAndroidVersion(["v0.6"], changelog), "0.7");
});
