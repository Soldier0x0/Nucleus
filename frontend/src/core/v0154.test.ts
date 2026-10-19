/**
 * v0.15.4 pins: the shared-core sweep and the hardening pass. One copy of
 * every money number, a profile switch that can always be walked back, an
 * auto-locking desktop, a pair screen that cannot be brute-forced, and a
 * workflow that publishes even a docs-only release and picks its version once.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterInbox, type InboxLine } from "./smsMoney";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const JSONread = (path: string) => JSON.parse(read(path));
const REPO = "../../../.";
const DESK = "../../../desktop";
const DESK_SYNC = "../../../desktop/src/sync";
const DESK_TAURI = "../../../desktop/src-tauri";
const APPS = "../../../frontend/app";
const SRC = "../";

// ---------- one copy of every number ----------

test("v0154 · transfers leave the money numbers alone everywhere", () => {
  for (const [file, needle] of [
    [`${SRC}core/intelligence.ts`, 3],
    [`${SRC}core/life.ts`, null],
    [`${SRC}core/moneyWords.ts`, 4],
  ] as const) {
    const src = read(file);
    const hits = src.match(/!t\.transfer/g)?.length ?? 0;
    assert.ok(hits >= (needle ?? 1), `${file} excludes transfers (found ${hits})`);
  }
  const intelligence = read(`${SRC}core/intelligence.ts`);
  assert.match(intelligence, /!t\.transfer\)\.reduce/, "totals skip transfers");
  assert.match(intelligence, /!t\.transfer\)\.forEach/, "by-cat sums skip transfers too");

  const money = read(`${SRC}core/moneyWords.ts`);
  assert.match(money, /const spent = inMonth\.filter\(\(t\) => t\.type === "expense" && !t\.transfer\)/);
  assert.match(money, /const spent = inWeek\.filter\(\(t\) => t\.type === "expense" && !t\.transfer\)/);

  const life = read(`${SRC}core/life.ts`);
  assert.match(life, /const spent = db\.txns\.filter\(\(t\) => t\.type === "expense" && !t\.transfer && monthKey\(t\.date\) === mk\)/);
});

test("v0154 · the trip cost nets refunds and skips shared transfers", () => {
  const domains = read(`${SRC}core/domains.ts`);
  assert.match(
    domains,
    /const spent = txns\.reduce\(\(s, x\) => s \+ \(x\.type === "income" \? -x\.amount : x\.transfer \? 0 : x\.amount\), 0\)/,
  );
});

test("v0154 · grouped rupee amounts read whole: Rs 1,500 is 1500, not 1", () => {
  const lines: InboxLine[] = [
    { sender: "HDFCBK", body: "Rs 1,500 debited from a/c XX1234 towards rent.", at: "1760000000000" },
    { sender: "HDFCBK", body: "Rs 1500 debited from a/c XX1234 towards fuel.", at: "1760000060000" },
    { sender: "HDFCBK", body: "INR 1,234.50 debited from a/c XX1234.", at: "1760000120000" },
  ];
  const { kept } = filterInbox(lines);
  assert.deepEqual(kept.map((k) => k.amount), [1500, 1500, 1234.5]);
  const src = read(`${SRC}core/smsMoney.ts`);
  assert.match(src, /\[0-9]\{1,3}\(\?:,\[0-9]\{2,3}\)\+\|\[0-9]\+/, "the INR group reads grouped rupees");
});

// ---------- a switch that can always be walked back ----------

test("v0154 · the switch marker is written after the document carries the profile", () => {
  const src = read(`${SRC}core/store.tsx`);
  const anchor = src.indexOf("storage.setItem(DB_KEY, await encryptString(JSON.stringify(next)))");
  assert.ok(anchor > 0, "the primary document is written first");
  const tail = src.slice(anchor, anchor + 2500);
  const marker = tail.indexOf("SWITCH_MARKER_KEY, encodeSwitchMarker(id)");
  const indexWrite = tail.indexOf("const updated = { ...index, activeId: id };");
  const clear = tail.indexOf("secureStorage.removeItem(SWITCH_MARKER_KEY)");
  assert.ok(marker > 0, "the marker is set");
  assert.ok(indexWrite > marker, "the index follows the marker");
  assert.ok(clear > indexWrite, "the marker clears after the index is tied");
  assert.match(src, /const to = parseSwitchMarker\(await secureStorage\.getItem\(SWITCH_MARKER_KEY\)\)/, "boot reads the marker");
});

test("v0154 · profiles delete by index first, and the marker helpers exist", () => {
  const src = read(`${SRC}core/profiles.ts`);
  assert.match(src, /export const SWITCH_MARKER_KEY = /);
  assert.match(src, /export function parseSwitchMarker\(/);
  assert.match(src, /export const encodeSwitchMarker = \(to: string\) => JSON\.stringify\(\{ to \}\);/);

  const store = read(`${SRC}core/store.tsx`);
  assert.match(store, /\/\/ The index first: a crash in between leaves the doc orphaned but never\n\s*\/\/ an index row that points at a missing document\./);
});

// ---------- guard rails on the phone ----------

test("v0154 · an attention card pays its subscription once, not again on mark", () => {
  const src = read(`${APPS}/(tabs)/attention.tsx`);
  assert.match(
    src,
    /if \(status === "done" && it\.subscriptionId && d\.attention\[it\.key]\?\.status !== "done"\) next = paySubscription\(next, it\.subscriptionId\)/,
  );
});

test("v0154 · the loan payoff note names an impossible payment, not a missing one", () => {
  const src = read(`${APPS}/money/plan.tsx`);
  assert.match(
    src,
    /\{isNaN\(p\.months\) \? "Set a monthly payment to see the payoff date\." : !isFinite\(p\.months\) \? "At this payment the balance never clears/s,
    "a number that cannot clear it says so, in the same ternary as the NaN hint",
  );
});

test("v0154 · bank text asks wait for the Android permission", () => {
  const src = read(`${SRC}components/BankTextSync.tsx`);
  assert.match(src, /const permission = await permissionState\(\);/);
  assert.match(src, /if \(!permission\.granted\) return;/);
  const notifySection = src.slice(src.indexOf("async function postAsks"));
  assert.ok(notifySection.indexOf("permissionState") >= 0 && notifySection.indexOf("setNotificationCategoryAsync") > notifySection.indexOf("permissionState"), "the gate sits before the first notification call");
});

test("v0154 · a travel expense is logged on today's own date", () => {
  const src = read(`${APPS}/travel/[id].tsx`);
  assert.match(src, /date: todayISO\(\),/);
});

test("v0154 · record ids come from secure random when the platform offers it", () => {
  const src = read(`${SRC}core/format.ts`);
  assert.match(src, /function randChunk\(len: number\): string \{/);
  assert.match(src, /globalThis\.crypto/);
  assert.match(src, /getRandomValues\(b\)/);
  assert.match(src, /return Math\.random\(\)\.toString\(36\)\.slice\(2, 2 \+ len\);/, "a fallback exists for runtimes without webcrypto");
});

// ---------- the Today screen tells the truth ----------

test("v0154 · the phone dot reads freshness from a shared helper", () => {
  const helper = read(`${SRC}core/syncStatus.ts`);
  assert.match(helper, /export function phoneSeenFresh\(/);
  const today = read(`${DESK}/src/screens/Today.tsx`);
  assert.match(today, /const seenFresh = phoneSeenFresh\(/);
});

test("v0154 · a fill just after midnight keeps the day it was made", () => {
  const src = read(`${DESK}/src/screens/Vehicles.tsx`);
  assert.match(src, /const at = logDraft\.date \|\| todayISO\(\);/, "a plain calendar date, not an ISO instant");
  assert.match(src, /parsing into an ISO instant lets timezones/, "the comment names the UTC+13 trap");
  assert.match(src, /Number\.isFinite\(odometer\) \? \{\} : \{ odometerEstimated: true \}/, "an empty odometer saves as an estimate");
});

// ---------- the desktop hardening pass ----------

test("v0154 · dropped files and the backup land in one pass", () => {
  const src = read(`${DESK}/src/components/DropLayer.tsx`);
  assert.match(src, /const backupIndex = files\.findIndex\(\(\{ name \}\) => \/\\\.json\$\/i\.test\(name\)\);/);
  assert.match(src, /const importBackup = async \(path: string, name: string\): Promise<boolean> => \{/);
  assert.match(src, /if \(await importBackup\(path, name\)\) importedName = name;/);
  assert.match(src, /Skipped \$\{skippedJson\} more \.json file/, "the note counts the skipped json files");
});

test("v0154 · the desktop locks itself after 15 quiet minutes", () => {
  const app = read(`${DESK}/src/App.tsx`);
  assert.match(app, /const IDLE_LOCK_MS = 15 \* 60_000;/);
  assert.match(app, /function useIdleLock\(/);
  assert.match(app, /useIdleLock\(unlocked, idleLock\)/);
  assert.match(app, /lockSecure\(\)/);
});

test("v0154 · the pair screen slows a code guesser down", () => {
  const http = read(`${DESK_SYNC}/http.ts`);
  assert.match(http, /const PAIR_FAIL_LIMIT = 5;/);
  assert.match(http, /return pairFailCount >= PAIR_FAIL_LIMIT;/);
  assert.match(http, /reply\(429, \{ ok: false, error: "pairing paused; reopen the pair screen" \}\)/);
  assert.match(http, /pairFailCount = 0;\n\s*}/, "the limit resets when the code is right");
});

test("v0154 · sync payloads are hashed and checked on both sides before writing", () => {
  assert.match(read(`${SRC}core/syncPackage.ts`), /export function verifyVaultPayload\(hash: string, payloadB64: string\): boolean \{/);
  assert.match(read(`${SRC}core/syncClient.ts`), /if \(!verifyVaultPayload\(hash, dataB64\)\) continue;/);
  assert.match(read(`${DESK_SYNC}/http.ts`), /if \(!verifyVaultPayload\(hash, dataB64\)\) continue;/);
});

test("v0154 · pin scrambling is heavier and clamped in one place, on both trees", () => {
  const phone = read(`${SRC}core/crypto.ts`);
  const desk = read("../../../desktop/src/platform/crypto.ts");
  for (const src of [phone, desk]) {
    assert.match(src, /export const PBKDF2_ITERATIONS = 600_000;/);
    assert.match(src, /export const PBKDF2_ITERATIONS_MAX = 10_000_000;/);
    assert.match(src, /const iterations = Math\.min\(env\.iterations, PBKDF2_ITERATIONS_MAX\);/);
  }
});

test("v0154 · windows opened by the app cannot reach back into the app", () => {
  for (const file of [`${DESK}/src/screens/Papers.tsx`, `${DESK}/src/components/StationFinder.tsx`]) {
    const src = read(file);
    const opens = (src.match(/window\.open/g) ?? []).length;
    assert.ok(opens > 0, `${file} opens a window`);
    assert.doesNotMatch(src, /window\.open\((?![^;]*noopener)[^;]*\)/, `${file} opens with noopener`);
  }
  const pdf = read(`${DESK}/src/components/PdfPane.tsx`);
  assert.match(pdf, /isEvalSupported: false/, "the pdf viewer runs no script");
});

test("v0154 · exports are typed, bounded, and cannot walk out of the folder", () => {
  const rust = read(`${DESK_TAURI}/src/lib.rs`);
  assert.match(rust, /const EXPORT_EXTENSIONS: \[&str; 4] = \["json", "csv", "ics", "md"\];/);
  assert.match(rust, /const MAX_EXPORT_BYTES: usize = 64 \* 1024 \* 1024;/);
  assert.match(rust, /contents\.contains\('\\0'\)/);
  assert.match(rust, /\.canonicalize\(\)/);
  assert.match(rust, /let safe_target = canonical_parent\.join\(name\);/);
});

test("v0154 · the desktop capability set holds only what the app uses", () => {
  const caps = JSONread(`${DESK_TAURI}/capabilities/default.json`) as { permissions: string[] };
  assert.ok(!caps.permissions.includes("fs:write-all"), "the blanket write is gone");
  assert.ok(!caps.permissions.includes("stronghold:allow-destroy"), "the vault cannot be destroyed from the web layer");
  for (const must of ["fs:read-all", "fs:allow-appdata-write-recursive", "opener:allow-open-path", "opener:allow-open-url"]) {
    assert.ok(caps.permissions.includes(must), `${must} is granted`);
  }
});

// ---------- the shipped look tells the truth ----------

test("v0154 · the Settings rows follow the sidebar and offer only real desktop sections", () => {
  const src = read(`${DESK}/src/screens/Settings.tsx`);
  assert.match(src, /const SECTION_ORDER: ModuleId\[\] = \["money", "vehicles", "health", "home", "travel", "papers", "notes", "media", "kanban", "tools", "rules", "dev", "builder", "lab", "net", "cycle"\];/);
  assert.match(src, /const DESKTOP_MODULES: ModuleId\[\] = \["money", "vehicles", "health", "home", "travel", "papers", "notes", "media", "kanban"\];/);
  assert.match(src, /const PHONE_ONLY: ModuleId\[\] = \["lab", "net", "cycle"\];/);
  const order = src.indexOf("SECTION_ORDER");
  assert.match(
    src,
    /MODULES\]\.sort\(\(a, b\) => SECTION_ORDER\.indexOf\(a\.id as ModuleId\) - SECTION_ORDER\.indexOf\(b\.id as ModuleId\)\)/,
    "rows are sorted by the sidebar order",
  );
});

test("v0154 · no icon rule swallows the whole page and the palette search hint keeps its keys on one line", () => {
  const css = read(`${DESK}/src/styles.css`);
  assert.ok(!css.includes(".nav .ic"), "the dead .nav .ic selector is gone");
  assert.ok(!css.includes(".nav-palette"), "the dead palette styles are gone");
  assert.match(css, /^\.ic \{/m, "icons size globally");
  const kbd = css.slice(css.indexOf(".nav-search kbd"), css.indexOf(".nav-search kbd") + 400);
  assert.match(kbd, /white-space: nowrap/, "the kbd is not dropped mid-search");
});

// ---------- the workflow picks its version once ----------

test("v0154 · every action rides a pinned commit", () => {
  const yml = read(`${REPO}/.github/workflows/android-apk.yml`);
  for (const sha of [
    "11d5960a326750d5838078e36cf38b85af677262", // checkout v4.4.0
    "49933ea5288caeca8642d1e84afbd3f7d6820020", // setup-node v4.4.0
    "cf277c60eb25467037889841efdb72551f06f6c3", // setup-java v4.9.1
    "ea165f8d65b6e75b540449e92b4886f43607fa02", // upload-artifact v4.6.2
    "748248ddd2a24f49513d8f472f81c3a07d4d50e1", // setup-gradle v4.4.4
    "6323deb102c322ba6fcbdcafc7e3dddab59af2b6", // rust-cache v2.9.2
    "b725eda525362e7cf34af9a7243cac1e3f01a7ec", // rust-toolchain stable
  ]) {
    assert.ok(yml.includes(sha), `${sha} is pinned`);
  }
  assert.match(yml, /cache-read-only: \$\{\{ github\.event_name != 'push' && github\.event_name != 'workflow_dispatch' \}\}/);
});

test("v0154 · the desktop job waits for the apk job, not for a version it picks itself", () => {
  const yml = read(`${REPO}/.github/workflows/android-apk.yml`);
  assert.match(yml, /needs: apk/);
  const apkOutputs = yml.slice(yml.indexOf("outputs:"), yml.indexOf("env:\n      EXPO_NO_TELEMETRY"));
  for (const out of ["name:", "tag:", "publish:"]) assert.ok(apkOutputs.includes(out), `the apk job publishes ${out}`);
  assert.ok(!yml.includes("${{ steps.version.outputs.name }}") || yml.indexOf("${{ steps.version.outputs.name }}") < yml.indexOf("desktop:"), "the version pick lives only in the apk job");
  assert.match(yml, /stamp-desktop-version\.js --version "\$\{\{ needs\.apk\.outputs\.name \}\}"/);
});

test("v0154 · jobs hold the narrowest permissions that still publish", () => {
  const yml = read(`${REPO}/.github/workflows/android-apk.yml`);
  assert.match(yml, /permissions:\n  contents: read\n\njobs:/, "the workflow starts read-only");
  const apk = yml.slice(yml.indexOf("  apk:"), yml.indexOf("  desktop:"));
  assert.match(apk, /permissions:\n      contents: write\n      actions: read/, "the apk job publishes and reads the run");
  const desk = yml.slice(yml.indexOf("  desktop:"));
  assert.match(desk, /permissions:\n      contents: write\n/, "the desktop job publishes alone");
});

test("v0154 · a docs-only change still ships release files when a version is due", () => {
  const yml = read(`${REPO}/.github/workflows/android-apk.yml`);
  const release = yml.slice(yml.indexOf("Target the commit that was checked out"));
  assert.ok(release.includes('if [ "${{ steps.plan.outputs.have_apk }}" = "true" ]; then'), "the release branches on the apk");
  assert.match(release, /gh release create "\$TAG" "nucleus-\$\{TAG\}\.apk"/, "with an apk, the release carries it");
  assert.match(release, /gh release create "\$TAG" --title "\$TAG" --target "\$GITHUB_SHA" --latest --notes-file release-notes\.md/, "without an apk, the release still opens");
});

test("v0154 · a missing signing secret stops the release loudly, not quietly", () => {
  const yml = read(`${REPO}/.github/workflows/android-apk.yml`);
  assert.match(yml, /if \[ -z "\$\{ANDROID_KEYSTORE_BASE64\}" \]; then/);
  assert.match(yml, /Refusing to publish a debug-signed APK\./);
  assert.match(yml, /exit 1/, "the stop is an exit, not a warning");
});
