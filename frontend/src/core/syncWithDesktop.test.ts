import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import type { DB, PairedDevice, Txn } from "./types.ts";
import { addPairedDevice, newDeviceKeyPair, openMessage, sealMessage } from "./pairing.ts";
import { vaultFileList } from "./syncPackage.ts";
import { phoneIdentity, setDesktopAddress, SyncError } from "./syncClient.ts";
import { syncInFlight, syncLastAttemptAt, syncWithDesktop } from "./syncWithDesktop.ts";

function phoneWithDevice(): { db: DB; device: PairedDevice } {
  const seeded = emptyDB();
  seeded.settings.installId = "phone-1";
  const identity = phoneIdentity(seeded);
  const device: PairedDevice = { id: "desk-1", name: "Studio PC", key: newDeviceKeyPair().publicKey, lastSyncAt: "" };
  const db = setDesktopAddress(addPairedDevice(identity.db, device), device.id, "10.0.0.2", 47821);
  return { db, device };
}

function sealedReply(device: PairedDevice, payload: Record<string, unknown>): Response {
  return new Response(sealMessage(device.key, payload), { status: 200 });
}

test("syncWithDesktop runs the round and returns the merged document with the first summary", async () => {
  const { db, device } = phoneWithDevice();
  const real = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = (async () => {
      calls += 1;
      const txn: Txn = { id: "d1", type: "expense", amount: 30, category: "Food", date: "2026-10-01", updatedAt: "2026-10-01T00:00:00.000Z" };
      return sealedReply(device, { ok: true, changes: { records: { txns: [txn] }, tombstones: [] }, vaultFiles: [], needFromPhone: [], summary: { in: 1, out: 0 } });
    }) as typeof fetch;
    const result = await syncWithDesktop(db, device);
    assert.equal(calls, 1);
    assert.deepEqual(result.summary, { in: 1, out: 0 });
    assert.equal(result.db.txns[0]?.id, "d1");
    assert.equal(result.db.settings.pairedDevices[0]?.lastSyncAt, result.db.settings.lastSyncAt);
    assert.equal(typeof result.db.settings.lastSyncAt, "string");
    assert.equal(typeof syncLastAttemptAt(), "number");
    assert.equal(syncInFlight(), false);
  } finally {
    globalThis.fetch = real;
  }
});

test("progress reaches the manual caller and a silent round shows nothing", async () => {
  const { db, device } = phoneWithDevice();
  const real = globalThis.fetch;
  try {
    globalThis.fetch = (async () => sealedReply(device, { ok: true, changes: { records: {}, tombstones: [] }, vaultFiles: [], needFromPhone: [], summary: { in: 0, out: 0 } })) as typeof fetch;
    const lines: string[] = [];
    await syncWithDesktop(db, device, { onProgress: (line) => lines.push(line) });
    assert.deepEqual(lines, ["Syncing…"]);
    lines.length = 0;
    await syncWithDesktop(db, device, { silent: true, onProgress: (line) => lines.push(line) });
    assert.deepEqual(lines, []);
  } finally {
    globalThis.fetch = real;
  }
});

test("a needFromPhone reply sends the vault blobs in the same round and keeps the first summary", async () => {
  const { db: seeded, device } = phoneWithDevice();
  const photo = "data:image/jpeg;base64,QUJD";
  const txn: Txn = { id: "t1", type: "expense", amount: 10, category: "Food", date: "2026-10-01", updatedAt: "2026-10-01T00:00:00.000Z", photo };
  const db: DB = { ...seeded, txns: [txn] };
  const hash = vaultFileList(db)[0]!.hash;
  const real = globalThis.fetch;
  const bodies: string[] = [];
  try {
    globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
      bodies.push(String(init?.body ?? ""));
      if (bodies.length === 1) return sealedReply(device, { ok: true, changes: { records: { txns: [txn] }, tombstones: [] }, vaultFiles: [], needFromPhone: [{ hash }], summary: { in: 0, out: 1 } });
      return sealedReply(device, { ok: true, changes: { records: {}, tombstones: [] }, vaultFiles: [], needFromPhone: [], summary: { in: 0, out: 0 } });
    }) as unknown as typeof fetch;
    const result = await syncWithDesktop(db, device);
    assert.equal(bodies.length, 2);
    const upload = openMessage(device.key, (JSON.parse(bodies[1]!) as { body: string }).body) as { vaultFiles: { hash: string; dataB64: string }[] };
    assert.equal(upload.vaultFiles.length, 1);
    assert.equal(upload.vaultFiles[0]?.hash, hash);
    assert.equal(upload.vaultFiles[0]?.dataB64, "QUJD");
    assert.deepEqual(result.summary, { in: 0, out: 1 });
  } finally {
    globalThis.fetch = real;
  }
});

test("a desktop with no saved address refuses before any request", async () => {
  const seeded = emptyDB();
  seeded.settings.installId = "phone-1";
  const identity = phoneIdentity(seeded);
  const device: PairedDevice = { id: "desk-9", name: "Other PC", key: newDeviceKeyPair().publicKey, lastSyncAt: "" };
  const db = addPairedDevice(identity.db, device);
  const real = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("", { status: 200 });
    }) as typeof fetch;
    await assert.rejects(syncWithDesktop(db, device), (err: unknown) => err instanceof SyncError && err.code === "bad-address");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = real;
  }
});

test("a round that arrives while one runs joins it instead of overlapping", async () => {
  const { db, device } = phoneWithDevice();
  const real = globalThis.fetch;
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  try {
    globalThis.fetch = (async () => {
      calls += 1;
      await held;
      return sealedReply(device, { ok: true, changes: { records: {}, tombstones: [] }, vaultFiles: [], needFromPhone: [], summary: { in: 0, out: 0 } });
    }) as typeof fetch;
    const first = syncWithDesktop(db, device);
    const second = syncWithDesktop(db, device);
    assert.equal(first, second);
    assert.equal(syncInFlight(), true);
    release();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a, b);
    assert.equal(calls, 1);
    assert.equal(syncInFlight(), false);
  } finally {
    release();
    globalThis.fetch = real;
  }
});
