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
  const notes = readReleaseNotes("v0.1", changelogPath);
  assert.match(notes, /home-screen icon/);
  assert.match(notes, /CSV/);
  assert.match(notes, /decoy PIN/);
  const v2 = readReleaseNotes("v0.2", changelogPath);
  assert.match(v2, /copied from this file/);
  assert.match(v2, /missing or empty/);
  assert.match(v2, /nucleus-v0\.2\.apk/);
  assert.match(v2, /greeting name/);
  const v3 = readReleaseNotes("v0.3", changelogPath);
  assert.match(v3, /nucleus-v0\.3\.apk/);
  assert.match(v3, /Nothing in the app changed/);
  assert.match(v3, /This release exists because/);
  assert.match(readReleaseNotes("v0.4", changelogPath), /cycle calendar/);
  assert.match(readReleaseNotes("v0.4", changelogPath), /needs attention/);
  assert.match(readReleaseNotes("v0.5", changelogPath), /Soft is rounder/);
  assert.match(readReleaseNotes("v0.5", changelogPath), /Two tones/);
  assert.match(readReleaseNotes("v0.5", changelogPath), /bullet points/);
  const changelog = fs.readFileSync(changelogPath, "utf8");
  for (const tag of ["v0.1", "v0.2", "v0.3", "v0.4", "v0.5", "v0.6", "v0.6.1", "v0.6.2", "v0.6.3", "v0.7", "v0.7.1", "v0.7.2", "v0.7.3", "v0.7.4", "v0.8", "v0.8.2", "v0.8.3", "v0.9", "v0.9.1", "v0.9.2", "v0.9.3"]) {
    assert.equal(prepareRelease({ changelog, tag }).publish, true, tag);
  }
  assert.match(readReleaseNotes("v0.6", changelogPath), /Empty modules stay hidden/);
  assert.match(readReleaseNotes("v0.6.1", changelogPath), /placeholder/);
  assert.match(readReleaseNotes("v0.6.2", changelogPath), /only money tiles/);
  assert.match(readReleaseNotes("v0.6.2", changelogPath), /only driving tiles/);
  assert.match(readReleaseNotes("v0.6.3", changelogPath), /thumbprint is not asked/);
  assert.match(readReleaseNotes("v0.6.3", changelogPath), /blood group/);
  assert.match(readReleaseNotes("v0.6.3", changelogPath), /Drive or OneDrive/);
  assert.match(readReleaseNotes("v0.6.3", changelogPath), /notification access/);
  assert.match(readReleaseNotes("v0.6.3", changelogPath), /paid, sent, and spent/);
  assert.match(readReleaseNotes("v0.6.3", changelogPath), /received and added/);
  assert.match(readReleaseNotes("v0.6.3", changelogPath), /Sample data can be removed/);
  assert.match(readReleaseNotes("v0.6.3", changelogPath), /does not open the app/);
  assert.match(readReleaseNotes("v0.6.3", changelogPath), /short swipe/);
  assert.match(readReleaseNotes("v0.6.3", changelogPath), /stamped into that APK/);
  assert.match(readReleaseNotes("v0.6.3", changelogPath), /Travel insurance/);
  assert.equal(prepareRelease({ changelog, tag: "v0.7" }).publish, true);
  assert.equal(prepareRelease({ changelog, tag: "v0.7.1" }).publish, true);
  assert.equal(prepareRelease({ changelog, tag: "v0.7.2" }).publish, true);
  assert.equal(prepareRelease({ changelog, tag: "v0.7.3" }).publish, true);
  assert.equal(prepareRelease({ changelog, tag: "v0.7.4" }).publish, true);
  assert.equal(prepareRelease({ changelog, tag: "v0.8" }).publish, true);
  assert.equal(prepareRelease({ changelog, tag: "v0.8.2" }).publish, true);
  assert.equal(prepareRelease({ changelog, tag: "v0.8.3" }).publish, true);
  assert.equal(prepareRelease({ changelog, tag: "v0.9" }).publish, true);
  assert.equal(prepareRelease({ changelog, tag: "v0.9.1" }).publish, true);
  assert.equal(prepareRelease({ changelog, tag: "v0.12" }).publish, true);
  assert.match(readReleaseNotes("v0.12", changelogPath), /sync now/);
  assert.match(readReleaseNotes("v0.12", changelogPath), /fuel-station finder/);
  assert.equal(prepareRelease({ changelog, tag: "v0.13" }).publish, true);
  assert.match(readReleaseNotes("v0.13", changelogPath), /change journal/);
  assert.match(readReleaseNotes("v0.13", changelogPath), /restore from History/);
  assert.equal(prepareRelease({ changelog, tag: "v0.14" }).publish, true);
  assert.match(readReleaseNotes("v0.14", changelogPath), /command palette/);
  assert.match(readReleaseNotes("v0.14", changelogPath), /in-app PDF viewer/);
  assert.equal(prepareRelease({ changelog, tag: "v0.15" }).publish, true);
  assert.match(readReleaseNotes("v0.15", changelogPath), /station finder/);
  assert.match(readReleaseNotes("v0.15", changelogPath), /Warm Paper/);
  assert.equal(prepareRelease({ changelog, tag: "v0.15.4" }).publish, true);
  assert.match(readReleaseNotes("v0.15.4", changelogPath), /counting twice/);
  assert.match(readReleaseNotes("v0.15.4", changelogPath), /auto-lock/);
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.7.5" }), { publish: false, reason: "missing" });
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.8.1" }), { publish: false, reason: "missing" });
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.8.4" }), { publish: false, reason: "missing" });
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.16" }), { publish: false, reason: "missing" });
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.11.2" }), { publish: false, reason: "missing" });
  assert.match(readReleaseNotes("v0.9.3", changelogPath), /document viewer hang/);
  assert.match(readReleaseNotes("v0.7", changelogPath), /Activa · 5\.6 L/);
  assert.match(readReleaseNotes("v0.7", changelogPath), /last board wraps to the first/);
  assert.match(readReleaseNotes("v0.7", changelogPath), /metro, train, cab or taxi, and bus/);
  assert.match(readReleaseNotes("v0.7", changelogPath), /km left before service/);
  assert.match(readReleaseNotes("v0.7", changelogPath), /Privacy and usage/);
  assert.match(readReleaseNotes("v0.7", changelogPath), /unlocked phone does not ask for the thumbprint/);
  assert.match(readReleaseNotes("v0.7", changelogPath), /smaller, shorter splash/);
  assert.match(readReleaseNotes("v0.7", changelogPath), /restricted settings/);
  assert.match(readReleaseNotes("v0.7", changelogPath), /does not turn the permission on/);
  assert.match(readReleaseNotes("v0.7.1", changelogPath), /Remove sample data/);
  assert.match(readReleaseNotes("v0.7.1", changelogPath), /Paper/);
  assert.match(readReleaseNotes("v0.7.1", changelogPath), /bento/);
  assert.match(readReleaseNotes("v0.7.1", changelogPath), /forecast/);
  assert.match(readReleaseNotes("v0.7.1", changelogPath), /Google Pay/);
  assert.match(readReleaseNotes("v0.7.1", changelogPath), /not SMS/);
  assert.match(readReleaseNotes("v0.7.1", changelogPath), /Allow restricted settings/);
  assert.match(readReleaseNotes("v0.7.1", changelogPath), /thumbprint/);
  assert.match(readReleaseNotes("v0.7.2", changelogPath), /Paper/);
  assert.match(readReleaseNotes("v0.7.2", changelogPath), /bento/);
  assert.match(readReleaseNotes("v0.7.2", changelogPath), /Weather/);
  assert.match(readReleaseNotes("v0.7.2", changelogPath), /urgent/);
  assert.match(readReleaseNotes("v0.7.2", changelogPath), /long press/);
  assert.match(readReleaseNotes("v0.7.2", changelogPath), /screenshot/);
  assert.match(readReleaseNotes("v0.7.2", changelogPath), /thumbprint/);
  assert.match(readReleaseNotes("v0.7.2", changelogPath), /wraps to the first/);
  assert.match(readReleaseNotes("v0.7.2", changelogPath), /timeline/);
  assert.match(readReleaseNotes("v0.7.2", changelogPath), /Privacy and usage/);
  assert.match(readReleaseNotes("v0.7.3", changelogPath), /Hold a tile/);
  assert.match(readReleaseNotes("v0.7.3", changelogPath), /rearrange/);
  assert.match(readReleaseNotes("v0.7.3", changelogPath), /motion stays smooth/);
  assert.match(readReleaseNotes("v0.7.4", changelogPath), /Hold a tile/);
  assert.match(readReleaseNotes("v0.7.4", changelogPath), /rearrange/);
  assert.match(readReleaseNotes("v0.7.4", changelogPath), /small or wide/);
  assert.match(readReleaseNotes("v0.7.4", changelogPath), /sit together/);
  assert.match(readReleaseNotes("v0.7.4", changelogPath), /short tap/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /Documents/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /Travel insurance/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /two-up/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /full row/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /Paper/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /bento/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /encrypted file on this phone/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /Repeating bills/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /EMI/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /Due, paid, and snooze/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /Heading/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /magnetometer/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /Travel/);
  assert.match(readReleaseNotes("v0.8", changelogPath), /Do not uninstall/);
  assert.doesNotMatch(readReleaseNotes("v0.8", changelogPath), /music player|expo-audio|streaming/i);
  assert.doesNotMatch(changelogSection(changelog, "v0.8"), /overdue|\bmissed\b|behind|\blate\b|\bfail/i);
  assert.match(readReleaseNotes("v0.8.2", changelogPath), /due date/);
  assert.match(readReleaseNotes("v0.8.2", changelogPath), /touch box/);
  assert.match(readReleaseNotes("v0.8.2", changelogPath), /Vibrate/);
  assert.match(readReleaseNotes("v0.8.2", changelogPath), /title case/);
  assert.match(readReleaseNotes("v0.8.2", changelogPath), /tiles/);
  assert.match(readReleaseNotes("v0.8.2", changelogPath), /Dead pixels/);
  assert.match(readReleaseNotes("v0.8.2", changelogPath), /cycles/);
  assert.match(readReleaseNotes("v0.8.2", changelogPath), /Blush/);
  assert.match(readReleaseNotes("v0.8.2", changelogPath), /doctor report/);
  assert.match(readReleaseNotes("v0.8.2", changelogPath), /water reminders/);
  assert.doesNotMatch(readReleaseNotes("v0.8.2", changelogPath), /music player|expo-audio|streaming|Health Connect|desktop/i);
  assert.doesNotMatch(changelogSection(changelog, "v0.8.2"), /overdue|\bmissed\b|behind|\blate\b|\bfail/i);
  assert.match(readReleaseNotes("v0.8.3", changelogPath), /Fixed the home pills/);
  assert.match(readReleaseNotes("v0.8.3", changelogPath), /scrolls into view/);
  assert.match(readReleaseNotes("v0.8.3", changelogPath), /Changed release notes/);
  assert.match(readReleaseNotes("v0.8.3", changelogPath), /Do not uninstall/);
  assert.doesNotMatch(changelogSection(changelog, "v0.8.3"), /overdue|\bmissed\b|behind|\blate\b|\bfail/i);
  assert.match(readReleaseNotes("v0.9", changelogPath), /Fixed|Added|Changed/);
  assert.match(readReleaseNotes("v0.9", changelogPath), /home pills/);
  assert.match(readReleaseNotes("v0.9", changelogPath), /Capture/);
  assert.match(readReleaseNotes("v0.9", changelogPath), /Paper stays the default/);
  assert.match(readReleaseNotes("v0.9", changelogPath), /Do not uninstall/);
  assert.doesNotMatch(changelogSection(changelog, "v0.9"), /overdue|\bmissed\b|behind|\blate\b|\bfail/i);
  assert.match(readReleaseNotes("v0.9.1", changelogPath), /PDF/);
  assert.match(readReleaseNotes("v0.9.1", changelogPath), /Vehicle and Travel/);
  assert.doesNotThrow(() =>
    assertThisReleaseOnly({
      changelog,
      tag: "v0.15.4",
      publishedTags: ["v0.1", "v0.2", "v0.3", "v0.4", "v0.5", "v0.6", "v0.6.1", "v0.6.2", "v0.6.3", "v0.7", "v0.7.1", "v0.7.2", "v0.7.3", "v0.7.4", "v0.8", "v0.8.2", "v0.8.3", "v0.9", "v0.9.1", "v0.9.2", "v0.9.3", "v0.9.4", "v0.9.5", "v0.9.6", "v0.9.7", "v0.9.8", "v0.9.9", "v0.10", "v0.11", "v0.11.1", "v0.12", "v0.13", "v0.14", "v0.15", "v0.15.1", "v0.15.2", "v0.15.3"],
    }),
  );
  assert.doesNotMatch(changelogSection(changelog, "v0.15.4"), /overdue|\bmissed\b|behind|\blate\b|\bfail/i);
});

