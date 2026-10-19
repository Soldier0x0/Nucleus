#!/usr/bin/env node
// Stamps the desktop app version from the changelog version being released.
// Usage: node stamp-desktop-version.js --version 0.10 [--root /path/to/repo]
const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const args = { version: "", root: path.resolve(__dirname, "..", "..") };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--version") args.version = argv[i + 1] || "";
    if (argv[i] === "--root") args.root = argv[i + 1] || args.root;
  }
  return args;
}

function toSemver(version) {
  const parts = String(version).split(".");
  if (parts.length === 1) return `${parts[0]}.0.0`;
  if (parts.length === 2) return `${parts[0]}.${parts[1]}.0`;
  return parts.slice(0, 3).join(".");
}

function stamp({ root, version }) {
  if (!/^0\.\d+(\.\d+)?$/.test(version)) {
    throw new Error(`Expected a version like 0.10 or 0.10.1 under 1.0, got "${version}"`);
  }
  const semver = toSemver(version);
  const confPath = path.join(root, "desktop", "src-tauri", "tauri.conf.json");
  const conf = JSON.parse(fs.readFileSync(confPath, "utf8"));
  conf.version = semver;
  fs.writeFileSync(confPath, `${JSON.stringify(conf, null, 2)}\n`);
  const cargoPath = path.join(root, "desktop", "src-tauri", "Cargo.toml");
  const cargo = fs.readFileSync(cargoPath, "utf8");
  const stamped = cargo.replace(/^version = "[^"]*"/m, `version = "${semver}"`);
  if (stamped === cargo && !cargo.includes(`version = "${semver}"`)) {
    throw new Error("Could not find the package version line in desktop/src-tauri/Cargo.toml");
  }
  fs.writeFileSync(cargoPath, stamped);
  const appPath = path.join(root, "desktop", "src", "App.tsx");
  const app = fs.readFileSync(appPath, "utf8");
  // The sidebar chip and the About row read this export; without the stamp the
  // app announced the version of the era its constant was last touched.
  const appStamped = app.replace(
    /export const APP_VERSION = "[^"\n]*";/,
    `export const APP_VERSION = "${semver}";`,
  );
  if (!appStamped.includes(`APP_VERSION = "${semver}"`)) {
    throw new Error("Could not find the APP_VERSION export in desktop/src/App.tsx");
  }
  fs.writeFileSync(appPath, appStamped);
  return semver;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const semver = stamp(args);
  console.log(semver);
}

module.exports = { parseArgs, stamp, toSemver };
