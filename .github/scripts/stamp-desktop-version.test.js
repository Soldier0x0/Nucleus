const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { stamp, toSemver } = require("./stamp-desktop-version");

function fixture({ appMode = "version" } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nucleus-stamp-"));
  fs.mkdirSync(path.join(root, "desktop", "src-tauri"), { recursive: true });
  fs.mkdirSync(path.join(root, "desktop", "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "desktop", "src-tauri", "tauri.conf.json"),
    JSON.stringify({ productName: "Nucleus", version: "0.0.0", identifier: "com.nucleus.desktop" }, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(root, "desktop", "src-tauri", "Cargo.toml"),
    `[package]\nname = "nucleus"\nversion = "0.0.0"\nedition = "2021"\n\n[dependencies]\ntauri = { version = "2", features = [] }\n`,
  );
  if (appMode === "version") {
    fs.writeFileSync(
      path.join(root, "desktop", "src", "App.tsx"),
      `import { useState } from "react";\n\nexport const APP_VERSION = "0.15";\n\nconst nav = () => {};\n`,
    );
  } else if (appMode === "bare") {
    fs.writeFileSync(path.join(root, "desktop", "src", "App.tsx"), `import { useState } from "react";\n\nconst nav = () => {};\n`);
  }
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

test("the stamp reaches the APP_VERSION export in App.tsx", () => {
  const root = fixture();
  stamp({ root, version: "0.10.1" });
  const app = fs.readFileSync(path.join(root, "desktop", "src", "App.tsx"), "utf8");
  assert.match(app, /export const APP_VERSION = "0\.10\.1";/);
});

test("a missing App.tsx export is refused, not skipped", () => {
  const root = fixture({ appMode: "bare" });
  assert.throws(() => stamp({ root, version: "0.10.1" }), /Could not find the APP_VERSION export/);
});

test("a bad version string is refused", () => {
  const root = fixture();
  assert.throws(() => stamp({ root, version: "1.0.0" }), /Expected a version/);
  assert.throws(() => stamp({ root, version: "v0.10" }), /Expected a version/);
});
