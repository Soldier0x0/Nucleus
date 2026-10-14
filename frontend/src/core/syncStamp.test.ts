import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { mergeDB } from "./merge.ts";
import { stampChanges, TOMBSTONE_DAYS } from "./syncStamp.ts";
import type { DB, Note } from "./types.ts";

const T1 = "2026-10-01T10:00:00.000Z";
const T2 = "2026-10-02T10:00:00.000Z";
const T3 = "2026-10-03T10:00:00.000Z";
const note = (id: string, title: string, updatedAt?: string) =>
  ({ id, title, body: "", checklist: [], createdAt: T1, updatedAt: updatedAt ?? T1 }) as Note;
const withNotes = (notes: Note[], tombstones: DB["tombstones"] = []): DB => ({ ...emptyDB(), notes, tombstones });

test("D0: a new or edited row gets updatedAt, an untouched row keeps its object", () => {
  const keep = note("a", "Keep");
  const prev = withNotes([keep, note("b", "Old")]);
  const next = stampChanges(prev, { ...prev, notes: [keep, { ...prev.notes[1], title: "New" }, note("c", "Added")] }, T2);
  assert.equal(next.notes[0], keep);
  assert.equal((next.notes[1] as Note & { updatedAt: string }).updatedAt, T2);
  assert.equal((next.notes[2] as Note & { updatedAt: string }).updatedAt, T2);
  assert.deepEqual(next.tombstones, []);
});

test("D0: deleting a row leaves a tombstone", () => {
  const prev = withNotes([note("a", "A"), note("b", "B")]);
  const next = stampChanges(prev, { ...prev, notes: [prev.notes[0]] }, T2);
  assert.deepEqual(next.tombstones, [{ kind: "notes", id: "b", deletedAt: T2 }]);
});

test("D0: tombstones older than the window are pruned", () => {
  const old = new Date(Date.parse(T3) - (TOMBSTONE_DAYS + 1) * 86400000).toISOString();
  const prev = withNotes([note("a", "A")], [{ kind: "notes", id: "x", deletedAt: old }, { kind: "notes", id: "y", deletedAt: T1 }]);
  const next = stampChanges(prev, { ...prev, notes: [{ ...prev.notes[0], title: "A2" }] }, T3);
  assert.deepEqual(next.tombstones.map((t) => t.id), ["y"]);
});

test("D0 merge: the newer edit wins on both sides", () => {
  const mine = withNotes([note("a", "mine newer", T3), note("b", "mine older", T1)]);
  const theirs = withNotes([note("a", "theirs older", T2), note("b", "theirs newer", T2)]);
  const out = mergeDB(mine, theirs);
  assert.deepEqual(out.notes.map((n) => n.title).sort(), ["mine newer", "theirs newer"]);
});

test("D0 merge: a delete beats an older edit, a newer edit beats the delete", () => {
  const mine = withNotes([], [{ kind: "notes", id: "a", deletedAt: T2 }, { kind: "notes", id: "b", deletedAt: T2 }]);
  const theirs = withNotes([note("a", "edited before delete", T1), note("b", "edited after delete", T3)]);
  const out = mergeDB(mine, theirs);
  assert.deepEqual(out.notes.map((n) => n.id), ["b"]);
  assert.equal(out.tombstones.length, 2);
});

test("D0 merge: rows from old files with no updatedAt still merge, incoming wins a tie", () => {
  const legacy = (id: string, title: string) => ({ id, title, body: "", checklist: [], createdAt: T1 }) as Note;
  const out = mergeDB(withNotes([legacy("a", "mine")]), withNotes([legacy("a", "theirs"), legacy("b", "new")]));
  assert.deepEqual(out.notes.map((n) => n.title), ["theirs", "new"]);
});

test("D0 merge: merging the same file twice changes nothing", () => {
  const mine = withNotes([note("a", "A", T1)], [{ kind: "notes", id: "z", deletedAt: T1 }]);
  const theirs = withNotes([note("a", "A2", T2), note("b", "B", T2)], [{ kind: "notes", id: "y", deletedAt: T2 }]);
  const once = mergeDB(mine, theirs);
  assert.deepEqual(mergeDB(once, theirs), once);
});

test("D0 merge: device settings and lock state stay on this device", () => {
  const mine = { ...emptyDB(), settings: { ...emptyDB().settings, lockEnabled: true, installId: "phone" } };
  const theirs = { ...emptyDB(), settings: { ...emptyDB().settings, lockEnabled: false, installId: "desktop" } };
  const out = mergeDB(mine, theirs);
  assert.equal(out.settings.lockEnabled, true);
  assert.equal(out.settings.installId, "phone");
});

test("D0 merge: odometer logs and rides now merge too", () => {
  const theirs = { ...emptyDB(), odometerLogs: [{ id: "o1" }], vehicleJourneys: [{ id: "j1" }] } as unknown as DB;
  const out = mergeDB(emptyDB(), theirs);
  assert.equal(out.odometerLogs.length, 1);
  assert.equal(out.vehicleJourneys.length, 1);
});

test("D0: old documents load with an empty tombstone list, bad entries are dropped", () => {
  assert.deepEqual(normalizeDB({}).tombstones, []);
  assert.deepEqual(normalizeDB({ tombstones: [{ kind: "notes", id: "a", deletedAt: T1 }, { id: 3 }, null] }).tombstones, [{ kind: "notes", id: "a", deletedAt: T1 }]);
});
