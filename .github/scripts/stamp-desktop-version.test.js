const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { stamp, toSemver } = require("./stamp-desktop-version");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nucleus-stamp-"));
  fs.mkdirSync(path.join(root, "desktop", "src-tauri"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "desktop", "src-tauri", "tauri.conf.json"),
    JSON.stringify({ productName: "Nucleus", version: "0.0.0", identifier: "com.nucleus.desktop" }, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(root, "desktop", "src-tauri", "Cargo.toml"),
    `[package]\nname = "nucleus"\nversion = "0.0.0"\nedition = "2021"\n\n[dependencies]\ntauri = { version = "2", features = [] }\n`,
  );
  return root;
}

test("a two-part version becomes semver with a zero patch", () => {
  assert.equal(toSemver("0.10"), "0.10.0");
  assert.equal(toSemver("0.10.1"), "0.10.1");
});

test("stamping writes the same version to tauri.conf.json and Cargo.toml", () => {
  const root = fixture();
  const semver = stamp({ root, version: "0.10" });
  assert.equal(semver, "0.10.0");
  const conf = JSON.parse(fs.readFileSync(path.join(root, "desktop", "src-tauri", "tauri.conf.json"), "utf8"));
  assert.equal(conf.version, "0.10.0");
  assert.equal(conf.productName, "Nucleus");
  const cargo = fs.readFileSync(path.join(root, "desktop", "src-tauri", "Cargo.toml"), "utf8");
  assert.match(cargo, /^version = "0.10.0"$/m);
  assert.match(cargo, /tauri = \{ version = "2"/);
});

test("a bad version string is refused", () => {
  const root = fixture();
  assert.throws(() => stamp({ root, version: "1.0.0" }), /Expected a version/);
  assert.throws(() => stamp({ root, version: "v0.10" }), /Expected a version/);
});
