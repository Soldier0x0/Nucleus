import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { emptyDB } from "./defaults.ts";
import type { DB, PairedDevice, Txn } from "./types.ts";
import {
  addPairedDevice,
  derivePairKey,
  newDeviceKeyPair,
  openMessage,
  pairProof,
  sealMessage,
  verifyPairProof,
  PAIR_QR_TAG,
} from "./pairing.ts";
import { applySyncDelta, changesSince, missingVaultFiles, vaultFileList, type SyncDelta, type VaultFile } from "./syncPackage.ts";
import {
  applyIncomingVaultFiles,
  applySyncResponse,
  buildPairRequest,
  buildSyncRequest,
  buildVaultUpload,
  collectVaultFiles,
  desktopAddress,
  forgetDesktop,
  handlePairResponse,
  parseDesktopAddress,
  parseInfoReply,
  phoneIdentity,
  setDesktopAddress,
  SyncError,
  syncErrorMessage,
  type DesktopIdentity,
} from "./syncClient.ts";
import { syncFetch } from "./syncTransport.ts";

type DeskReply = { status: number; body: string };

type FakeDesktop = {
  db: DB;
  identity: DesktopIdentity;
  privateKey: string;
  code: string;
  locked: boolean;
};

const txn = (id: string, updatedAt: string, amount: number, photo?: string): Txn => ({ id, type: "expense", amount, category: "Food", date: "2026-10-01", updatedAt, ...(photo ? { photo } : {}) });

/** The desktop computer the phone talks to, with the same rules as desktop/src/sync/http.ts. */
function makeDesktop(): FakeDesktop {
  const keys = newDeviceKeyPair();
  return { db: emptyDB(), identity: { deviceId: "desk-1", name: "Studio PC", publicKey: keys.publicKey }, privateKey: keys.privateKey, code: "123456", locked: false };
}

function countDelta(delta: SyncDelta): number {
  let n = 0;
  for (const rows of Object.values(delta.records)) if (Array.isArray(rows)) n += rows.length;
  return n + (delta.tombstones?.length ?? 0);
}

function setDeviceLastSync(db: DB, id: string, at: string): DB {
  const pairedDevices = (db.settings.pairedDevices ?? []).map((d) => (d.id === id ? { ...d, lastSyncAt: at } : d));
  return { ...db, settings: { ...db.settings, pairedDevices, lastSyncAt: at } };
}

function handlePair(desk: FakeDesktop, bodyText: string): DeskReply {
  if (desk.locked) return { status: 503, body: JSON.stringify({ error: "locked" }) };
  let outer: Record<string, unknown>;
  try {
    outer = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return { status: 400, body: JSON.stringify({ ok: false, error: "bad-request" }) };
  }
  if (outer.t !== PAIR_QR_TAG || typeof outer.publicKey !== "string" || typeof outer.body !== "string") return { status: 400, body: JSON.stringify({ ok: false, error: "bad-request" }) };
  let pairKey: string;
  try {
    pairKey = derivePairKey(desk.privateKey, outer.publicKey, desk.code);
  } catch {
    return { status: 403, body: JSON.stringify({ ok: false, error: "bad-code" }) };
  }
  const refused = sealMessage(pairKey, { ok: false, error: "bad-code" });
  let payload: Record<string, unknown>;
  try {
    payload = openMessage(pairKey, outer.body) as Record<string, unknown>;
  } catch {
    return { status: 403, body: refused };
  }
  const phoneId = typeof payload.deviceId === "string" ? payload.deviceId.trim() : "";
  const phoneKey = typeof payload.phonePublicKey === "string" ? payload.phonePublicKey : "";
  const proof = typeof payload.proof === "string" ? payload.proof : "";
  if (!phoneId || phoneKey !== outer.publicKey || !verifyPairProof(pairKey, proof)) return { status: 403, body: refused };
  desk.db = addPairedDevice(desk.db, { id: phoneId, name: typeof payload.name === "string" && payload.name ? payload.name : "Phone", key: pairKey, lastSyncAt: "" });
  return { status: 200, body: sealMessage(pairKey, { ok: true, deviceId: desk.identity.deviceId, name: desk.identity.name, publicKey: desk.identity.publicKey }) };
}

