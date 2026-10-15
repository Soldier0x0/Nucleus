import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { deleteEntity } from "./actions.ts";
import { normalizePaper } from "./paperNormalize.ts";
import { paperHasTag, paperTagsFromKind, papersByTag, withoutPaper } from "./paperTags.ts";
import { suggestPaper, suggestPaperTags, suggestPaperTitle } from "./paperExtract.ts";
import { motorPaper, pucPaper, vehicleDocTileIds, vehiclePapers } from "./vehicleDocs.ts";
import type { Paper } from "./types.ts";

test("v0.9.9: one paper sits in two sections as one record, filter not copy", () => {
  const policy: Paper = { id: "p1", kind: "insurance", title: "Policy", tags: ["Vehicle", "Money"], createdAt: "2026-10-01" };
  const licence: Paper = { id: "p2", kind: "licence", title: "Licence", tags: ["Vehicle"], createdAt: "2026-10-02" };
  const papers = [policy, licence];
  const vehicle = papersByTag(papers, "Vehicle");
  const money = papersByTag(papers, "Money");
  assert.deepEqual(vehicle.map((p) => p.id), ["p1", "p2"]);
  assert.deepEqual(money.map((p) => p.id), ["p1"]);
  assert.equal(vehicle[0], money[0]);
  assert.equal(vehicle[0]?.id, money[0]?.id);
  assert.equal(papersByTag(papers, "All").length, 2);
  assert.equal(papersByTag(papers).length, 2);
  assert.equal(papersByTag(papers, "Travel").length, 0);
});

test("v0.9.9: deleting once removes the paper from every section and the vault", () => {
  const papers: Paper[] = [
    { id: "p1", kind: "insurance", title: "Policy", tags: ["Vehicle", "Money"], createdAt: "2026-10-01" },
    { id: "p2", kind: "puc", title: "PUC", tags: ["Vehicle"], createdAt: "2026-10-02" },
  ];
  const after = withoutPaper(papers, "p1");
  assert.equal(papersByTag(after, "Vehicle").some((p) => p.id === "p1"), false);
  assert.equal(papersByTag(after, "Money").some((p) => p.id === "p1"), false);
  assert.deepEqual(papersByTag(after, "Vehicle").map((p) => p.id), ["p2"]);
  const db = { ...emptyDB(), papers };
  const next = deleteEntity(db, { kind: "paper", id: "p1" });
  assert.equal(next.papers.some((p) => p.id === "p1"), false);
  assert.equal(next.papers.length, 1);
});

test("v0.9.9: old kinds migrate to sections; an unknown kind still loads", () => {
  const db = normalizeDB({
    version: 1,
    papers: [
      { id: "old", kind: "insurance", title: "Policy", createdAt: "2026-01-01" },
      { id: "medical", kind: "health", title: "Checkup", createdAt: "2026-01-01" },
      { id: "odd", kind: "telepathy", title: "Odd", createdAt: "2026-01-01" },
    ],
  });
  assert.deepEqual(db.papers[0]?.tags, ["Vehicle"]);
  assert.deepEqual(db.papers[1]?.tags, ["Health"]);
  assert.equal(db.papers[1]?.kind, "other");
  assert.deepEqual(db.papers[2]?.tags, ["Other"]);
  assert.equal(db.papers[2]?.title, "Odd");
  assert.equal(db.papers.length, 3);
});

test("v0.9.9: saved sections survive a reload; a cleared picker stays cleared", () => {
  const raw = JSON.parse(JSON.stringify(emptyDB())) as Record<string, any>;
  raw.papers = [{ id: "p1", kind: "insurance", title: "Policy", tags: ["Money"], createdAt: "2026-01-01" }];
  const db = normalizeDB(raw);
  assert.deepEqual(db.papers[0]?.tags, ["Money"]);
  assert.deepEqual(normalizePaper({ id: "p2", kind: "insurance", title: "Policy", tags: [], createdAt: "2026-01-01" }).tags, []);
  assert.deepEqual(normalizePaper({ id: "p3", kind: "puc", title: "PUC", tags: ["Vehicle", "Vehicle", "Nope"], createdAt: "2026-01-01" }).tags, ["Vehicle"]);
});

test("v0.9.9: kind-only records still filter and fill the vehicle tiles", () => {
  const old: Paper = { id: "puc", kind: "puc", title: "PUC", vehicleId: "v", createdAt: "2026-01-01" };
  assert.equal(old.tags, undefined);
  assert.equal(paperHasTag(old, "Vehicle"), true);
  assert.equal(papersByTag([old], "Vehicle").length, 1);
  assert.deepEqual(paperTagsFromKind("insurance"), ["Vehicle"]);
  assert.deepEqual(paperTagsFromKind("passport"), ["Travel"]);
  assert.deepEqual(paperTagsFromKind("warranty"), ["Home"]);
  const db = emptyDB();
  db.vehicles.push({ id: "v", name: "Bike", type: "bike", fuelType: "petrol", initialOdometer: 0, serviceIntervalKm: 3000, createdAt: "2026-01-01" });
  db.papers.push(old);
  db.papers.push({ id: "m1", kind: "insurance", title: "Policy", motorCover: "comprehensive", vehicleId: "v", createdAt: "2026-01-02" });
  assert.equal(motorPaper(db, "v")?.id, "m1");
  assert.equal(pucPaper(db, "v")?.id, "puc");
  assert.deepEqual(vehiclePapers(db, "v").map((p) => p.id), ["puc", "m1"]);
  assert.deepEqual(vehicleDocTileIds(db, "v"), ["vdoc-motor", "vdoc-puc"]);
});

test("v0.9.9: a paper tagged away from Vehicle leaves the vehicle tiles", () => {
  const db = emptyDB();
  db.vehicles.push({ id: "v", name: "Bike", type: "bike", fuelType: "petrol", initialOdometer: 0, serviceIntervalKm: 3000, createdAt: "2026-01-01" });
  db.papers.push({ id: "m1", kind: "insurance", title: "Policy", motorCover: "comprehensive", vehicleId: "v", tags: ["Money"], createdAt: "2026-01-02" });
  assert.equal(motorPaper(db, "v"), undefined);
  assert.equal(vehiclePapers(db, "v").length, 0);
});

test("v0.9.9: filename and typed words suggest sections and a title, never forced", () => {
  assert.deepEqual(suggestPaperTags("hdfc_bike_policy_2026.pdf"), ["Vehicle"]);
  assert.deepEqual(suggestPaperTags("passport renewal"), ["Travel"]);
  assert.deepEqual(suggestPaperTags("bank statement.pdf"), ["Money"]);
  assert.deepEqual(suggestPaperTags("health checkup report"), ["Health"]);
  assert.deepEqual(suggestPaperTags(""), []);
  assert.deepEqual(suggestPaperTags(undefined, "   "), []);
  const fromFile = suggestPaper({ fileName: "hdfc_ergo_policy_2026.pdf", typed: "" });
  assert.equal(fromFile.title, "hdfc ergo policy 2026");
  assert.deepEqual(fromFile.tags, ["Vehicle"]);
  const typedOnly = suggestPaper({ typed: "renew passport" });
  assert.equal(typedOnly.title, undefined);
  assert.deepEqual(typedOnly.tags, ["Travel"]);
  assert.equal(suggestPaperTitle("IMG_20260101_1234.jpg"), undefined);
  assert.equal(suggestPaperTitle("scan.pdf"), undefined);
  assert.equal(suggestPaperTitle(undefined), undefined);
  assert.equal(suggestPaper({ typed: "nothing that matches at all" }).tags.length, 0);
});
