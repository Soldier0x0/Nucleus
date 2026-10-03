const assert = require("node:assert/strict");
const test = require("node:test");
const { artifactName, isDocsOnly, planApkRun } = require("./apk-plan");

test("docs, changelog, and README do not need an APK", () => {
  assert.equal(isDocsOnly(["README.md", "CHANGELOG.md", "docs/guide.md", "frontend/NOTES.md"]), true);
  assert.equal(isDocsOnly(["README.md", "frontend/src/core/cycle.ts"]), false);
  assert.equal(isDocsOnly([".github/workflows/android-apk.yml"]), false);
  assert.equal(isDocsOnly([]), false);
});

test("a docs-only pull request skips the compile", () => {
  const plan = planApkRun({ event: "pull_request", files: ["CHANGELOG.md", "README.md"] });
  assert.deepEqual(plan, { build: false, reuse: false, haveApk: false, reason: "docs" });
});

test("a code change compiles", () => {
  const plan = planApkRun({ event: "pull_request", files: ["frontend/src/core/cycle.ts", "CHANGELOG.md"] });
  assert.equal(plan.build, true);
  assert.equal(plan.reuse, false);
});

test("a green APK for this tree is reused instead of compiled again", () => {
  for (const event of ["pull_request", "push", "workflow_dispatch"]) {
    const plan = planApkRun({ event, files: ["frontend/src/core/cycle.ts"], artifactReady: true });
    assert.equal(plan.build, false, event);
    assert.equal(plan.reuse, true, event);
    assert.equal(plan.haveApk, true, event);
  }
});

test("a manual run compiles when no APK exists yet", () => {
  const plan = planApkRun({ event: "workflow_dispatch", files: ["README.md"], artifactReady: false });
  assert.equal(plan.reason, "compile");
});

test("the artifact name is the git tree", () => {
  const tree = "0123456789abcdef0123456789abcdef01234567";
  assert.equal(artifactName(tree), `nucleus-apk-${tree}`);
  assert.throws(() => artifactName("main"), /Refusing artifact name/);
});