test("v0.8.3 and later bullets start with Fixed, Added, or Changed", () => {
  const bad = "## v0.8.3\n\n- The pills are better now.\n";
  assert.throws(() => prepareRelease({ changelog: bad, tag: "v0.8.3" }), /Fixed, Added, Changed/);
  const good = "## v0.8.3\n\n- Fixed the home pills so the selected one scrolls into view.\n";
  assert.equal(prepareRelease({ changelog: good, tag: "v0.8.3" }).publish, true);
  const older = "## v0.8.2\n\n- Repeating bills ask for a due date.\n";
  assert.equal(prepareRelease({ changelog: older, tag: "v0.8.2" }).publish, true);
});

test("a pull request cannot pre-seed the following version", () => {
  const changelog = [
    "## v0.6",
    "",
    "- Later.",
    "",
    "## v0.5",
    "",
    "- Soft is rounder.",
    "",
    "## v0.4.1",
    "",
    "- A stray sub-version.",
    "",
    "## v0.4",
    "",
    "- A private cycle calendar.",
    "",
  ].join("\n");
  assert.throws(
    () => assertThisReleaseOnly({ changelog, tag: "v0.5", publishedTags: ["v0.1", "v0.2", "v0.3", "v0.4"] }),
    /v0\.4\.1, v0\.6/,
  );
  assert.throws(() => assertThisReleaseOnly({ changelog, tag: "v0.5" }), (error) => {
    assert.match(error.message, /v0\.6/);
    assert.doesNotMatch(error.message, /v0\.4\.1/);
    assert.match(error.message, /One pull request publishes one version/);
    return true;
  });
  const current = ["## v0.5", "", "- Soft is rounder.", "", "## v0.4", "", "- A private cycle calendar.", ""].join("\n");
  assert.doesNotThrow(() => assertThisReleaseOnly({ changelog: current, tag: "v0.5", publishedTags: ["v0.4"] }));
  const tens = "## v0.10\n\n- Ten.\n\n## v0.9\n\n- Nine.\n";
  assert.throws(() => assertThisReleaseOnly({ changelog: tens, tag: "v0.9" }), /v0\.10/);
  const sub = "## v0.5.2\n\n- Next.\n\n## v0.5.1\n\n- A fix.\n\n## v0.5\n\n- Looks.\n";
  assert.throws(
    () => assertThisReleaseOnly({ changelog: sub, tag: "v0.5.1", publishedTags: ["v0.5"] }),
    /v0\.5\.2/,
  );
  assert.doesNotThrow(() =>
    assertThisReleaseOnly({
      changelog: "## v0.5.1\n\n- A fix.\n\n## v0.5\n\n- Looks.\n",
      tag: "v0.5.1",
      publishedTags: ["v0.5"],
    }),
  );
});

