const fs = require("node:fs");
const path = require("node:path");

/**
 * Release notes for one v0.N tag.
 * CHANGELOG.md is the source. The workflow publishes a release only when the
 * section for that version exists and describes a real app change. A missing
 * later version is not an error. An empty section for the version being
 * published is an error.
 */
function sectionBody(changelog, tag) {
  const heading = `## ${tag}`;
  const lines = String(changelog).replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return null;
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    body.push(line);
  }
  return body.join("\n").trim();
}

function changelogSection(changelog, tag) {
  const text = sectionBody(changelog, tag);
  if (text === null) {
    throw new Error(`CHANGELOG.md has no section for ${tag}. Add "## ${tag}" before publishing.`);
  }
  if (!text) {
    throw new Error(`CHANGELOG.md section for ${tag} is empty.`);
  }
  return text;
}

function describesUnchangedApp(text) {
  return (
    /the app on the phone is the same as/i.test(text) ||
    /nothing in the app changed/i.test(text) ||
    /version number is the only change/i.test(text) ||
    /only changes publishing/i.test(text)
  );
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

/**
 * Whether this tag should become a GitHub Release.
 * Missing notes and "the app is unchanged" notes skip publishing.
 * An empty section still throws: that version was started without notes.
 */
function prepareRelease({ changelog, tag, apkName }) {
  if (!/^v0\.[1-9]\d*$/.test(tag)) {
    throw new Error(`Refusing notes for ${tag}. Releases stay at v0.1, v0.2, and so on.`);
  }
  const text = sectionBody(changelog, tag);
  if (text === null) return { publish: false, reason: "missing" };
  if (!text) {
    throw new Error(`CHANGELOG.md section for ${tag} is empty.`);
  }
  if (describesUnchangedApp(text)) return { publish: false, reason: "unchanged" };
  return { publish: true, notes: releaseNotes({ changelog, tag, apkName }) };
}

function readReleaseNotes(tag, changelogPath = path.join(process.cwd(), "CHANGELOG.md")) {
  const changelog = fs.readFileSync(changelogPath, "utf8");
  return releaseNotes({ changelog, tag });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const ifReady = args[0] === "--if-ready";
  const tag = ifReady ? args[1] : args[0];
  if (!tag) {
    console.error("Usage: node .github/scripts/release-notes.js [--if-ready] v0.1");
    process.exit(1);
  }
  try {
    if (!ifReady) {
      process.stdout.write(readReleaseNotes(tag));
    } else {
      const changelog = fs.readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf8");
      const decision = prepareRelease({ changelog, tag });
      if (decision.publish) process.stdout.write(decision.notes);
      else console.error(`Not publishing ${tag}: ${decision.reason}. The APK build continues.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { changelogSection, describesUnchangedApp, prepareRelease, releaseNotes, readReleaseNotes };
