import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { buildReport, DATA_FIXES, reportText, runChecks, runSelfCheck, type Probes } from "./selfCheck.ts";
import type { DB } from "./types.ts";

const NOW = "2026-10-14T10:00:00.000Z";
const probes = (db: DB, over: Partial<Probes> = {}): Probes => ({
  platform: "android 15",
  dbReadable: true,
  db,
  pinSet: true,
  biometricAvailable: true,
  notifyGranted: true,
  notificationAccess: true,
  scheduledReminders: 4,
  version: "0.9.8",
  docBytes: 2048,
  now: NOW,
  ...over,
});

const privateDb = (): DB => {
  const db = emptyDB();
  db.settings = { ...db.settings, lockEnabled: true, biometricEnabled: true, smsInbox: true, installId: "dev-1", lastBackupAt: "2026-10-10T10:00:00.000Z" };
  db.vehicles = [{ id: "v1", name: "Secret Activa KA01", initialOdometer: 1200, serviceIntervalKm: 3000, createdAt: NOW } as DB["vehicles"][number]];
  db.txns = [{ id: "t1", type: "expense", amount: 98765, category: "Food", date: "2026-10-01", note: "Dinner with Priya" } as DB["txns"][number]];
  db.papers = [{ id: "p1", kind: "insurance", title: "HDFC Ergo policy 778899", file: "data:application/pdf;base64,AAAA", createdAt: NOW } as DB["papers"][number]];
  return db;
};

test("self-check: a healthy phone passes, nothing fails", () => {
  const r = runChecks(probes(privateDb()));
  assert.equal(r.filter((x) => x.status === "fail").length, 0);
  assert.ok(r.length >= 14);
  assert.equal(new Set(r.map((x) => x.id)).size, r.length);
});

test("self-check: revoked notification access fails with an Open access fix", () => {
  const r = runChecks(probes(privateDb(), { notificationAccess: false })).find((x) => x.id === "bank-access")!;
  assert.equal(r.status, "fail");
  assert.equal(r.fix, "notification-access");
});

test("self-check: access granted but bank texts off offers Turn on, which asks first", () => {
  const db = privateDb();
  db.settings.smsInbox = false;
  const r = runChecks(probes(db)).find((x) => x.id === "bank-switch")!;
  assert.equal(r.fix, "bank-switch-on");
  assert.ok(DATA_FIXES.includes("bank-switch-on"));
});

test("self-check: lock on with no PIN fails; never backed up warns; bad vehicle warns", () => {
  const db = privateDb();
  delete db.settings.lastBackupAt;
  db.vehicles[0] = { ...db.vehicles[0], serviceIntervalKm: 0 };
  const r = runChecks(probes(db, { pinSet: false }));
  assert.equal(r.find((x) => x.id === "lock")!.status, "fail");
  assert.equal(r.find((x) => x.id === "backup")!.status, "warn");
  assert.equal(r.find((x) => x.id === "vehicles")!.status, "warn");
});

test("self-check: progress counts up in order", async () => {
  const seen: number[] = [];
  const res = await runSelfCheck(probes(privateDb(), { notifyGranted: false }), (p) => seen.push(p.done), async () => {});
  assert.deepEqual(seen, res.map((_, i) => i + 1));
});

test("self-check: the report has statuses and counts only, no private data", () => {
  const report = buildReport(runChecks(probes(privateDb())), { at: NOW, version: "0.9.8", platform: "android 15" });
  const all = JSON.stringify(report) + reportText(report);
  for (const secret of ["Secret", "KA01", "98765", "Priya", "Dinner", "HDFC", "778899", "base64", "dev-1"]) assert.equal(all.includes(secret), false, secret);
  assert.deepEqual(Object.keys(report.checks[0]).sort(), ["detail", "id", "status"]);
});

test("self-check: the screen confirms every fix that changes data", () => {
  const src = readFileSync(new URL("../../app/selfcheck.tsx", import.meta.url), "utf8");
  assert.match(src, /DATA_FIXES\.includes/);
  assert.match(src, /<ConfirmSheet/);
});
