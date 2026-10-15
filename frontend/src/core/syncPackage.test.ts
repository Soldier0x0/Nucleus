import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { applySyncDelta, changesSince, missingVaultFiles, vaultFileList, type SyncDelta } from "./syncPackage.ts";
import { addPairedDevice, newDeviceKeyPair } from "./pairing.ts";
import type { Txn } from "./types.ts";

const txn = (id: string, updatedAt: string, amount: number): Txn => ({ id, type: "expense", amount, category: "Food", date: "2026-10-01", updatedAt });

test("changesSince cuts records and tombstones after the stamp; null means everything", () => {
  const db = emptyDB();
  db.txns.push(txn("a", "2026-01-01T00:00:00.000Z", 10));
  db.txns.push(txn("b", "2026-02-01T00:00:00.000Z", 20));
  db.txns.push({ id: "legacy", type: "expense", amount: 5, category: "Food", date: "2026-01-01" });
  db.notes.push({ id: "n1", title: "Trip list", body: "", checklist: [], createdAt: "2026-01-01", updatedAt: "2026-02-15T00:00:00.000Z" });
  db.tombstones.push({ kind: "txns", id: "dead", deletedAt: "2026-03-01T00:00:00.000Z" });

  const all = changesSince(db, null);
  assert.deepEqual(all.records.txns?.map((r) => r.id), ["a", "b", "legacy"]);
  assert.deepEqual(all.records.notes?.map((r) => r.id), ["n1"]);
  assert.equal(all.tombstones.length, 1);
  assert.equal(all.records.vehicles, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(all)), all);

  const mid = changesSince(db, "2026-01-15T00:00:00.000Z");
  assert.deepEqual(mid.records.txns?.map((r) => r.id), ["b"]);
  assert.deepEqual(mid.records.notes?.map((r) => r.id), ["n1"]);
  assert.equal(mid.tombstones.length, 1);

  const newOnly = changesSince(db, "2026-02-20T00:00:00.000Z");
  assert.deepEqual(newOnly.records, {});
  assert.deepEqual(newOnly.tombstones.map((t) => t.id), ["dead"]);

  const none = changesSince(db, "2026-03-02T00:00:00.000Z");
  assert.deepEqual(none.records, {});
  assert.deepEqual(none.tombstones, []);
  assert.deepEqual(changesSince(emptyDB(), null).records, {});
  assert.deepEqual(none.records, {});
  assert.deepEqual(none.tombstones, []);
});

test("applySyncDelta: the newer copy wins in both directions and counts say in and out", () => {
  const mine = emptyDB();
  mine.txns.push(txn("keep", "2026-01-03T00:00:00.000Z", 100));
  mine.txns.push(txn("lose", "2026-01-01T00:00:00.000Z", 10));
  const delta: SyncDelta = {
    records: { txns: [txn("keep", "2026-01-02T00:00:00.000Z", 50), txn("lose", "2026-01-02T00:00:00.000Z", 20), txn("new", "2026-01-01T00:00:00.000Z", 5)] },
    tombstones: [],
  };
  const r = applySyncDelta(mine, delta);
  assert.equal(r.inCount, 2);
  assert.equal(r.outCount, 1);
  assert.equal(r.db.txns.find((t) => t.id === "keep")?.amount, 100);
  assert.equal(r.db.txns.find((t) => t.id === "lose")?.amount, 20);
  assert.equal(r.db.txns.find((t) => t.id === "new")?.amount, 5);
  assert.deepEqual(mine.txns.map((t) => [t.id, t.amount]), [["keep", 100], ["lose", 10]]);
});

test("applySyncDelta: a tie goes to the incoming copy", () => {
  const mine = emptyDB();
  mine.txns.push(txn("t", "2026-01-01T00:00:00.000Z", 10));
  const r = applySyncDelta(mine, { records: { txns: [txn("t", "2026-01-01T00:00:00.000Z", 40)] }, tombstones: [] });
  assert.equal(r.db.txns[0]?.amount, 40);
  assert.equal(r.inCount, 1);
  assert.equal(r.outCount, 0);
});

test("applySyncDelta: a delete beats an older edit and loses to a newer one", () => {
  const older = emptyDB();
  older.txns.push(txn("t", "2026-01-04T00:00:00.000Z", 10));
  const killed = applySyncDelta(older, { records: {}, tombstones: [{ kind: "txns", id: "t", deletedAt: "2026-01-05T00:00:00.000Z" }] });
  assert.equal(killed.db.txns.length, 0);
  assert.equal(killed.db.tombstones.length, 1);
  assert.equal(killed.inCount, 1);

  const newer = emptyDB();
  newer.txns.push(txn("t", "2026-01-06T00:00:00.000Z", 10));
  const survived = applySyncDelta(newer, { records: {}, tombstones: [{ kind: "txns", id: "t", deletedAt: "2026-01-05T00:00:00.000Z" }] });
  assert.equal(survived.db.txns.length, 1);
  assert.equal(survived.db.tombstones.length, 1);
  assert.equal(survived.inCount, 1);
  assert.equal(survived.outCount, 0);
});

test("applySyncDelta: the same delta applied twice changes nothing", () => {
  const mine = emptyDB();
  mine.txns.push(txn("a", "2026-01-01T00:00:00.000Z", 10));
  const delta: SyncDelta = {
    records: { txns: [txn("a", "2026-01-02T00:00:00.000Z", 20)] },
    tombstones: [{ kind: "txns", id: "dead", deletedAt: "2026-01-03T00:00:00.000Z" }],
  };
  const once = applySyncDelta(mine, delta);
  const twice = applySyncDelta(once.db, delta);
  assert.deepEqual(JSON.parse(JSON.stringify(twice.db)), JSON.parse(JSON.stringify(once.db)));
  assert.equal(twice.inCount, once.inCount);
  assert.equal(twice.outCount, once.outCount);
  assert.equal(once.inCount, 2);
});

