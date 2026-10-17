import assert from "node:assert/strict";
import test from "node:test";
import { DEBOUNCE_MS, hasPendingLocalChange, RETRY_MS, RETRY_MAX_MS, backoffMs, retryDue, shouldSyncNow, type AutoSyncInput } from "./autoSync.ts";

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

test("silent failures widen the retry window up to the cap, a due change always wins", () => {
  assert.equal(backoffMs(0), RETRY_MS);
  assert.equal(backoffMs(1), RETRY_MS);
  assert.equal(backoffMs(2), RETRY_MS * 2);
  assert.equal(backoffMs(3), RETRY_MAX_MS);
  assert.equal(backoffMs(4), RETRY_MAX_MS);
  assert.equal(backoffMs(9), RETRY_MAX_MS);
  assert.equal(retryDue({ ...base(START + RETRY_MS * 2 - 1), consecutiveFailures: 2 }), false);
  assert.equal(retryDue({ ...base(START + RETRY_MS * 2), consecutiveFailures: 2 }), true);
  assert.equal(retryDue({ ...base(START), lastAttemptAt: null, consecutiveFailures: 5 }), true);
  // A pending local change ignores the widened clock entirely.
  assert.equal(shouldSyncNow({ ...base(START + 60_000), lastLocalChangeAt: START, lastAttemptAt: START, consecutiveFailures: 3 }), true);
});

test("background, locked, unpaired and in-flight all stop every sync", () => {
  const pending = { lastLocalChangeAt: START, lastAttemptAt: null, selfAppliedRevisionMarker: null };
  assert.equal(shouldSyncNow({ ...base(START + 60_000), ...pending, appActive: false }), false);
  assert.equal(shouldSyncNow({ ...base(START + 60_000), ...pending, unlocked: false }), false);
  assert.equal(shouldSyncNow({ ...base(START + 60_000), ...pending, pairedCount: 0 }), false);
  assert.equal(shouldSyncNow({ ...base(START + 60_000), ...pending, inFlight: true }), false);
  assert.equal(shouldSyncNow({ ...base(START + 60_000), ...pending }), true);
});