function handleSync(desk: FakeDesktop, bodyText: string): DeskReply {
  if (desk.locked) return { status: 503, body: JSON.stringify({ error: "locked" }) };
  let outer: Record<string, unknown>;
  try {
    outer = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return { status: 403, body: JSON.stringify({ ok: false, error: "unknown-device" }) };
  }
  const wantedId = typeof outer.deviceId === "string" ? outer.deviceId : "";
  const device = (desk.db.settings.pairedDevices ?? []).find((d) => d.id === wantedId);
  if (!device || typeof outer.body !== "string") return { status: 403, body: JSON.stringify({ ok: false, error: "unknown-device" }) };
  let payload: Record<string, unknown> | null = null;
  try {
    payload = openMessage(device.key, outer.body) as Record<string, unknown>;
  } catch {
    payload = null;
  }
  if (!payload || payload.deviceId !== device.id) return { status: 403, body: sealMessage(device.key, { ok: false, error: "unknown-device" }) };

  const changes = (payload.changes ?? { records: {}, tombstones: [] }) as SyncDelta;
  const incomingVault = Array.isArray(payload.vaultFiles) ? payload.vaultFiles : [];
  const vaultHashes = (Array.isArray(payload.vaultHashes) ? payload.vaultHashes : []) as VaultFile[];
  const now = new Date().toISOString();

  const merged = applySyncDelta(desk.db, changes);
  const withFiles = applyIncomingVaultFiles(merged.db, incomingVault);
  const outgoing = changesSince(withFiles, device.lastSyncAt || null);
  const missing = missingVaultFiles(vaultFileList(withFiles), vaultHashes);
  const files = collectVaultFiles(withFiles, missing);
  const haveOnDesk = new Set(vaultFileList(withFiles).map((f) => f.hash));
  const needFromPhone = vaultHashes.filter((f) => !haveOnDesk.has(f.hash)).map((f) => ({ hash: f.hash }));
  const next = setDeviceLastSync(withFiles, device.id, now);
  desk.db = next;
  return { status: 200, body: sealMessage(device.key, { ok: true, changes: outgoing, vaultFiles: files, needFromPhone, summary: { in: merged.inCount, out: countDelta(outgoing) } }) };
}

function pairWith(desk: FakeDesktop): { db: DB; device: PairedDevice } {
  let phone = emptyDB();
  phone.settings.installId = "phone-1";
  const first = phoneIdentity(phone);
  const request = buildPairRequest(first.identity, desk.identity, desk.code);
  const reply = handlePair(desk, request.body);
  const db = handlePairResponse(first.db, desk.identity, desk.code, reply.body);
  return { db, device: db.settings.pairedDevices[0]! };
}

test("pairing stores the desktop on the phone and pairs once, not twice", () => {
  const desk = makeDesktop();
  const first = pairWith(desk);
  assert.equal(first.device.id, "desk-1");
  assert.equal(first.device.name, "Studio PC");
  assert.equal(first.device.lastSyncAt, "");
  assert.match(first.device.key, /^[A-Za-z0-9+/]{43}=$/);
  assert.equal(desk.db.settings.pairedDevices.length, 1);
  assert.equal(desk.db.settings.pairedDevices[0]?.id, "phone-1");

  const identity = phoneIdentity(first.db).identity;
  const request = buildPairRequest(identity, desk.identity, desk.code);
  const again = handlePairResponse(first.db, desk.identity, desk.code, handlePair(desk, request.body).body);
  assert.equal(again.settings.pairedDevices.length, 1);
  assert.equal(desk.db.settings.pairedDevices.length, 1);
});

test("a wrong six-digit code is refused and nothing is stored", () => {
  const desk = makeDesktop();
  let phone = emptyDB();
  phone.settings.installId = "phone-1";
  const first = phoneIdentity(phone);
  const request = buildPairRequest(first.identity, desk.identity, "654321");
  const reply = handlePair(desk, request.body);
  assert.throws(
    () => handlePairResponse(first.db, desk.identity, "654321", reply.body),
    (err: unknown) => err instanceof SyncError && err.code === "bad-code",
  );
  assert.equal(desk.db.settings.pairedDevices.length, 0);
});

test("the phone keeps one identity, built from the install id", () => {
  const db = emptyDB();
  db.settings.installId = "install-42";
  const first = phoneIdentity(db);
  assert.equal(first.identity.deviceId, "install-42");
  assert.equal(first.identity.name, "Phone");
  const second = phoneIdentity(first.db);
  assert.equal(second.db, first.db);
  assert.equal(second.identity.publicKey, first.identity.publicKey);
  assert.equal(second.identity.privateKey, first.identity.privateKey);
  const random = phoneIdentity(emptyDB());
  assert.match(random.identity.deviceId, /^[0-9a-f]{16}$/);
});