test("applySyncDelta never merges device-only settings, even from a hostile delta", () => {
  const key = newDeviceKeyPair().publicKey;
  let mine = emptyDB();
  mine.settings.lockEnabled = true;
  mine.settings.unlockMethod = "both";
  mine.settings.biometricEnabled = true;
  mine.settings.moduleLocks = ["money"];
  mine.settings.installId = "phone-1";
  mine.settings.cloud = { provider: "drive", askedSinceUnlock: false, lastSyncAt: "2026-01-01T00:00:00.000Z" };
  mine = addPairedDevice(mine, { id: "desk-1", name: "Studio", key, lastSyncAt: "2026-01-01T00:00:00.000Z" });

  const hostile = {
    records: { txns: [txn("t1", "2026-02-01T00:00:00.000Z", 10)] },
    tombstones: [],
    settings: { ...mine.settings, lockEnabled: false, unlockMethod: "pin", biometricEnabled: false, moduleLocks: [], installId: "hacked", pairedDevices: [] },
    budget: { monthly: 999999, categories: { Evil: 1 } },
    attention: { evil: { status: "done" } },
  } as unknown as SyncDelta;

  const r = applySyncDelta(mine, hostile);
  assert.deepEqual(r.db.settings, mine.settings);
  assert.equal(r.db.settings.lockEnabled, true);
  assert.equal(r.db.settings.unlockMethod, "both");
  assert.equal(r.db.settings.biometricEnabled, true);
  assert.deepEqual(r.db.settings.moduleLocks, ["money"]);
  assert.equal(r.db.settings.installId, "phone-1");
  assert.equal(r.db.settings.pairedDevices.length, 1);
  assert.equal(r.db.settings.pairedDevices[0]?.id, "desk-1");
  assert.equal(r.db.txns[0]?.id, "t1");
  assert.equal(r.db.budget.monthly, 0);
});

test("a phone delta merges straight into a desktop copy and back without loss", () => {
  const phone = emptyDB();
  phone.txns.push(txn("t1", "2026-01-01T00:00:00.000Z", 10));
  const desktop = emptyDB();
  const stamped = "2026-01-02T00:00:00.000Z";
  const phoneDelta = changesSince(phone, null);
  const first = applySyncDelta(desktop, phoneDelta);
  assert.equal(first.db.txns.length, 1);
  assert.equal(first.inCount, 1);
  const back = changesSince({ ...first.db, txns: [{ ...first.db.txns[0]!, updatedAt: stamped }] }, "2026-01-01T00:00:00.000Z");
  const second = applySyncDelta(phone, back);
  assert.equal(second.db.txns[0]?.updatedAt, stamped);
  assert.equal(second.outCount, 0);
  assert.equal(second.inCount, 1);
});

test("vaultFileList hashes data: blobs inside the document and skips disk-only files", () => {
  const db = emptyDB();
  db.papers.push({ id: "p1", kind: "insurance", title: "Policy", mime: "application/pdf", file: "data:application/pdf;base64,QUJD", photo: "data:image/jpeg;base64,QUJD", createdAt: "2026-10-01" });
  db.services.push({ id: "s1", vehicleId: "v", date: "2026-10-01", odometer: 0, kind: "general", cost: 0, details: {}, billFile: "data:image/jpeg;base64,REVG" });
  db.txns.push({ id: "t1", type: "expense", amount: 20, category: "Food", date: "2026-10-01", photo: "data:image/jpeg;base64,QUJD" });
  db.vehicles.push({ id: "v", name: "Bike", type: "bike", fuelType: "petrol", initialOdometer: 0, serviceIntervalKm: 3000, createdAt: "2026-10-01", cover: "file:///papers/cover.jpg" });
  db.papers.push({ id: "p2", kind: "puc", title: "PUC", createdAt: "2026-10-01" });

  const list = vaultFileList(db);
  assert.deepEqual(list.map((f) => [f.kind, f.ref, f.size]), [
    ["papers.file", "p1", 3],
    ["papers.photo", "p1", 3],
    ["services.billFile", "s1", 3],
    ["txns.photo", "t1", 3],
  ]);
  assert.equal(new Set(list.map((f) => f.hash)).size, 2);
  assert.equal(list[0]?.hash, list[1]?.hash);
  assert.equal(list[0]?.hash, list[3]?.hash);
  assert.notEqual(list[0]?.hash, list[2]?.hash);
  assert.deepEqual(vaultFileList(db), list);
  assert.deepEqual(vaultFileList(emptyDB()), []);
});

test("missingVaultFiles is exactly the local list minus what the other side has", () => {
  const local = [
    { hash: "a", size: 1, kind: "k", ref: "r1" },
    { hash: "b", size: 2, kind: "k", ref: "r2" },
  ];
  const remote = [{ hash: "b", size: 2, kind: "k", ref: "r9" }];
  assert.deepEqual(missingVaultFiles(local, remote), [local[0]]);
  assert.deepEqual(missingVaultFiles(local, []), local);
  assert.deepEqual(missingVaultFiles([], remote), []);
  assert.deepEqual(missingVaultFiles(local, local), []);
});
