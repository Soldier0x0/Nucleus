import assert from "node:assert/strict";
import test from "node:test";
import { syncStatusLine } from "./syncStatus.ts";

const NOW = "2026-10-14T12:00:00.000Z";

test("sync status: never paired, minutes, hours, days", () => {
  assert.equal(syncStatusLine(undefined, NOW), "Desktop sync: not paired yet");
  assert.equal(syncStatusLine("2026-10-14T11:59:40.000Z", NOW), "Synced just now");
  assert.equal(syncStatusLine("2026-10-14T11:45:00.000Z", NOW), "Synced 15 min ago");
  assert.equal(syncStatusLine("2026-10-14T09:00:00.000Z", NOW), "Synced 3 h ago");
  assert.equal(syncStatusLine("2026-10-13T12:00:00.000Z", NOW), "Synced 1 day ago");
  assert.equal(syncStatusLine("garbage", NOW), "Desktop sync: not paired yet");
});
