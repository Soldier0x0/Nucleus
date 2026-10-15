import assert from "node:assert/strict";
import test from "node:test";
import { isContentRoute, normalizeReopenHours, recordRoute, reopenTarget, REOPEN_DEFAULT_HOURS } from "./reopen.ts";
import { emptyDB, normalizeDB } from "./defaults.ts";

const at = (iso: string) => Date.parse(iso);
const start = "2026-10-16T09:00:00.000Z";

test("a route inside the window reopens; just past it falls back to Favourites", () => {
  const settings = { reopenHours: 3, lastRoute: "/vehicles/v1", lastRouteAt: start };
  assert.equal(reopenTarget(settings, at("2026-10-16T11:59:59.000Z")), "/vehicles/v1");
  assert.equal(reopenTarget(settings, at("2026-10-16T12:00:00.000Z")), "/vehicles/v1");
  assert.equal(reopenTarget(settings, at("2026-10-16T12:00:01.000Z")), null);
});

test("reopen off means off: 0 and null always land on Favourites", () => {
  const base = { lastRoute: "/money", lastRouteAt: start };
  assert.equal(reopenTarget({ ...base, reopenHours: 0 }, at(start) + 1), null);
  assert.equal(reopenTarget({ ...base, reopenHours: null }, at(start) + 1), null);
});

test("only safe content routes are remembered and reopened", () => {
  for (const path of ["/", "/onboarding", "/capture", "/open", "/open/paper/1", "/record", "/record/voice"]) {
    assert.equal(isContentRoute(path), false, path);
    assert.equal(recordRoute({ lastRoute: null, lastRouteAt: null }, path, start), null);
  }
  for (const path of ["/vehicles", "/vehicles/v1", "/money", "/notes/n1", "/favorites"]) {
    assert.equal(isContentRoute(path), true, path);
  }
  assert.equal(reopenTarget({ reopenHours: 3, lastRoute: "/onboarding", lastRouteAt: start }, at(start) + 1), null);
  assert.equal(reopenTarget({ reopenHours: 3, lastRoute: "https://example.com", lastRouteAt: start }, at(start) + 1), null);
});

test("recording writes a content route once and refreshes the stamp", () => {
  assert.deepEqual(recordRoute({ lastRoute: null, lastRouteAt: null }, "/money", start), { lastRoute: "/money", lastRouteAt: start });
  assert.equal(recordRoute({ lastRoute: "/money", lastRouteAt: start }, "/money", start), null);
  assert.deepEqual(recordRoute({ lastRoute: "/money", lastRouteAt: start }, "/vehicles/v1", "2026-10-16T10:00:00.000Z"), {
    lastRoute: "/vehicles/v1",
    lastRouteAt: "2026-10-16T10:00:00.000Z",
  });
});

test("a missing or untrusted stamp never reopens", () => {
  assert.equal(reopenTarget({ reopenHours: 3, lastRoute: "/money", lastRouteAt: "not-a-date" }, at(start)), null);
  assert.equal(reopenTarget({ reopenHours: 3, lastRoute: "/money", lastRouteAt: null }, at(start)), null);
  // clock skew: a stamp from the future is not trusted
  assert.equal(reopenTarget({ reopenHours: 3, lastRoute: "/money", lastRouteAt: start }, at(start) - 1000), null);
});

test("reopen hours normalize: null stays off, sane numbers are kept, junk returns to default", () => {
  assert.equal(normalizeReopenHours(null), null);
  assert.equal(normalizeReopenHours(0), 0);
  assert.equal(normalizeReopenHours(5), 5);
  assert.equal(normalizeReopenHours(undefined), REOPEN_DEFAULT_HOURS);
  assert.equal(normalizeReopenHours("5"), REOPEN_DEFAULT_HOURS);
  assert.equal(normalizeReopenHours(Number.NaN), REOPEN_DEFAULT_HOURS);
  assert.equal(normalizeReopenHours(-2), REOPEN_DEFAULT_HOURS);
});

test("old snapshots default to three hours and no saved route", () => {
  const raw = JSON.parse(JSON.stringify(emptyDB()));
  delete raw.settings.reopenHours;
  delete raw.settings.lastRoute;
  delete raw.settings.lastRouteAt;
  const db = normalizeDB(raw);
  assert.equal(db.settings.reopenHours, REOPEN_DEFAULT_HOURS);
  assert.equal(db.settings.lastRoute, null);
  assert.equal(db.settings.lastRouteAt, null);
  assert.equal(db.settings.nativeModuleShell, undefined);
  const saved = normalizeDB({ ...raw, settings: { ...raw.settings, reopenHours: null, lastRoute: "/money", lastRouteAt: start, nativeModuleShell: false } });
  assert.equal(saved.settings.reopenHours, null);
  assert.equal(saved.settings.lastRoute, "/money");
  assert.equal(saved.settings.lastRouteAt, start);
  assert.equal(saved.settings.nativeModuleShell, false);
});