test("one round moves phone edits and a delete to the desktop and back", () => {
  const desk = makeDesktop();
  const phone = pairWith(desk);
  let mine = phone.db;
  mine.txns.push(txn("t1", "2026-01-01T00:00:00.000Z", 10));
  mine.tombstones.push({ kind: "txns", id: "gone", deletedAt: "2026-01-01T00:00:00.000Z" });
  desk.db.txns.push(txn("gone", "2025-12-01T00:00:00.000Z", 5), txn("t2", "2026-01-02T00:00:00.000Z", 20));

  const applied = applySyncResponse(mine, phone.device, handleSync(desk, buildSyncRequest(mine, phone.device)).body);
  assert.equal(applied.summary.in, 2);
  assert.equal(applied.summary.out, 3);
  assert.deepEqual(applied.db.txns.map((t) => t.id).sort(), ["t1", "t2"]);
  assert.deepEqual(desk.db.txns.map((t) => t.id).sort(), ["t1", "t2"]);
  assert.equal(desk.db.tombstones.filter((t) => t.id === "gone").length, 1);
  assert.equal(applied.db.settings.pairedDevices[0]?.lastSyncAt, applied.db.settings.lastSyncAt);
  assert.notEqual(applied.db.settings.pairedDevices[0]?.lastSyncAt, "");
});

test("a blob the desktop is missing comes over on the next request", () => {
  const desk = makeDesktop();
  const phone = pairWith(desk);
  let mine = phone.db;
  const photo = "data:image/jpeg;base64,QUJD";
  mine.txns.push(txn("t1", "2026-01-03T00:00:00.000Z", 10, photo));
  mine = addPairedDevice(mine, { ...phone.device, lastSyncAt: "2026-01-04T00:00:00.000Z" });
  desk.db.txns.push(txn("t1", "2026-01-01T00:00:00.000Z", 10));

  const first = applySyncResponse(mine, mine.settings.pairedDevices[0]!, handleSync(desk, buildSyncRequest(mine, mine.settings.pairedDevices[0]!)).body);
  assert.deepEqual(first.needFromPhone.map((f) => f.hash), vaultFileList(mine).map((f) => f.hash));
  assert.equal(first.db.txns[0]?.photo, photo);

  const upload = buildVaultUpload(first.db, first.db.settings.pairedDevices[0]!, first.needFromPhone);
  const second = applySyncResponse(first.db, first.db.settings.pairedDevices[0]!, handleSync(desk, upload).body);
  assert.deepEqual(second.needFromPhone, []);
  assert.equal(desk.db.txns.find((t) => t.id === "t1")?.photo, photo);
  assert.equal(second.summary.in, 0);
});

test("syncing twice in a row has nothing to move and changes no rows", () => {
  const desk = makeDesktop();
  const phone = pairWith(desk);
  let mine = phone.db;
  mine.txns.push(txn("t1", "2026-01-01T00:00:00.000Z", 10), txn("t2", "2026-01-02T00:00:00.000Z", 20));
  desk.db.txns.push(txn("d1", "2026-01-03T00:00:00.000Z", 30));

  const once = applySyncResponse(mine, mine.settings.pairedDevices[0]!, handleSync(desk, buildSyncRequest(mine, mine.settings.pairedDevices[0]!)).body);
  const rowsOnce = JSON.stringify(once.db.txns);
  const twice = applySyncResponse(once.db, once.db.settings.pairedDevices[0]!, handleSync(desk, buildSyncRequest(once.db, once.db.settings.pairedDevices[0]!)).body);
  assert.deepEqual(twice.summary, { in: 0, out: 0 });
  assert.deepEqual(twice.needFromPhone, []);
  assert.equal(JSON.stringify(twice.db.txns), rowsOnce);
});

test("a locked or unknown-device answer becomes a SyncError in plain words", () => {
  const desk = makeDesktop();
  const phone = pairWith(desk);
  assert.throws(
    () => applySyncResponse(phone.db, phone.device, JSON.stringify({ error: "locked" })),
    (err: unknown) => err instanceof SyncError && err.code === "locked" && /unlock it/i.test(syncErrorMessage(err.code)),
  );
  assert.throws(
    () => applySyncResponse(phone.db, phone.device, sealMessage(phone.device.key, { ok: false, error: "unknown-device" })),
    (err: unknown) => err instanceof SyncError && err.code === "unknown-device",
  );
  assert.throws(
    () => applySyncResponse(phone.db, phone.device, sealMessage(newDeviceKeyPair().publicKey, { ok: true })),
    (err: unknown) => err instanceof SyncError && err.code === "bad-response",
  );
  assert.throws(
    () => applySyncResponse(phone.db, phone.device, "oops"),
    (err: unknown) => err instanceof SyncError && err.code === "bad-response",
  );
  assert.throws(
    () => buildSyncRequest(emptyDB(), phone.device),
    (err: unknown) => err instanceof SyncError && err.code === "not-paired",
  );
});

