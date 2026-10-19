#!/usr/bin/env node
/**
 * Composes the updater manifest (latest.json) from the .sig files that the
 * desktop build jobs attach to a release. Each platform entry points at the
 * installers the desktop release actually ships, so an install that checked
 * itself at v0.14 keeps checking at v0.14 even after v0.15 comes out.
 *
 * Usage: node .github/scripts/latest-json.js --tag vX.Y.Z --assets-dir release-files --version X.Y.Z
 */
const { readFileSync, writeFileSync, existsSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
};
const tag = arg("--tag");
const dir = arg("--assets-dir") ?? "release-files";

/** tauri-plugin-updater parses `version` as strict semver, so "0.15" alone must become "0.15.0". */
function toSemver(version) {
  const parts = String(version).split(".");
  if (parts.length === 1) return `${parts[0]}.0.0`;
  if (parts.length === 2) return `${parts[0]}.${parts[1]}.0`;
  return parts.slice(0, 3).join(".");
}

const version = toSemver((arg("--version") ?? tag ?? "").replace(/^v/, ""));
const repo = process.env.GITHUB_REPOSITORY;

if (!repo || !repo.includes("/")) {
  console.error("GITHUB_REPOSITORY is not set");
  process.exit(1);
}
if (!tag || !version) {
  console.error("Usage: latest-json.js --tag vX.Y.Z --assets-dir release-files --version X.Y.Z");
  process.exit(1);
}

const download = (name) => `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`;

function sigFor(suffix) {
  const name = readdirSync(dir).find((f) => f.endsWith(suffix));
  if (!name) throw new Error(`No ${suffix} in ${dir}`);
  const sigPath = join(dir, name);
  if (!existsSync(sigPath)) throw new Error(`Missing signature for ${name}`);
  const asset = name.replace(/\.sig$/, "");
  return { signature: readFileSync(sigPath, "utf8").trim(), url: download(asset) };
}

const manifest = {
  version,
  notes: "",
  pub_date: new Date().toISOString(),
  platforms: {
    "linux-x86_64": sigFor("linux-amd64.AppImage.sig"),
    "windows-x86_64": sigFor("windows-x64-setup.exe.sig"),
  },
};

const out = join(dir, "latest.json");
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${out} for ${version}`);
