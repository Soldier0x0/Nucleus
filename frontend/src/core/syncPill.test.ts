import assert from "node:assert/strict";
import test from "node:test";
import { STALE_AFTER_MS, decodePill } from "./syncPill.ts";

const NOW = Date.parse("2026-10-16T12:00:00.000Z");
const DEVICE = (at: string) => ({ id: "desk-1", name: "Studio", key: "k", lastSyncAt: at });

function pill(lastSyncAt: string | undefined, lastFailedAt: number | null = null, devices = [DEVICE("")]) {
  return decodePill({ devices, lastSyncAt, lastFailedAt, now: NOW });
}

test("no paired desktop asks for pairing (the pill hides on this)", () => {
  const empty = decodePill({ devices: [], lastSyncAt: undefined, lastFailedAt: null, now: NOW });
  assert.deepEqual(empty, { state: "off-network", label: "Pair a desktop" });
});

test("fresh round reads green with a human minute count", () => {
  assert.deepEqual(pill("2026-10-16T11:58:00.000Z"), { state: "synced", label: "Synced 2m ago" });
  assert.deepEqual(pill("2026-10-16T11:59:30.000Z"), { state: "synced", label: "Synced" });
});

test("stale but recent rounds stay in the synced family, not the alarm family", () => {
  assert.deepEqual(pill("2026-10-16T09:00:00.000Z"), { state: "synced", label: "Synced 3h ago" });
  assert.deepEqual(pill("2026-10-15T23:00:00.000Z"), { state: "synced", label: "Synced 13h ago" });
});

test("a day without a successful round turns red", () => {
  const old = new Date(NOW - STALE_AFTER_MS - 3_600_000).toISOString();
  const p = pill(old);
  assert.equal(p.state, "stale");
  assert.equal(p.label, "Not synced in a day");
});

test("an in-window failure after a recent success still reads synced (the last round won)", () => {
  const p = pill("2026-10-16T11:58:00.000Z", NOW - 30_000);
  assert.deepEqual(p, { state: "synced", label: "Synced 2m ago" });
});

test("garbage timestamps never crash the decode", () => {
  assert.deepEqual(pill("garbage"), { state: "off-network", label: "Not synced yet" });
});

test("a fresher device stamp wins over a stale top-level stamp for the label", () => {
  const devices = [DEVICE("2026-10-16T11:58:00.000Z")];
  const p = pill("2026-10-10T12:00:00.000Z", null, devices);
  assert.deepEqual(p, { state: "synced", label: "Synced 2m ago" });
});
