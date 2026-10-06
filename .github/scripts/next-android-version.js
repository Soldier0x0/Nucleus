const fs = require("node:fs");

/**
 * Next Nucleus release name. Tags look like v0.1, v0.2, or a patch such as v0.6.1.
 * The result always stays below 1.
 * With no changelog, the next name is the next minor: v0.6 becomes 0.7.
 * One unpublished changelog heading can select that next minor, or a later
 * patch of the highest published minor. A skipped patch is allowed when it
 * is the only unpublished heading. Two unpublished headings stay on the
 * next minor so a pre-seeded later version is refused.
 */
const VERSION_NAME = /^0\.[1-9]\d*(?:\.\d+)?$/;

function highestPublishedMinor(tags) {
  let highest = 0;
  for (const tag of tags) {
    const match = /^v0\.(\d+)$/.exec(String(tag).trim());
    if (!match) continue;
    const minor = Number(match[1]);
    if (minor > highest) highest = minor;
  }
  return highest;
}

function nextMinor(tags) {
  return `0.${highestPublishedMinor(tags) + 1}`;
}

function documentedHeadings(changelog) {
  const found = [];
  for (const line of String(changelog).replace(/\r\n/g, "\n").split("\n")) {
    const match = /^## (v0\.\d+(?:\.\d+)?)$/.exec(line.trim());
    if (match) found.push(match[1]);
  }
  return found;
}

function unpublished(changelog, tags) {
  const published = new Set(tags.map((tag) => String(tag).trim()));
  const seen = new Set();
  const extra = [];
  for (const heading of documentedHeadings(changelog)) {
    if (published.has(heading) || seen.has(heading)) continue;
    seen.add(heading);
    extra.push(heading);
  }
  return extra;
}

function patchNumber(tag, minor) {
  const match = new RegExp(`^v0\\.${minor}(?:\\.(\\d+))?$`).exec(String(tag).trim());
  if (!match) return null;
  return match[1] === undefined ? 0 : Number(match[1]);
}

function highestPatch(tags, minor) {
  let patch = -1;
  for (const tag of tags) {
    const value = patchNumber(tag, minor);
    if (value !== null && value > patch) patch = value;
  }
  return patch;
}

function nextAndroidVersion(tags, changelog) {
  const minor = nextMinor(tags);
  if (changelog == null || changelog === "") return minor;
  const extra = unpublished(changelog, tags);
  if (extra.length !== 1) return minor;
  const only = extra[0];
  if (only === `v${minor}`) return minor;
  const minorNumber = highestPublishedMinor(tags);
  const chosen = patchNumber(only, minorNumber);
  const published = highestPatch(tags, minorNumber);
  if (chosen !== null && chosen > published) return only.slice(1);
  return minor;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let changelog = null;
  const tags = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--changelog") {
      const file = args[i + 1];
      if (!file) {
        console.error("Missing changelog path.");
        process.exit(1);
      }
      changelog = fs.readFileSync(file, "utf8");
      i += 1;
      continue;
    }
    tags.push(...String(args[i]).split(/\s+/).filter(Boolean));
  }
  const name = nextAndroidVersion(tags, changelog);
  if (!VERSION_NAME.test(name)) {
    console.error(`Refusing version ${name}. Releases stay at 0.1, 0.2, and so on.`);
    process.exit(1);
  }
  process.stdout.write(`${name}\n`);
}

module.exports = { nextAndroidVersion };
