const assert = require("node:assert/strict");
const test = require("node:test");
const { watchedDirectories, withGradleSpeedProperties } = require("./gradle-properties");

test("speed properties do not glue onto the inline-modules JSON", () => {
  const generated = "android.minSdkVersion=24\nexpo.inlineModules.watchedDirectories=[]";
  const next = withGradleSpeedProperties(generated);
  assert.deepEqual(watchedDirectories(next), []);
  assert.match(next, /\norg.gradle.caching=true\nandroid.lint.checkReleaseBuilds=false\n$/);
  assert.equal(next.includes("[]org.gradle.caching"), false);
});

test("a file that already ends with a newline stays one property per line", () => {
  const next = withGradleSpeedProperties("org.gradle.jvmargs=-Xmx2048m\n");
  assert.equal(
    next,
    "org.gradle.jvmargs=-Xmx2048m\norg.gradle.caching=true\nandroid.lint.checkReleaseBuilds=false\n",
  );
});
