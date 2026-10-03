const fs = require("node:fs");

/**
 * Gradle settings for a faster release APK.
 * The prebuild file ends on expo.inlineModules.watchedDirectories=[] with no
 * trailing newline. Appending without a break glues that JSON and Expo's
 * autolinking node process exits.
 */

const SPEED_PROPERTIES = ["org.gradle.caching=true", "org.gradle.parallel=true"];

function withGradleSpeedProperties(contents) {
  const base = contents.endsWith("\n") || contents.length === 0 ? contents : `${contents}\n`;
  return `${base}${SPEED_PROPERTIES.join("\n")}\n`;
}

function watchedDirectories(contents) {
  const line = contents
    .split("\n")
    .find((entry) => entry.startsWith("expo.inlineModules.watchedDirectories="));
  if (!line) return null;
  return JSON.parse(line.slice("expo.inlineModules.watchedDirectories=".length));
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node .github/scripts/gradle-properties.js <gradle.properties>");
    process.exit(1);
  }
  const next = withGradleSpeedProperties(fs.readFileSync(file, "utf8"));
  watchedDirectories(next);
  fs.writeFileSync(file, next);
}

if (require.main === module) main();

module.exports = { withGradleSpeedProperties, watchedDirectories };
