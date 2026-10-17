import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { stampChanges, SYNC_COLLECTIONS, TOMBSTONE_DAYS } from "./syncStamp.ts";
import {
  ACT_WORDS,
  appendJournal,
  changedFields,
  journalDeletions,
  journalFor,
  journalLabel,
  JOURNAL_CAP,
  JOURNAL_DAYS,
  restoreEntity,
  revertEntry,
} from "./journal.ts";
import { bundleForFile } from "./vaultFile.ts";
import { randomBytes, toB64 } from "./crypto.ts";
import { derivePairKey, openMessage, sealMessage } from "./pairing.ts";
import { handlePairResponse, pairKeyConflict, syncErrorMessage } from "./syncClient.ts";
import type { DB, JournalRow, Note, Txn } from "./types.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const T1 = "2026-10-01T10:00:00.000Z";
const T2 = "2026-10-02T10:00:00.000Z";
const T3 = "2026-10-03T10:00:00.000Z";

const note = (id: string, title: string, updatedAt?: string) =>
  ({ id, title, body: "", checklist: [], createdAt: T1, updatedAt: updatedAt ?? T1 }) as Note;
const txn = (id: string, amount: number, category = "Food") =>
  ({ id, type: "expense", amount, category, date: T1.slice(0, 10), channel: "in_person" }) as unknown as Txn;
const withRows = (rows: Partial<DB>): DB => ({ ...emptyDB(), ...rows });

test("v0.13: every local edit leaves one journal entry per touched row, with the rows it replaced", () => {
  const keep = note("a", "Keep");
  const prev = withRows({ notes: [keep, note("b", "Old")], journal: [] });
  const next = stampChanges(prev, { ...prev, notes: [keep, { ...prev.notes[1], title: "New" }, note("c", "Added")] }, T2);
  assert.equal(next.journal.length, 2);
  assert.ok(!next.journal.some((e) => e.recordId === "a"));
  const edit = next.journal.find((e) => e.act === "edit");
  assert.ok(edit);
  assert.equal(edit.kind, "notes");
  assert.equal(edit.recordId, "b");
  assert.equal((edit.before as JournalRow).title, "Old");
  assert.equal((edit.after as JournalRow).title, "New");
  const added = next.journal.find((e) => e.act === "add");
  assert.ok(added);
  assert.equal(added.recordId, "c");
  assert.equal(ACT_WORDS.add, "Added");
  assert.equal(ACT_WORDS.edit, "Changed");
  assert.equal(ACT_WORDS.delete, "Deleted");
});

test("v0.13: a delete entry keeps the row so it can be restored", () => {
  const prev = withRows({ txns: [txn("t1", 200), txn("t2", 45)], journal: [] });
  const next = stampChanges(prev, { ...prev, txns: [prev.txns[0]] }, T2);
  const dead = next.journal.find((e) => e.act === "delete");
  assert.ok(dead);
  assert.equal(dead.kind, "txns");
  assert.equal(dead.recordId, "t2");
  assert.equal((dead.before as Txn).amount, 45);
  assert.ok(next.tombstones.some((t) => t.kind === "txns" && t.id === "t2"));
  // Restoring goes through the normal write path: the row gets a fresh stamp,
  // so a later merge keeps it (newer than the tombstone that deleted it).
  const back = stampChanges(next, restoreEntity(next, dead), T3);
  assert.equal(back.txns.length, 2);
  assert.equal((back.txns[1] as Txn).amount, 45);
  assert.equal((back.txns[1] as Txn & { updatedAt: string }).updatedAt, T3);
  assert.deepEqual(journalDeletions(back), []);
});

test("v0.13: revert rolls an edit back through the normal write path", () => {
  const prev = withRows({ txns: [txn("t1", 200, "Food"), txn("t2", 45)], journal: [] });
  const edited = stampChanges(prev, { ...prev, txns: [txn("t1", 9999, "Repairs"), txn("t2", 45)] }, T2);
  const entry = journalFor(edited, "txns", "t1")[0];
  assert.ok(entry);
  assert.deepEqual(
    changedFields(entry).map((f) => f.toLowerCase()).sort(),
    ["amount", "category"],
  );
  const rolled = stampChanges(edited, revertEntry(edited, entry), T3);
  assert.equal(((rolled.txns as Txn[]).find((t) => t.id === "t1") as Txn).amount, 200);
  const undo = journalFor(rolled, "txns", "t1")[0];
  assert.equal(undo.act, "edit");
  assert.equal((undo.after as unknown as Transaction).amount, 200);
});

type Transaction = { id: string; amount: number };

test("v0.13: reverting an added record removes it, and the entry says so", () => {
  const prev = withRows({ txns: [txn("t1", 200)], journal: [] });
  const added = stampChanges(prev, { ...prev, txns: [txn("t1", 200), txn("t9", 75)] }, T2);
  const entry = journalFor(added, "txns", "t9")[0];
  assert.equal(entry.act, "add");
  assert.equal(journalLabel(entry), "Food");
  const undo = stampChanges(added, revertEntry(added, entry), T3);
  assert.deepEqual(undo.txns.map((t) => t.id), ["t1"]);
});

