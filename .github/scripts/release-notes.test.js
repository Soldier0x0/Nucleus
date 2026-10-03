const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { assertThisReleaseOnly, changelogSection, prepareRelease, readReleaseNotes, releaseNotes } = require("./release-notes");

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
  const changelog = fs.readFileSync(changelogPath, "utf8");
  const notes = readReleaseNotes("v0.1", changelogPath);
  assert.match(notes, /home-screen icon/);
  assert.match(notes, /CSV/);
  assert.match(notes, /decoy PIN/);
  assert.match(changelog, /same as v0\.1/);
  assert.match(changelog, /same as v0\.2/);
  assert.match(readReleaseNotes("v0.4", changelogPath), /cycle calendar/);
  assert.match(readReleaseNotes("v0.4", changelogPath), /needs attention/);
  assert.equal(prepareRelease({ changelog, tag: "v0.4" }).publish, true);
  assert.equal(prepareRelease({ changelog, tag: "v0.2" }).publish, true);
  assert.throws(() => prepareRelease({ changelog, tag: "v0.3" }), /bullet points/);
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.5" }), { publish: false, reason: "missing" });
  assert.doesNotThrow(() =>
    assertThisReleaseOnly({ changelog, tag: "v0.5", publishedTags: ["v0.1", "v0.2", "v0.3", "v0.4"] }),
  );
});

test("a missing later version does not block the version being published", () => {
  const changelog = "## v0.4\n\n- A private cycle calendar on this phone.\n\n## v0.3\n\nThe app on the phone is the same as v0.2.\n";
  const ready = prepareRelease({ changelog, tag: "v0.4" });
  assert.equal(ready.publish, true);
  assert.match(ready.notes, /cycle calendar/);
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.5" }), { publish: false, reason: "missing" });
  assert.throws(() => prepareRelease({ changelog, tag: "v0.3" }), /bullet points/);
});

test("a pull request cannot pre-seed the following version", () => {
  const changelog = "## v0.6\n\n- Later.\n\n## v0.5\n\n- This version.\n\n## v0.4\n\n- Already shipped.\n";
  assert.throws(
    () => assertThisReleaseOnly({ changelog, tag: "v0.5", publishedTags: ["v0.4"] }),
    /v0\.6/,
  );
  assert.doesNotThrow(() => assertThisReleaseOnly({ changelog: "## v0.4\n\n- Shipped.\n", tag: "v0.5" }));
});

test("an empty section for the version being published is still an error", () => {
  assert.throws(() => prepareRelease({ changelog: "## v0.4\n\n\n## v0.3\n\nLater.\n", tag: "v0.4" }), /empty/);
});
