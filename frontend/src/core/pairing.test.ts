import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { fromB64, toB64 } from "./crypto.ts";
import {
  addPairedDevice,
  derivePairKey,
  newDeviceKeyPair,
  openMessage,
  pairProof,
  pairQrPayload,
  pairedDeviceById,
  parsePairQrPayload,
  removePairedDevice,
  sealMessage,
  verifyPairProof,
} from "./pairing.ts";
import type { PairedDevice } from "./types.ts";

test("both sides derive the same pair key; a different code makes a different key", () => {
  const alice = newDeviceKeyPair();
  const bob = newDeviceKeyPair();
  assert.equal(alice.publicKey.length, 44);
  assert.equal(alice.privateKey.length, 44);
  assert.notEqual(alice.publicKey, alice.privateKey);
  const atAlice = derivePairKey(alice.privateKey, bob.publicKey, "111111");
  const atBob = derivePairKey(bob.privateKey, alice.publicKey, "111111");
  assert.equal(atAlice, atBob);
  assert.notEqual(atAlice, derivePairKey(alice.privateKey, bob.publicKey, "222222"));
  assert.notEqual(atAlice, derivePairKey(bob.privateKey, alice.publicKey, "111112"));
});

test("sealed messages round-trip objects and throw on the wrong key", () => {
  const alice = newDeviceKeyPair();
  const bob = newDeviceKeyPair();
  const key = derivePairKey(alice.privateKey, bob.publicKey, "424242");
  const wrong = derivePairKey(alice.privateKey, bob.publicKey, "424243");
  const sealed = sealMessage(key, { kind: "hello", n: 3, nested: { ok: true, list: [1, 2] }, flag: false });
  assert.match(sealed, /^NPS1\./);
  assert.equal(sealed.split(".").length, 3);
  assert.deepEqual(openMessage(key, sealed), { kind: "hello", n: 3, nested: { ok: true, list: [1, 2] }, flag: false });
  assert.throws(() => openMessage(wrong, sealed));
});

test("sealed messages throw when a ciphertext byte is tampered with or the envelope is bad", () => {
  const key = derivePairKey(newDeviceKeyPair().privateKey, newDeviceKeyPair().publicKey, "999999");
  const sealed = sealMessage(key, { amount: 500 });
  const [prefix, iv, ct] = sealed.split(".");
  assert.equal(prefix, "NPS1");
  const bytes = fromB64(ct ?? "");
  bytes[3] ^= 0x40;
  assert.throws(() => openMessage(key, `NPS1.${iv}.${toB64(bytes)}`));
  const ivBytes = fromB64(iv ?? "");
  ivBytes[0] ^= 0x01;
  assert.throws(() => openMessage(key, `NPS1.${toB64(ivBytes)}.${ct}`));
  assert.throws(() => openMessage(key, "NPS1."));
  assert.throws(() => openMessage(key, "NPS1.a.b"));
  assert.throws(() => openMessage(toB64(new Uint8Array(31)), sealed));
  assert.throws(() => sealMessage(toB64(new Uint8Array(16)), { a: 1 }));
});

test("the pair QR round-trips with trimmed name and host and keeps a six-digit code", () => {
  const keys = newDeviceKeyPair();
  const text = pairQrPayload({ deviceId: "desktop-1", name: "  Studio PC  ", publicKey: keys.publicKey, host: " 192.168.1.20 ", port: 43110, code: "012345" });
  assert.match(text, /"t":"nucleus-pair-1"/);
  const parsed = parsePairQrPayload(text);
  assert.deepEqual(parsed, { deviceId: "desktop-1", name: "Studio PC", publicKey: keys.publicKey, host: "192.168.1.20", port: 43110, code: "012345" });
  assert.deepEqual(parsePairQrPayload(pairQrPayload(parsed!)), parsed);
});

