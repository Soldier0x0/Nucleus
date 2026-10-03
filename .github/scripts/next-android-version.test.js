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
