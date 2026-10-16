import assert from "node:assert/strict";
import test from "node:test";
import { DEBOUNCE_MS, hasPendingLocalChange, RETRY_MS, shouldSyncNow, type AutoSyncInput } from "./autoSync.ts";

const START = 1_000_000;

const base = (now: number): AutoSyncInput => ({
  appActive: true,
  unlocked: true,
  pairedCount: 1,
  inFlight: false,
  now,
  lastLocalChangeAt: null,
  lastAttemptAt: START,
  selfAppliedRevisionMarker: null,
});

test("a local change syncs at exactly the debounce, not a millisecond before", () => {
  assert.equal(hasPendingLocalChange({ now: START + DEBOUNCE_MS - 1, lastLocalChangeAt: START }), false);
  assert.equal(hasPendingLocalChange({ now: START + DEBOUNCE_MS, lastLocalChangeAt: START }), true);
  assert.equal(shouldSyncNow({ ...base(START + DEBOUNCE_MS - 1), lastLocalChangeAt: START, lastAttemptAt: START }), false);
  assert.equal(shouldSyncNow({ ...base(START + DEBOUNCE_MS), lastLocalChangeAt: START, lastAttemptAt: START }), true);
  assert.equal(shouldSyncNow({ ...base(START + 10 * DEBOUNCE_MS), lastLocalChangeAt: null, lastAttemptAt: START }), false);
});

test("a change already carried by a round never counts as pending again", () => {
  assert.equal(hasPendingLocalChange({ now: START + 60_000, lastLocalChangeAt: START, selfAppliedRevisionMarker: START }), false);
  assert.equal(hasPendingLocalChange({ now: START + 60_000, lastLocalChangeAt: START, selfAppliedRevisionMarker: START + 1 }), false);
  assert.equal(hasPendingLocalChange({ now: START + 60_000, lastLocalChangeAt: START, selfAppliedRevisionMarker: START - 1 }), true);
  assert.equal(hasPendingLocalChange({ now: START + 60_000, lastLocalChangeAt: START, selfAppliedRevisionMarker: null }), true);
  assert.equal(shouldSyncNow({ ...base(START + 60_000), lastLocalChangeAt: START, selfAppliedRevisionMarker: START, lastAttemptAt: START }), false);
});

test("with no local change the retry fires at exactly 120 seconds, or right away after a pair", () => {
  assert.equal(shouldSyncNow({ ...base(START + RETRY_MS - 1), lastAttemptAt: START }), false);
  assert.equal(shouldSyncNow({ ...base(START + RETRY_MS), lastAttemptAt: START }), true);
  assert.equal(shouldSyncNow({ ...base(START), lastAttemptAt: null }), true);
});

test("background, locked, unpaired and in-flight all stop every sync", () => {
  const pending = { lastLocalChangeAt: START, lastAttemptAt: null, selfAppliedRevisionMarker: null };
  assert.equal(shouldSyncNow({ ...base(START + 60_000), ...pending, appActive: false }), false);
  assert.equal(shouldSyncNow({ ...base(START + 60_000), ...pending, unlocked: false }), false);
  assert.equal(shouldSyncNow({ ...base(START + 60_000), ...pending, pairedCount: 0 }), false);
  assert.equal(shouldSyncNow({ ...base(START + 60_000), ...pending, inFlight: true }), false);
  assert.equal(shouldSyncNow({ ...base(START + 60_000), ...pending }), true);
});