test("a malformed pairing QR is null, never a partial read", () => {
  const keys = newDeviceKeyPair();
  const good = { t: "nucleus-pair-1", deviceId: "d1", name: "Desk", publicKey: keys.publicKey, host: "10.0.0.2", port: 5000, code: "123456" };
  const bad = [
    "",
    "not json",
    "[]",
    "42",
    "null",
    JSON.stringify({ ...good, t: "something-else" }),
    JSON.stringify({ ...good, publicKey: "abc" }),
    JSON.stringify({ ...good, publicKey: toB64(new Uint8Array(31)) }),
    JSON.stringify({ ...good, publicKey: keys.publicKey.slice(0, 43) }),
    JSON.stringify({ ...good, publicKey: 7 }),
    JSON.stringify({ ...good, port: 0 }),
    JSON.stringify({ ...good, port: 65536 }),
    JSON.stringify({ ...good, port: 1.5 }),
    JSON.stringify({ ...good, port: "5000" }),
    JSON.stringify({ ...good, code: "12345" }),
    JSON.stringify({ ...good, code: "1234567" }),
    JSON.stringify({ ...good, code: "12a456" }),
    JSON.stringify({ ...good, code: 123456 }),
    JSON.stringify({ ...good, name: "   " }),
    JSON.stringify({ ...good, name: 4 }),
    JSON.stringify({ ...good, host: "  " }),
    JSON.stringify({ ...good, deviceId: "" }),
    JSON.stringify({ ...good, deviceId: 7 }),
  ];
  for (const text of bad) assert.equal(parsePairQrPayload(text), null, text);
});

test("the pair proof verifies only for the right key", () => {
  const a = newDeviceKeyPair();
  const b = newDeviceKeyPair();
  const keyA = derivePairKey(a.privateKey, b.publicKey, "424242");
  const keyB = derivePairKey(a.privateKey, b.publicKey, "424243");
  const proof = pairProof(keyA);
  assert.equal(pairProof(keyA), proof);
  assert.equal(verifyPairProof(keyA, proof), true);
  assert.equal(verifyPairProof(keyB, proof), false);
  const bytes = fromB64(proof);
  bytes[0] ^= 1;
  assert.equal(verifyPairProof(keyA, toB64(bytes)), false);
  assert.equal(verifyPairProof(keyA, "not base64"), false);
  assert.equal(verifyPairProof(keyA, ""), false);
  assert.equal(verifyPairProof(derivePairKey(a.privateKey, a.publicKey, "424242"), proof), false);
});

test("paired devices replace by id, remove cleanly and leave the rest of the DB alone", () => {
  const keys = newDeviceKeyPair();
  const dev: PairedDevice = { id: "desk-1", name: "Studio PC", key: keys.publicKey, lastSyncAt: "2026-10-16T09:00:00.000Z" };
  const before = emptyDB();
  let db = addPairedDevice(before, dev);
  db = addPairedDevice(db, { ...dev, name: "Studio Desktop", lastSyncAt: "2026-10-16T10:00:00.000Z" });
  assert.equal(db.settings.pairedDevices.length, 1);
  assert.equal(pairedDeviceById(db, "desk-1")?.name, "Studio Desktop");
  db = addPairedDevice(db, { ...dev, id: "desk-2", name: "Laptop" });
  assert.deepEqual(db.settings.pairedDevices.map((d) => d.id), ["desk-1", "desk-2"]);
  assert.equal(db.settings.installId, before.settings.installId);
  assert.equal(db.settings.lockEnabled, before.settings.lockEnabled);
  db = removePairedDevice(db, "desk-1");
  assert.deepEqual(db.settings.pairedDevices.map((d) => d.id), ["desk-2"]);
  assert.equal(pairedDeviceById(db, "desk-1"), undefined);
  assert.deepEqual(before.settings.pairedDevices, []);
});

test("old documents load with no paired devices; junk rows are dropped", () => {
  assert.deepEqual(normalizeDB({}).settings.pairedDevices, []);
  const keys = newDeviceKeyPair();
  const raw = JSON.parse(JSON.stringify(emptyDB())) as Record<string, any>;
  delete raw.settings.pairedDevices;
  const db = normalizeDB(raw);
  assert.deepEqual(db.settings.pairedDevices, []);
  raw.settings.pairedDevices = [
    { id: "ok", name: "Studio", key: keys.publicKey, lastSyncAt: "2026-10-16T10:00:00.000Z" },
    { id: "bad-key", name: "Junk", key: "nope", lastSyncAt: "" },
    { name: "No id", key: keys.publicKey },
    null,
  ];
  const kept = normalizeDB(raw).settings.pairedDevices;
  assert.equal(kept.length, 1);
  assert.deepEqual(kept[0], { id: "ok", name: "Studio", key: keys.publicKey, lastSyncAt: "2026-10-16T10:00:00.000Z" });
});