test("parseDesktopAddress reads host:port and refuses everything else", () => {
  assert.deepEqual(parseDesktopAddress("192.168.1.5:47821"), { host: "192.168.1.5", port: 47821 });
  assert.deepEqual(parseDesktopAddress("  http://10.0.0.2:80 "), { host: "10.0.0.2", port: 80 });
  assert.deepEqual(parseDesktopAddress("my-desktop.local:1024"), { host: "my-desktop.local", port: 1024 });
  for (const bad of ["", "host", "host:", ":80", "host:0", "host:65536", "host:12a", "host:123456", "a:b:1", "host: 80"]) assert.equal(parseDesktopAddress(bad), null, bad);
});

test("parseInfoReply needs the nucleus-info-1 tag and a real key", () => {
  const keys = newDeviceKeyPair();
  const good = JSON.stringify({ t: "nucleus-info-1", deviceId: "desk-1", name: "Studio PC", publicKey: keys.publicKey });
  assert.deepEqual(parseInfoReply(good), { deviceId: "desk-1", name: "Studio PC", publicKey: keys.publicKey });
  for (const bad of [
    "",
    "nope",
    "[]",
    JSON.stringify({ error: "locked" }),
    JSON.stringify({ t: "something", deviceId: "d", name: "n", publicKey: keys.publicKey }),
    JSON.stringify({ t: "nucleus-info-1", name: "n", publicKey: keys.publicKey }),
    JSON.stringify({ t: "nucleus-info-1", deviceId: "d", name: " ", publicKey: keys.publicKey }),
    JSON.stringify({ t: "nucleus-info-1", deviceId: "d", name: "n", publicKey: "abc" }),
  ]) assert.equal(parseInfoReply(bad), null, bad);
});

test("the saved desktop address survives load-back and is forgotten with the pair", () => {
  const phone = pairWith(makeDesktop());
  let db = setDesktopAddress(phone.db, "desk-1", "192.168.1.20", 43110);
  assert.deepEqual(desktopAddress(db, "desk-1"), { host: "192.168.1.20", port: 43110 });
  assert.equal(desktopAddress(db, "desk-2"), null);
  db = forgetDesktop(db, "desk-1");
  assert.deepEqual(db.settings.pairedDevices, []);
  assert.equal(desktopAddress(db, "desk-1"), null);
});

test("syncFetch returns the raw reply and turns failures into timeout or unreachable", async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ t: "nucleus-info-1" }), { status: 200 })) as typeof fetch;
    const reply = await syncFetch("10.0.0.2", 5000, "/info");
    assert.equal(reply.status, 200);
    assert.equal(reply.body, JSON.stringify({ t: "nucleus-info-1" }));

    globalThis.fetch = (() => Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" }))) as typeof fetch;
    await assert.rejects(syncFetch("10.0.0.2", 5000, "/info", {}, 500), (err: unknown) => err instanceof SyncError && err.code === "timeout");

    globalThis.fetch = (() => Promise.reject(new TypeError("Network request failed"))) as typeof fetch;
    await assert.rejects(syncFetch("10.0.0.2", 5000, "/info"), (err: unknown) => err instanceof SyncError && err.code === "unreachable");
  } finally {
    globalThis.fetch = real;
  }
});

test("the camera is imported by the pairing screen only", () => {
  const root = new URL("../..", import.meta.url);
  const hits: string[] = [];
  for (const dir of ["src", "app"]) {
    const base = new URL(`${dir}/`, root);
    for (const rel of readdirSync(base, { recursive: true })) {
      const name = String(rel);
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const text = readFileSync(new URL(name, base), "utf8");
      if (/from\s+["']expo-camera["']|require\(\s*["']expo-camera["']\s*\)/.test(text)) hits.push(`${dir}/${name}`);
    }
  }
  assert.deepEqual(hits, ["src/components/settings/PairSettings.tsx"]);
});