test("v0.13: the journal skips sample data and waits at its cap", () => {
  const prev = withRows({ txns: [txn("t0", 10)], journal: [], settings: { ...emptyDB().settings, sampleIds: ["s1"] } });
  const now = "2026-10-02T10:00:00.000Z";
  const withSample = { ...prev, txns: [...prev.txns, txn("s1", 999)] } as DB;
  assert.equal(appendJournal(prev, withSample, now).length, 0);

  const deadSoFar = new Date(Date.parse(now) - (JOURNAL_DAYS + 2) * 86400000).toISOString();
  const base = withRows({ txns: [], journal: [{ id: "old", at: deadSoFar, act: "edit", kind: "txns", recordId: "z" }] });
  const flooded = {
    ...base,
    txns: Array.from({ length: JOURNAL_CAP + 20 }, (_, i) => txn(`x${i}`, i)),
  } as DB;
  const flood = appendJournal(base, flooded, now);
  assert.equal(flood.length, JOURNAL_CAP);
  assert.ok(!flood.some((e) => e.id === "old"));
});

test("v0.13: restore sits on the timeline, history with revert sits on the record", () => {
  const detail = read("../../app/record/[kind]/[id].tsx");
  assert.match(detail, /<HistorySection/);
  assert.match(detail, /revertEntry/);
  assert.match(detail, /record-history/);
  assert.match(detail, /record-revert-/);
  const timelineScreen = read("../../app/timeline.tsx");
  assert.match(timelineScreen, /timeline-restores/);
  assert.match(timelineScreen, /restoreEntity/);
  assert.match(timelineScreen, /timeline-restore-/);
});

test("v0.13: the journal is this phone's own — it never syncs or leaves inside a file", () => {
  assert.ok(!SYNC_COLLECTIONS.includes("journal" as never));
  const db = withRows({
    journal: [{ id: "j1", at: T1, act: "add", kind: "txns", recordId: "t1" }],
    settings: {
      ...emptyDB().settings,
      phoneSync: { deviceId: "p", name: "Phone", publicKey: "a".repeat(44), privateKey: "b".repeat(44) },
    },
  });
  const bundled = bundleForFile(db);
  assert.equal((bundled as DB).journal, undefined);
  assert.equal((bundled.settings as Record<string, unknown>).phoneSync, undefined);
  assert.equal((bundled.settings as Record<string, unknown>).desktopSync, undefined);
  const desktop = read("../../../desktop/src/platform/backup.ts");
  assert.match(desktop, /bundleForFile/);
  assert.match(desktop, /device-private/);
});

test("v0.13: pairing pins the desktop key; a different key for the same device is refused until allowed", () => {
  const keyOf = () => toB64(randomBytes(32));
  const identity = { deviceId: "p1", name: "Phone", publicKey: keyOf(), privateKey: keyOf() };
  const desktop = { deviceId: "d1", name: "Studio", publicKey: keyOf() };
  const db = { ...emptyDB(), settings: { ...emptyDB().settings, phoneSync: identity } } as unknown as DB;
  const code = "654321";
  const pairKey = derivePairKey(identity.privateKey, desktop.publicKey, code) as string;
  const sealed = sealMessage(pairKey, { ok: true, deviceId: "d1", name: "Studio" });
  // The reply is sealed with the same pair key the phone derives; only then is the pin kept.
  const opened = openMessage(pairKey, sealed) as Record<string, unknown>;
  assert.equal(opened.ok, true);
  const next = handlePairResponse(db, desktop, code, sealed) as unknown as DB;
  const pair = (next.settings as unknown as { pairedDevices: { id: string; pubKey?: string; key: string }[] }).pairedDevices[0];
  assert.equal(pair?.id, "d1");
  assert.equal(pair?.pubKey, desktop.publicKey);
  assert.equal(pair?.key, pairKey);
  assert.equal(pairKeyConflict(next, { ...desktop, publicKey: keyOf() }), true);
  assert.equal(pairKeyConflict(next, desktop), false);
  // A desktop answering with a different key carries its own plain words.
  assert.match(syncErrorMessage("key-changed"), /different key/);
  const pairScreen = read("../components/settings/PairSettings.tsx");
  assert.match(pairScreen, /pairKeyConflict/);
  assert.match(pairScreen, /pair-key-alert/);
  assert.match(pairScreen, /Pair anyway/);
});

test("v0.13: wrong PINs are slower each time, and the Settings page says so", () => {
  assert.ok(JOURNAL_DAYS >= 90);
  const gate = read("./security.ts");
  assert.match(gate, /5 free attempts/);
  assert.match(gate, /30 \* 2/);
  assert.match(gate, /1800/);
  const security = read("../components/settings/SecuritySettings.tsx");
  assert.match(security, /settings-pin-backoff/);
  assert.match(security, /30 seconds up to 30 minutes/);
});

test("v0.13: tombstones keep deletes mergeable for their whole window", () => {
  assert.equal(TOMBSTONE_DAYS, 180);
});
