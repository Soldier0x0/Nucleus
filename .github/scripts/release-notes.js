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
 * One pull request publishes one version. A changelog section for any other
 * unpublished version is an error, so the next release cannot be pre-seeded.
 * From v0.8.3 on, each bullet starts with Fixed, Added, Changed, I fixed,
 * I added, or I changed.
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

function developerVoice(point) {
  return /^(Fixed|Added|Changed|I fixed|I added|I changed)\b/.test(pointBody(point));
}

function assertDeveloperVoice(points, tag) {
  if (!versionRank(tag) || compareVersions(tag, "v0.8.3") < 0 || describesHonestRepublish(points)) return;
  const real = points.filter((point) => !isSameAsPoint(point) && !isFilePoint(point) && !isWhyPoint(point));
  if (real.length === 0 || real.every(developerVoice)) return;
  throw new Error(
    `CHANGELOG.md section for ${tag} needs bullets that start with Fixed, Added, Changed, I fixed, I added, or I changed.`,
  );
}

function assertChangePoints(text, tag) {
  const points = bulletPoints(text);
  if (points.some((point) => !isSameAsPoint(point) && !isFilePoint(point) && !isWhyPoint(point))) {
    assertDeveloperVoice(points, tag);
    return;
  }
  if (points.length > 0 && describesHonestRepublish(points)) return;
  throw new Error(
    `CHANGELOG.md section for ${tag} needs short bullet points of what was added or changed. A note that only says the app is the same as the previous one is not enough.`,
  );
}

function releaseNotes({ changelog, tag, apkName }) {
  if (!/^v0\.[1-9]\d*(?:\.\d+)?$/.test(tag)) {
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

function documentedVersions(changelog) {
  const versions = [];
  for (const line of String(changelog).replace(/\r\n/g, "\n").split("\n")) {
    const match = /^## (v0\.\d+(?:\.\d+)?)$/.exec(line.trim());
    if (match) versions.push(match[1]);
  }
  return versions;
}

function versionRank(tag) {
  const match = /^v0\.(\d+)(?:\.(\d+))?$/.exec(tag);
  if (!match) return null;
  return {
    minor: Number(match[1]),
    patch: match[2] === undefined ? null : Number(match[2]),
  };
}

function compareVersions(leftTag, rightTag) {
  const left = versionRank(leftTag);
  const right = versionRank(rightTag);
  if (!left || !right) {
    throw new Error(
      `Refusing notes for ${left ? rightTag : leftTag}. Releases stay at v0.1, v0.2, and so on.`,
    );
  }
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch === right.patch) return 0;
  if (left.patch === null) return -1;
  if (right.patch === null) return 1;
  return left.patch - right.patch;
}

/**
 * The changelog may record versions that already shipped, plus the one version
 * this pull request publishes. A later section, or any other unpublished
 * version, is a pre-seeded release and is refused. With no published tags yet,
 * only a section newer than this version is refused.
 */
function assertThisReleaseOnly({ changelog, tag, publishedTags = [] }) {
  if (!versionRank(tag)) {
    throw new Error(`Refusing notes for ${tag}. Releases stay at v0.1, v0.2, and so on.`);
  }
  const allowed = new Set(publishedTags.filter((item) => versionRank(item)));
  const knowPublished = allowed.size > 0;
  allowed.add(tag);
  const seen = new Set();
  const outside = [];
  for (const version of documentedVersions(changelog)) {
    const extra = knowPublished ? !allowed.has(version) : compareVersions(version, tag) > 0;
    if (!extra || seen.has(version)) continue;
    seen.add(version);
    outside.push(version);
  }
  outside.sort(compareVersions);
  if (outside.length === 0) return;
  throw new Error(
    `CHANGELOG.md documents ${outside.join(", ")} as well as ${tag}. One pull request publishes one version. Remove the other section. Do not pre-seed the next release.`,
  );
}

/**
 * Whether this tag should become a GitHub Release.
 * A missing section skips publishing. An empty section, a section with no
 * bullet points, or a section that only says the app is the same as the
 * previous one throws: that version was started without publishable notes.
 */
function prepareRelease({ changelog, tag, apkName }) {
  if (!/^v0\.[1-9]\d*(?:\.\d+)?$/.test(tag)) {
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
  const onlyThis = args[0] === "--only-this-version";
  const ifReady = args[0] === "--if-ready";
  const tag = onlyThis || ifReady ? args[1] : args[0];
  if (!tag) {
    console.error(
      "Usage: node .github/scripts/release-notes.js [--if-ready | --only-this-version] v0.5 [published tags...]",
    );
    process.exit(1);
  }
  try {
    const changelog = fs.readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf8");
    if (onlyThis) {
      assertThisReleaseOnly({ changelog, tag, publishedTags: args.slice(2) });
    } else if (ifReady) {
      assertThisReleaseOnly({ changelog, tag });
      const decision = prepareRelease({ changelog, tag });
      if (decision.publish) process.stdout.write(decision.notes);
      else console.error(`Not publishing ${tag}: ${decision.reason}. The APK build continues.`);
    } else {
      process.stdout.write(releaseNotes({ changelog, tag }));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  assertChangePoints,
  assertThisReleaseOnly,
  changelogSection,
  compareVersions,
  prepareRelease,
  releaseNotes,
  readReleaseNotes,
};