test("a missing later version does not block the version being published", () => {
  const changelog = [
    "## v0.4",
    "",
    "- A private cycle calendar on this phone.",
    "",
    "## v0.3",
    "",
    "The app on the phone is the same as v0.2.",
    "",
  ].join("\n");
  const ready = prepareRelease({ changelog, tag: "v0.4" });
  assert.equal(ready.publish, true);
  assert.match(ready.notes, /cycle calendar/);
  assert.deepEqual(prepareRelease({ changelog, tag: "v0.5" }), { publish: false, reason: "missing" });
  assert.throws(() => prepareRelease({ changelog, tag: "v0.3" }), /bullet points/);
});

test("a note that only says the app is the same does not publish", () => {
  const prose = "## v0.3\n\nThe app on the phone is the same as v0.2. Nothing in the app changed.\n";
  assert.throws(() => prepareRelease({ changelog: prose, tag: "v0.3" }), /same as the previous one/);
  const bullets = "## v0.3\n\n- The app on the phone is the same as v0.2.\n- Nothing in the app changed.\n";
  assert.throws(() => prepareRelease({ changelog: bullets, tag: "v0.3" }), /bullet points/);
  const fileOnly = "## v0.3\n\n- The file is nucleus-v0.3.apk.\n";
  assert.throws(() => prepareRelease({ changelog: fileOnly, tag: "v0.3" }), /bullet points/);
});

test("an honest republish names the file, the lack of app change, and why", () => {
  const changelog = [
    "## v0.3",
    "",
    "- The file is nucleus-v0.3.apk.",
    "- Nothing in the app changed from v0.2.",
    "- This release exists because the Android job would not finish until a v0.3 section was in the changelog.",
    "",
  ].join("\n");
  const ready = prepareRelease({ changelog, tag: "v0.3" });
  assert.equal(ready.publish, true);
  assert.match(ready.notes, /nucleus-v0\.3\.apk/);
  assert.match(ready.notes, /Nothing in the app changed/);
  assert.match(ready.notes, /This release exists because/);
});

test("one real change point is enough even when another point says nothing changed", () => {
  const changelog = [
    "## v0.2",
    "",
    "- GitHub release notes are copied from this file.",
    "- Nothing in the app changed from v0.1.",
    "",
  ].join("\n");
  assert.equal(prepareRelease({ changelog, tag: "v0.2" }).publish, true);
});

test("an empty section for the version being published is still an error", () => {
  assert.throws(() => prepareRelease({ changelog: "## v0.4\n\n\n## v0.3\n\nLater.\n", tag: "v0.4" }), /empty/);
});
