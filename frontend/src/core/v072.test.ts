import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { homeFace } from "./homeFace.ts";
import { presentHome } from "./layouts.ts";
import { askAfterLeave } from "./lockPolicy.ts";
import { PRIVACY_NEVER, PRIVACY_PERMISSIONS, PRIVACY_STAYS } from "./privacyCopy.ts";
import { nextTimelineFilter, toggleTileSize } from "./presets.ts";

test("paper, bento, and cards stay the default unless a look was chosen", () => {
  const fresh = emptyDB();
  assert.equal(fresh.settings.theme, "paper");
  assert.equal(fresh.settings.look, "cards");
  assert.equal(fresh.settings.layout, "bento");
  assert.notEqual(fresh.settings.layout, "glass");
  const updated = normalizeDB({ version: 1, settings: { theme: "midnight", look: "current", layout: "stack" } });
  assert.equal(updated.settings.theme, "paper");
  assert.equal(updated.settings.look, "cards");
  assert.equal(updated.settings.layout, "bento");
  const chosen = normalizeDB({
    version: 1,
    settings: { theme: "dune", look: "poster", layout: "glass", appearanceChosen: true },
  });
  assert.equal(chosen.settings.theme, "dune");
  assert.equal(chosen.settings.look, "poster");
  assert.equal(chosen.settings.layout, "glass");
});

test("home cards use the earlier eyebrow, figure, and attention counts", () => {
  const db = emptyDB();
  db.settings.homeCity = { name: "Tirupati, Andhra Pradesh, India", lat: 13.63, lon: 79.42, country: "India", countryCode: "IN" };
  const weather = homeFace(db, "weather", { temp: 30, label: "Clear", feels: 35, wind: 5, aqi: 82 });
  assert.match(weather.eyebrow, /Weather/);
  assert.match(weather.eyebrow, /Tirupati/);
  assert.match(weather.figure, /30/);
  assert.match(weather.detail, /Clear/);
  assert.match(weather.detail, /35/);
  assert.equal(weather.detail.includes("Home city"), false);
  assert.equal(weather.wide, true);
  assert.ok(weather.icon);
  const attention = homeFace(db, "attention");
  assert.match(attention.eyebrow, /Attention/);
  assert.equal(attention.counts?.urgent, 0);
  assert.equal(attention.counts?.upcoming, 0);
  assert.equal(typeof attention.counts?.info, "number");
  assert.match(attention.detail, /All caught up/);
  assert.notEqual(attention.figure, "Open");
  assert.equal(attention.wide, true);
  const notes = homeFace(db, "notes");
  assert.equal(notes.wide, false);
  const modes = readFileSync(new URL("../components/HomeModes.tsx", import.meta.url), "utf8");
  assert.match(modes, /<Eyebrow/);
  assert.match(modes, /WeatherCard/);
  assert.match(modes, /urgent/);
  assert.match(modes, /monoXl|v="display"/);
  assert.doesNotMatch(modes, /FadeIn|LinearTransition/);
  assert.match(modes, /LayoutAnimation/);
  assert.match(modes, /onLongPress/);
});

test("short cards share a row and a long press resizes only that tile", () => {
  const bento = presentHome("bento", [
    { id: "attention", size: "large" },
    { id: "notes", size: "small" },
    { id: "tools", size: "small" },
  ]);
  assert.equal(bento.cardMin, 0);
  assert.equal(bento.rows[0]?.items.length, 1);
  assert.equal(bento.rows[0]?.items[0]?.id, "attention");
  assert.equal(bento.rows[1]?.items.length, 2);
  const once = toggleTileSize(emptyDB(), "notes");
  assert.equal(once.settings.tileSizes?.notes, "large");
  const twice = toggleTileSize(once, "tools");
  assert.equal(twice.settings.tileSizes?.notes, "large");
  assert.equal(twice.settings.tileSizes?.tools, "large");
  const back = toggleTileSize(twice, "notes");
  assert.equal(back.settings.tileSizes?.notes, "small");
  assert.equal(back.settings.tileSizes?.tools, "large");
});

