/**
 * v0.15.1 pins: the follow-up to the Warm Paper release. The signed update
 * feed writes a full semver, the Settings sound rows pre-create every Android
 * channel, notification taps open their screen, the widgets stop cutting
 * words in half, and the shipped-side bug fixes from the v0.15 audits land:
 * module switches follow through, the palette finds kanban cards and keeps
 * local time, the key/value file is written safely, and the phone's money
 * month strip and papers gallery open the way the desktop does.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const REPO = "../../../.";
const DESK = "../../../desktop";
const APPS = "../../../frontend/app";
const SRC = "../";
const RES = "../../../frontend/modules/nucleus-android/android/src/main/res";

// ---------- update feed ----------

test("v0151 · the update manifest carries a full three-part version", () => {
  const src = read(`${REPO}/.github/scripts/latest-json.js`);
  assert.match(src, /function toSemver\(/);
  assert.match(src, /parts\.length === 2\) return `\$\{parts\[0\]\}\.\$\{parts\[1\]\}\.0`/, "0.15 becomes 0.15.0");
  assert.match(src, /const version = toSemver\(/, "the manifest version passes through toSemver");
});

// ---------- notification channels + taps ----------

test("v0151 · every Android channel exists before the Sound rows are tapped", () => {
  const src = read(`${SRC}core/notify.ts`);
  assert.match(src, /CHANNELS\.water,\s*\{\s*name: CHANNEL_NAMES\.water,/s, "water channel made up front");
  assert.match(src, /CHANNELS\.cycle,\s*\{\s*name: CHANNEL_NAMES\.cycle,/s, "cycle channel made up front");
  for (const ch of ["reminders", "water", "smsAsk", "cycle"]) {
    assert.ok(src.includes(`CHANNELS.${ch},`), `channel key ${ch} is part of the set`);
  }
});

test("v0151 · tapping a notification opens its screen", () => {
  const src = read(`${SRC}components/NotificationTaps.tsx`);
  assert.match(src, /useLastNotificationResponse/);
  for (const [key, route] of [["rule:", "/reminders"], ["water:", "/health"], ["cycle:", "/cycle"], ["sms-ask", "/money"]] as const) {
    assert.ok(src.includes(key) && src.includes(route), `a tap for ${key} routes to ${route}`);
  }
  assert.ok(read(`${APPS}/_layout.tsx`).includes("<NotificationTaps />"), "the tap router is mounted in the app");
});

// ---------- widget words ----------

test("v0151 · widget value and price lines stop at two lines and ellipsize", () => {
  const attention = read(`${RES}/layout/widget_attention.xml`);
  assert.equal((attention.match(/android:maxLines="2"/g) ?? []).length, 2, "value line + attention top");
  assert.equal((attention.match(/ellipsize="end"/g) ?? []).length, 2);
  assert.ok(attention.includes("@+id/attention_value"));

  const af = read(`${RES}/layout/widget_attention_fuel.xml`);
  assert.equal((af.match(/android:maxLines="2"/g) ?? []).length, 4, "two values, the top line and the pump average");
  assert.equal((af.match(/ellipsize="end"/g) ?? []).length, 4);
  assert.ok(af.includes("@+id/af_fuel_price"));

  const card = read(`${RES}/layout/widget_card.xml`);
  assert.equal((card.match(/android:maxLines="2"/g) ?? []).length, 2, "cycle value + shade line");
  assert.equal((card.match(/ellipsize="end"/g) ?? []).length, 2);
});

test("v0151 · one waiting thing reads wants, not want; the 4×2 card keeps the due line", () => {
  const kt = read(`${REPO}/frontend/modules/nucleus-android/android/src/main/java/com/nucleus/widgets/Widgets.kt`);
  assert.match(kt, /private fun wantYou\(/);
  assert.ok(kt.includes(`count == 1 -> "1 wants you"`), "singular grammar");
  assert.ok(!kt.includes(`optInt("count", 0)} want you`), "the hardcoded plural is gone");
  assert.match(kt, /af_attention_top, if \(days\.isBlank\(\)\)/, "the 4×2 card names title · days like the 2×2");
});

// ---------- desktop fixes ----------

test("v0151 · module switches take their section out of the sidebar and the palette", () => {
  const palette = read(`${DESK}/src/components/CommandPalette.tsx`);
  assert.match(palette, /function moduleOn\(/);
  assert.match(palette, /if \(!moduleOn\(db, id\)\) continue;/, "palette sections follow the switches");
  for (const gate of ['moduleOn(db, "vehicles")', 'moduleOn(db, "money")', 'moduleOn(db, "papers")', 'moduleOn(db, "travel")', 'moduleOn(db, "media")', 'moduleOn(db, "home")', 'moduleOn(db, "health")', 'moduleOn(db, "notes")', 'moduleOn(db, "kanban")']) {
    assert.ok(palette.includes(gate), `the ${gate} group is gated`);
  }
  assert.ok(!palette.includes("toISOString"), "the palette answers by this computer's local date");
  assert.match(palette, /visibleAttention\(db, todayISO\(\)\)/);

  const app = read(`${DESK}/src/App.tsx`);
  assert.match(app, /group === "workspace" && moduleOn\(s\.id\)/);
  assert.match(app, /group === "modules" && moduleOn\(s\.id\)/);
  assert.match(app, /if \(!moduleOn\(section\)\) setSection\("today"\)/);
});

test("v0151 · a kanban card opens on the board, highlighted", () => {
  const page = read(`${DESK}/src/screens/NotesKanban.tsx`);
  assert.match(page, /db\.kanban\.some\(\(b\) => b\.cards\.some\(\(c\) => c\.id === focusId\)\)\s*\?\s*"kanban"/, "the tab follows the card");
  assert.match(page, /<Board focusId=\{focusId\} \/>/);
  assert.match(page, /const owner = focusId \? db\.kanban\.find\(/, "the board that owns the card is selected");
  assert.match(page, /kan-card \$\{card\.id === focusId \? "kan-card on" : ""\}/);
  assert.ok(read(`${DESK}/src/styles.css`).includes(".kan-card.on"), "the highlight has a style");
});

test("v0151 · the station finder cannot search again while busy", () => {
  const src = read(`${DESK}/src/components/StationFinder.tsx`);
  assert.match(src, /const search = async \(\) => \{\s*if \(status === "busy"\) return;/s);
});

test("v0151 · the key/value file is saved as write-and-rename and keeps a corrupt copy", () => {
  const src = read(`${DESK}/src/platform/storage.ts`);
  assert.match(src, /const tmp = `\$\{KV_FILE\}\.tmp`;/);
  assert.match(src, /await rename\(tmp, KV_FILE,/);
  assert.match(src, /catch \{\s*\n\s*\/\/ A corrupt map keeps a copy/s, "a corrupt map is archived, not silently dropped");
  assert.match(src, /`\$\{KV_FILE\}\.corrupt`/);

  const doc = read(`${DESK}/src/platform/document.ts`);
  assert.match(doc, /discarded-\$\{stamp\}/, "an unreadable envelope is kept as a backup before the drop");
});

test("v0151 · Start fresh tells the truth about the broken copy", () => {
  const app = read(`${DESK}/src/App.tsx`);
  assert.doesNotMatch(app, /left untouched on disk/);
  assert.match(app, /kept on disk as a backup/);
});

// ---------- phone fixes ----------

test("v0151 · the money month strip browses later months", () => {
  const src = read(`${APPS}/money/index.tsx`);
  assert.match(src, /function shiftMonth\(month: string, dir: -1 \| 1\): string \{/);
  assert.doesNotMatch(src, /if \(next > monthKey\(todayISO\(\)\)\) return month;/, "no strand at the current month");
});

test("v0151 · the papers gallery photo view is a closable overlay", () => {
  const src = read(`${SRC}components/PhotoGallery.tsx`);
  assert.match(src, /<Modal transparent/);
  assert.match(src, /onRequestClose=\{\(\) => setOpen\(null\)\}/);
  assert.match(src, /rgba\(0, ?0, ?0, ?0\.92\)/);
});
