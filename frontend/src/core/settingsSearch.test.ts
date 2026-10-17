import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { searchSettings, SETTINGS_INDEX, SETTINGS_SEARCH_LIMIT, type SettingsGroup } from "./settingsSearch.ts";

const GROUPS: SettingsGroup[] = ["Display", "Security and privacy", "Notifications", "Modules", "Data and backup", "About"];

test('"finger" lands on App lock in Security and privacy, and the group is shown', () => {
  const hits = searchSettings("finger");
  assert.ok(hits.length > 0);
  assert.equal(hits[0].title, "App lock");
  assert.equal(hits[0].group, "Security and privacy");
  assert.equal(hits[0].route, "/settings/security");
  assert.equal(hits[0].anchor, "security");
});

test('"sms" is one tap from Bank texts under Notifications', () => {
  const hits = searchSettings("sms");
  assert.ok(hits.length > 0);
  assert.equal(hits[0].title, "Bank texts");
  assert.equal(hits[0].group, "Notifications");
  assert.equal(hits[0].route, "/settings/notifications");
  assert.equal(hits[0].anchor, "bank-texts");
});

test("garbage returns nothing, not a dump of every row", () => {
  assert.deepEqual(searchSettings("zzzz"), []);
  assert.deepEqual(searchSettings("!!!"), []);
  assert.deepEqual(searchSettings("   "), []);
  assert.deepEqual(searchSettings(""), []);
});

test("a single letter would match everything, so it matches nothing", () => {
  assert.deepEqual(searchSettings("a"), []);
  assert.deepEqual(searchSettings("l"), []);
  assert.deepEqual(searchSettings("a lock"), []);
});

test("every result names the group it lives in, and only real groups", () => {
  for (const hit of searchSettings("lock")) {
    assert.ok(GROUPS.includes(hit.group), `${hit.id} has group ${hit.group}`);
    assert.equal(hit.group.trim().length > 0, true);
  }
});

test("close matches only: few results even for a broad word", () => {
  const hits = searchSettings("lock");
  assert.equal(hits.length, SETTINGS_SEARCH_LIMIT);
  assert.ok(hits.length <= 8);
  assert.equal(searchSettings("lock", 3).length, 3);
  assert.equal(searchSettings("lock", 0).length, 0);
});

test("every index row points at a hub group, a route, and a unique id", () => {
  const ids = new Set<string>();
  for (const entry of SETTINGS_INDEX) {
    assert.equal(ids.has(entry.id), false, entry.id);
    ids.add(entry.id);
    assert.ok(GROUPS.includes(entry.group), `${entry.id} has group ${entry.group}`);
    assert.match(entry.route, /^\//);
    assert.equal(entry.title.trim().length > 0, true);
    assert.equal(entry.terms.trim().length > 0, true);
  }
});

test('"quiet" finds Quiet hours under Notifications', () => {
  const hit = searchSettings("quiet").find((row) => row.id === "quiet-hours");
  assert.ok(hit);
  assert.equal(hit.group, "Notifications");
  assert.equal(hit.anchor, "reminders");
});

test("the hub links every group the index can send people to", () => {
  const hub = readFileSync(new URL("../../app/(tabs)/settings.tsx", import.meta.url), "utf8");
  assert.match(hub, /settings-search-input/);
  for (const route of new Set(SETTINGS_INDEX.map((entry) => entry.route))) {
    assert.ok(hub.includes(`route: "${route}"`), `hub is missing ${route}`);
  }
  for (const route of ["/settings/display", "/settings/security", "/settings/notifications", "/settings/data", "/settings/about"]) {
    const file = `${route.replace("/settings/", "")}.tsx`;
    const src = readFileSync(new URL(`../../app/settings/${file}`, import.meta.url), "utf8");
    assert.match(src, /src\/components\/settings\//);
  }
});

test("v0.12: the reopen row is gone from Display and the search index", () => {
  const display = readFileSync(new URL("../components/settings/DisplaySettings.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(display, /settings-reopen-hours/);
  assert.doesNotMatch(display, /reopenHours/);
  assert.equal(searchSettings("reopen").length, 0);
});