test("a screenshot on an unlocked phone does not ask for the thumbprint", () => {
  assert.equal(askAfterLeave({ lockEnabled: true, deviceLocked: false, screenTurnedOff: false, screenshot: true }), false);
  assert.equal(askAfterLeave({ lockEnabled: true, deviceLocked: false, screenTurnedOff: true, screenshot: true }), false);
  assert.equal(askAfterLeave({ lockEnabled: true, deviceLocked: true, screenTurnedOff: false, screenshot: false }), true);
  assert.equal(askAfterLeave({ lockEnabled: true, deviceLocked: false, screenTurnedOff: true, screenshot: false }), true);
  assert.equal(askAfterLeave({ lockEnabled: false, deviceLocked: true, screenTurnedOff: true, screenshot: false }), false);
  const gate = readFileSync(new URL("../components/LockGate.tsx", import.meta.url), "utf8");
  assert.match(gate, /askAfterLeave/);
  assert.match(gate, /screenshot/);
  const kotlin = readFileSync(new URL("../../modules/nucleus-android/android/src/main/java/com/nucleus/widgets/NucleusAndroidModule.kt", import.meta.url), "utf8");
  const phone = kotlin.slice(kotlin.indexOf('Function("consumePhoneLock")'), kotlin.indexOf('Function("clearIconRestart")'));
  assert.match(phone, /isDeviceLocked/);
  assert.doesNotMatch(phone, /isKeyguardLocked/);
});

test("home boards and the timeline swipe in a circle", () => {
  assert.equal(nextTimelineFilter("notes", "next"), "all");
  assert.equal(nextTimelineFilter("all", "prev"), "notes");
  assert.equal(nextTimelineFilter("money", "next"), "vehicles");
  const timeline = readFileSync(new URL("../../app/timeline.tsx", import.meta.url), "utf8");
  assert.match(timeline, /pagingEnabled/);
  assert.match(timeline, /nextTimelineFilter/);
  const home = readFileSync(new URL("../../app/(tabs)/index.tsx", import.meta.url), "utf8");
  const modes = readFileSync(new URL("../components/HomeModes.tsx", import.meta.url), "utf8");
  const swipe = modes.slice(modes.indexOf("export function SwipeHome"), modes.indexOf("export function AdhdPanel"));
  assert.match(swipe, /nestedScrollEnabled/);
  assert.equal(/<ScrollView[\s\S]*<SwipeHome/.test(home), false);
  const money = readFileSync(new URL("../../app/money/index.tsx", import.meta.url), "utf8");
  assert.match(money, /shiftMonth|pagingEnabled/);
});

test("privacy and usage says more about what stays, each permission, and what never leaves", () => {
  assert.match(PRIVACY_STAYS, /on this phone/);
  assert.match(PRIVACY_STAYS, /vehicles/);
  assert.match(PRIVACY_STAYS, /money/);
  assert.match(PRIVACY_NEVER, /stay on this phone/);
  assert.match(PRIVACY_NEVER, /not SMS/);
  assert.match(PRIVACY_NEVER, /no account/);
  for (const name of ["Fingerprint or face", "Notifications", "Notification access", "Photos", "Location", "Screenshots"]) {
    assert.equal(PRIVACY_PERMISSIONS.some((row) => row.name === name), true, name);
  }
  const joined = [PRIVACY_STAYS, PRIVACY_NEVER, ...PRIVACY_PERMISSIONS.map((row) => `${row.name} ${row.line}`)].join(" ");
  assert.match(joined, /cannot turn the phone's location switch on or off/);
  assert.doesNotMatch(joined, /\bshe\b|overdue|\bmissed\b|behind|\blate\b|\bfail|arousal|\bpoints\b/i);
});
