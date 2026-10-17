import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { menuSections } from "./menu.ts";
import { decodePill, STALE_AFTER_MS } from "./syncPill.ts";
import { backoffMs, RETRY_MAX_MS, RETRY_MS } from "./autoSync.ts";
import { lastSeenLine } from "./syncStatus.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("v0.12: an old module order shuffles to the design order once; later reorders stick", () => {
  const raw = JSON.parse(JSON.stringify(emptyDB())) as Record<string, any>;
  delete raw.settings.menuRegrouped;
  raw.settings.modules = [
    { id: "vehicles", enabled: true, hidden: false },
    { id: "money", enabled: true, hidden: false },
  ];
  const once = normalizeDB(raw);
  assert.deepEqual(once.settings.modules.slice(0, 3).map((m) => m.id), ["money", "vehicles", "home"]);
  assert.equal(once.settings.menuRegrouped, true);
  const arranged = { ...once, settings: { ...once.settings, modules: [...once.settings.modules].reverse() } };
  assert.equal(normalizeDB(arranged).settings.modules[0]?.id, once.settings.modules[once.settings.modules.length - 1]?.id);
});

test("v0.12: the drawer reads Money, Vehicle, Home, Life, Health, then the rest", () => {
  const ids = menuSections(emptyDB()).map((s) => s.id);
  assert.deepEqual(ids.slice(0, 5), ["money", "vehicle", "home", "life", "health"]);
  assert.ok(ids.includes("docnotes") && ids.includes("tools"));
  assert.equal(ids.includes("documents") || ids.includes("notes") || ids.includes("devlab") || ids.includes("reminders"), false);
});

test("v0.12: the pill hides unpaired, is green inside a day, stale beyond it", () => {
  const now = Date.parse("2026-10-16T12:00:00.000Z");
  assert.equal(decodePill({ devices: [], lastSyncAt: undefined, lastFailedAt: null, now }).label, "Pair a desktop");
  const fresh = decodePill({ devices: [], lastSyncAt: undefined, lastFailedAt: null, now });
  assert.equal(fresh.state, "off-network");
  const device = { id: "d", name: "Studio", key: "k", lastSyncAt: new Date(now - 3_600_000).toISOString() };
  assert.equal(decodePill({ devices: [device], lastSyncAt: device.lastSyncAt, lastFailedAt: null, now }).state, "synced");
  const old = { ...device, lastSyncAt: new Date(now - STALE_AFTER_MS - 1).toISOString() };
  assert.equal(decodePill({ devices: [old], lastSyncAt: old.lastSyncAt, lastFailedAt: null, now }).state, "stale");
});

test("v0.12: silent failures back off to the cap and the pill surface exists", () => {
  assert.equal(backoffMs(0), RETRY_MS);
  assert.equal(backoffMs(2), RETRY_MS * 2);
  assert.equal(backoffMs(3), RETRY_MAX_MS);
  const today = read("../../app/(tabs)/index.tsx");
  assert.match(today, /<SyncPill \/>/);
  const pill = read("../components/SyncPill.tsx");
  assert.match(pill, /today-sync-pill/);
  assert.match(pill, /syncWithDesktop\(db, device, \{ silent: true \}\)/);
  assert.doesNotMatch(pill, /useToast|components\/Toast/);
  const auto = read("../components/AutoSync.tsx");
  assert.match(auto, /subscribeNetworkWake/);
  assert.equal(lastSeenLine(undefined, new Date().toISOString()), "Phone not paired yet");
});

test("v0.12: numerals line up — the figure variants carry tabular-nums, texts do not", () => {
  const ui = read("../components/ui.tsx");
  for (const v of ["display", "title", "mono", "monoLg", "monoXl"]) {
    const at = ui.indexOf(`case "${v}"`);
    assert.ok(at > 0, v);
    const chunk = ui.slice(at, ui.indexOf(`case "`, at + 1));
    assert.match(chunk, /tabular-nums/, v);
  }
  const at = ui.indexOf('case "body"');
  assert.doesNotMatch(ui.slice(at, ui.indexOf(`case "`, at + 1)), /tabular-nums/);
});

test("v0.12: two new home-screen widgets — Attention 2×2 and Attention+Fuel 4×2, both native RemoteViews", () => {
  const kt = read("../../modules/nucleus-android/android/src/main/java/com/nucleus/widgets/Widgets.kt");
  const manifest = read("../../modules/nucleus-android/android/src/main/AndroidManifest.xml");
  for (const [cls, kind, xml] of [["AttentionWidget", "attention", "widget_attention_info"], ["AttentionFuelWidget", "attention_fuel", "widget_attention_fuel_info"]] as const) {
    assert.match(kt, new RegExp(`class ${cls} : NucleusWidget\\(\\)[\\s\\S]*?override val kind = "${kind}"`));
    assert.match(manifest, new RegExp(`android:name="com\\.nucleus\\.widgets\\.${cls}"[\\s\\S]*?@xml/${xml}`));
  }
  assert.match(kt, /attentionCard|attention_card|root_attention/);
  assert.match(kt, /aff_attention|af_attention|af_fuel/);
  const open = read("../../app/open.tsx");
  assert.match(open, /"\/attention"/);
  const widgets = read("../core/widgets.ts");
  assert.match(widgets, /attentionWidgetCard|visibleAttention/);
  assert.match(widgets, /db\.settings\.privacyMode/);
});
