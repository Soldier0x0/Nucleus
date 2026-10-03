const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { changelogSection, prepareRelease, readReleaseNotes, releaseNotes } = require("./release-notes");

const sample = `# Changelog

Intro.

## v0.2

Same app as v0.1. Notes are required.

## v0.1

- Icon picker
- Money export

Not in this build: flashcards.
`;

test("a section stops at the next release heading", () => {
  assert.equal(changelogSection(sample, "v0.2"), "Same app as v0.1. Notes are required.");
  const older = changelogSection(sample, "v0.1");
  assert.match(older, /Icon picker/);
  assert.doesNotMatch(older, /Notes are required/);
});

test("v0.1 does not match a longer tag", () => {
  const changelog = "## v0.10\n\nTen.\n\n## v0.1\n\nOne.\n";
  assert.equal(changelogSection(changelog, "v0.1"), "One.");
  assert.equal(changelogSection(changelog, "v0.10"), "Ten.");
});

test("a missing or empty section fails", () => {
  assert.throws(() => changelogSection(sample, "v0.3"), /no section for v0.3/);
  assert.throws(() => changelogSection("## v0.4\n\n\n## v0.5\n\nLater.\n", "v0.4"), /empty/);
});

test("notes keep the install lines around the changelog", () => {
  const notes = releaseNotes({ changelog: sample, tag: "v0.1" });
  assert.match(notes, /^Nucleus v0\.1 for Android\.\n/);
  assert.match(notes, /Icon picker/);
  assert.match(notes, /Download nucleus-v0\.1\.apk/);
  assert.match(notes, /Do not uninstall/);
  assert.match(notes, /This file is the APK itself\.\n$/);
});

test("a version at 1.0 is refused", () => {
  assert.throws(() => releaseNotes({ changelog: "## v1.0.0\n\nNo.\n", tag: "v1.0.0" }), /Refusing notes/);
});

test("the repository changelog records published versions and the cycle calendar", () => {
  const changelogPath = path.join(__dirname, "..", "..", "CHANGELOG.md");
  const notes = readReleaseNotes("v0.1", changelogPath);
  assert.match(notes, /home-screen icon/);
  assert.match(notes, /CSV/);
  assert.match(notes, /decoy PIN/);
  assert.match(readReleaseNotes("v0.2", changelogPath), /same as v0\.1/);
  assert.match(readReleaseNotes("v0.3", changelogPath), /same as v0\.2/);
  assert.match(readReleaseNotes("v0.4", changelogPath), /cycle calendar/);
  assert.match(readReleaseNotes("v0.4", changelogPath), /needs attention/);
  assert.match(readReleaseNotes("v0.5", changelogPath), /Soft is rounder/);
  assert.match(readReleaseNotes("v0.5", changelogPath), /Two tones/);
  const changelog = fs.readFileSync(changelogPath, "utf8");
  assert.equal(prepareRelease({ changelog, tag: "v0.4" }).publish, true);
  assert.equal(prepareRelease({ changelog, tag: "v0.5" }).publish, true);
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.3" }), { publish: false, reason: "unchanged" });
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.2" }), { publish: false, reason: "unchanged" });
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.6" }), { publish: false, reason: "missing" });
});

test("a missing later version does not block the version being published", () => {
  const changelog = "## v0.4\n\nA private cycle calendar.\n\n## v0.3\n\nThe app on the phone is the same as v0.2.\n";
  const ready = prepareRelease({ changelog, tag: "v0.4" });
  assert.equal(ready.publish, true);
  assert.match(ready.notes, /cycle calendar/);
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.5" }), { publish: false, reason: "missing" });
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.3" }), { publish: false, reason: "unchanged" });
});

test("an empty section for the version being published is still an error", () => {
  assert.throws(() => prepareRelease({ changelog: "## v0.4\n\n\n## v0.3\n\nLater.\n", tag: "v0.4" }), /empty/);
});
