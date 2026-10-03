const fs = require("node:fs");

/**
 * Whether this Android run should compile.
 * A docs-only change does not build an APK. A tree that already has a green
 * APK is published from that file instead of being compiled again.
 */

function normalizeFile(file) {
  return String(file).trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function isDocsPath(file) {
  const name = normalizeFile(file);
  return name === "CHANGELOG.md" || name === "README.md" || name.startsWith("docs/") || name.endsWith(".md");
}

function isDocsOnly(files) {
  const list = files.map(normalizeFile).filter(Boolean);
  return list.length > 0 && list.every(isDocsPath);
}

function artifactName(tree) {
  if (!/^[0-9a-f]{40}$/i.test(String(tree))) {
    throw new Error(`Refusing artifact name for ${tree}.`);
  }
  return `nucleus-apk-${String(tree).toLowerCase()}`;
}

function planApkRun({ event, files = [], artifactReady = false }) {
  if (artifactReady) return { build: false, reuse: true, haveApk: true, reason: "reuse" };
  if (event !== "workflow_dispatch" && isDocsOnly(files)) {
    return { build: false, reuse: false, haveApk: false, reason: "docs" };
  }
  return { build: true, reuse: false, haveApk: true, reason: "compile" };
}

function readFiles(filePath) {
  if (!filePath) return [];
  return fs.readFileSync(filePath, "utf8").split("\n");
}

function writePlan(plan) {
  const lines = [
    `build=${plan.build}`,
    `reuse=${plan.reuse}`,
    `have_apk=${plan.haveApk}`,
    `reason=${plan.reason}`,
  ];
  const output = process.env.GITHUB_OUTPUT;
  if (output) fs.appendFileSync(output, `${lines.join("\n")}\n`);
  else process.stdout.write(`${lines.join("\n")}\n`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "name") {
    process.stdout.write(`${artifactName(args[1])}\n`);
  } else if (args[0] === "plan") {
    const eventFlag = args.indexOf("--event");
    const filesFlag = args.indexOf("--files");
    const readyFlag = args.indexOf("--artifact-ready");
    const event = eventFlag >= 0 ? args[eventFlag + 1] : "";
    const files = readFiles(filesFlag >= 0 ? args[filesFlag + 1] : "");
    const artifactReady = readyFlag >= 0 && args[readyFlag + 1] === "true";
    writePlan(planApkRun({ event, files, artifactReady }));
  } else {
    console.error("Usage: node .github/scripts/apk-plan.js name <tree> | plan --event <name> --files <path> --artifact-ready true|false");
    process.exit(1);
  }
}

module.exports = { artifactName, isDocsOnly, planApkRun };
