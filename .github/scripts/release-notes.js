const fs = require("node:fs");
const path = require("node:path");

/**
 * Release notes for one v0.N tag.
 * CHANGELOG.md is the source. The workflow publishes a release only when the
 * section for that version has short bullet points of what was added or
 * changed. A note that only says the app is the same as the previous one is
 * not enough. A republish is publishable only when the points name the file,
 * say that nothing in the app changed, and say why the release exists.
 * A missing later version is not an error. An empty section, or a section
 * without those points, is an error.
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

function bulletPoints(text) {
  return String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^-\s+\S/.test(line));
}

function pointBody(point) {
  return point.replace(/^-\s+/, "").trim();
}

/** A point that does not say what was added or changed. */
function isSameAsPoint(point) {
  const body = pointBody(point);
  return (
    /^(the )?(phone )?app( on the phone)? is the same as\b/i.test(body) ||
    /^nothing in the app changed\b/i.test(body) ||
    /^the version number is the only change\b/i.test(body) ||
    /^this release only changes publishing\b/i.test(body) ||
    /^same app as\b/i.test(body)
  );
}

function isFilePoint(point) {
  const body = pointBody(point);
  return /^(the file is|this file is)\b/i.test(body) || /^nucleus-v0\.\d+\.apk\b/i.test(body);
}

function isWhyPoint(point) {
  const body = pointBody(point);
  return /^(this release exists|the release exists)\b/i.test(body);
}

/**
 * A republish may be published when the bullets name the apk, say that nothing
 * in the app changed, and say why the release exists. A same-as line alone
 * does not qualify.
 */
function describesHonestRepublish(points) {
  const text = points.map(pointBody).join("\n");
  return (
    /nucleus-v0\.\d+\.apk/i.test(text) &&
    (/nothing in the app changed/i.test(text) || /the app( on the phone)? is the same as/i.test(text)) &&
    (/(this|the) release exists because/i.test(text))
  );
}

function assertChangePoints(text, tag) {
  const points = bulletPoints(text);
  if (points.some((point) => !isSameAsPoint(point) && !isFilePoint(point) && !isWhyPoint(point))) return;
  if (points.length > 0 && describesHonestRepublish(points)) return;
  throw new Error(
    `CHANGELOG.md section for ${tag} needs short bullet points of what was added or changed. A note that only says the app is the same as the previous one is not enough.`,
  );
}

function releaseNotes({ changelog, tag, apkName }) {
  if (!/^v0\.[1-9]\d*$/.test(tag)) {
    throw new Error(`Refusing notes for ${tag}. Releases stay at v0.1, v0.2, and so on.`);
  }
  const changes = changelogSection(changelog, tag);
  assertChangePoints(changes, tag);
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
 * A missing section skips publishing. An empty section, a section with no
 * bullet points, or a section that only says the app is the same as the
 * previous one throws: that version was started without publishable notes.
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
  assertChangePoints(text, tag);
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

module.exports = {
  assertChangePoints,
  changelogSection,
  prepareRelease,
  releaseNotes,
  readReleaseNotes,
};
