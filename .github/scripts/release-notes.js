const fs = require("node:fs");
const path = require("node:path");

/**
 * Release notes for one v0.N tag.
 * CHANGELOG.md is the source. A missing or empty section is an error,
 * so a build cannot publish a release that only says how to install.
 */
function changelogSection(changelog, tag) {
  const heading = `## ${tag}`;
  const lines = String(changelog).replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) {
    throw new Error(`CHANGELOG.md has no section for ${tag}. Add "## ${tag}" before publishing.`);
  }
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    body.push(line);
  }
  const text = body.join("\n").trim();
  if (!text) {
    throw new Error(`CHANGELOG.md section for ${tag} is empty.`);
  }
  return text;
}

function releaseNotes({ changelog, tag, apkName }) {
  if (!/^v0\.[1-9]\d*$/.test(tag)) {
    throw new Error(`Refusing notes for ${tag}. Releases stay at v0.1, v0.2, and so on.`);
  }
  const changes = changelogSection(changelog, tag);
  const file = apkName || `nucleus-${tag}.apk`;
  return [
    `Nucleus ${tag} for Android.`,
    "",
    changes,
    "",
    `Download ${file} and install it over the current app. Do not uninstall. Uninstalling wipes the data on the phone.`,
    "",
    "This file is the APK itself.",
    "",
  ].join("\n");
}

function readReleaseNotes(tag, changelogPath = path.join(process.cwd(), "CHANGELOG.md")) {
  const changelog = fs.readFileSync(changelogPath, "utf8");
  return releaseNotes({ changelog, tag });
}

if (require.main === module) {
  const tag = process.argv[2];
  if (!tag) {
    console.error("Usage: node .github/scripts/release-notes.js v0.1");
    process.exit(1);
  }
  try {
    process.stdout.write(readReleaseNotes(tag));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { changelogSection, releaseNotes, readReleaseNotes };
