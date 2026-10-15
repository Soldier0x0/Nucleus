import assert from "node:assert/strict";
import test from "node:test";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { paperExpiryDays } from "./vehicleDocs.ts";
import { applyMotorXor, motorPaper, vehicleDocTileIds } from "./vehicleDocs.ts";
import { migrateHomePresetOnLoad, presetItems, homePresetTiles } from "./presets.ts";
import { publicTransitSpend, vehicleFuelSpendMonth } from "./travelSpend.ts";
import { costPerKmLine, serviceLeftLine } from "./vehicleMath.ts";
import { vehicleOwnership } from "./life.ts";
import { normalizePaper, paperIsPdf } from "./paperNormalize.ts";
import { extractPaperFields } from "./paperExtract.ts";
import { monthKey } from "./format.ts";

test("papers keep image URIs and accept PDF mime on upgrade", () => {
  const legacy = normalizeDB({
    version: 1,
    papers: [{ id: "p1", kind: "licence", title: "Licence", photo: "data:image/jpeg;base64,abc", createdAt: "2026-01-01" }],
  });
  assert.equal(legacy.papers[0]?.photo, "data:image/jpeg;base64,abc");
  const pdf = normalizePaper({ id: "p2", kind: "insurance", title: "Policy", file: "data:application/pdf;base64,JVBERi0=", mime: "application/pdf", createdAt: "2026-01-01" });
  assert.equal(paperIsPdf(pdf), true);
});

test("travel-only bike users migrate to the vehicle board without losing data", () => {
  const preset = migrateHomePresetOnLoad(
    { fuel: [{ id: "f1" }], vehicles: [{ id: "v1" }], trips: [{ id: "t1", mode: "personal" }] },
    "travel",
  );
  assert.equal(preset, "vehicle");
  const kept = migrateHomePresetOnLoad({ trips: [{ id: "t1", mode: "public" }], fuel: [{ id: "f1" }] }, "travel");
  assert.equal(kept, "travel");
});

test("vehicle doc tiles follow motor XOR, PA, PUC, and RSA add-on", () => {
  const db = emptyDB();
  db.vehicles.push({ id: "v", name: "Activa", type: "bike", fuelType: "petrol", initialOdometer: 0, serviceIntervalKm: 3000, createdAt: "2026-01-01" });
  db.papers.push({
    id: "m1",
    kind: "insurance",
    title: "Comprehensive",
    motorCover: "comprehensive",
    vehicleId: "v",
    createdAt: "2026-01-01",
  });
  db.papers.push({ id: "pa", kind: "personal_accident", title: "PA cover", vehicleId: "v", createdAt: "2026-01-01" });
  db.papers.push({ id: "puc", kind: "puc", title: "PUC", vehicleId: "v", expiry: "2026-12-01", createdAt: "2026-01-01" });
  assert.deepEqual(vehicleDocTileIds(db, "v"), ["vdoc-motor", "vdoc-pa", "vdoc-puc"]);
  db.papers[0].rsaAddOn = true;
  db.papers[0].zeroDepAddOn = true;
  assert.deepEqual(vehicleDocTileIds(db, "v"), ["vdoc-motor", "vdoc-pa", "vdoc-puc"]);
  const swapped = applyMotorXor(db, {
    id: "m2",
    kind: "insurance",
    title: "Third party",
    motorCover: "third-party",
    vehicleId: "v",
    createdAt: "2026-01-02",
  });
  assert.equal(swapped.filter((p) => p.kind === "insurance" && p.vehicleId === "v" && p.motorCover).length, 1);
  assert.equal(motorPaper({ ...db, papers: swapped }, "v")?.motorCover, "third-party");
});

test("public transit spend stays separate from bike fuel and cost per km", () => {
  const db = emptyDB();
  db.vehicles.push({ id: "v", name: "Bike", type: "bike", fuelType: "petrol", initialOdometer: 1000, serviceIntervalKm: 3000, createdAt: "2026-01-01" });
  db.fuel.push({ id: "f1", vehicleId: "v", date: "2026-04-02", odometer: 1500, litres: 5, price: 100, total: 500 });
  db.txns.push({ id: "cab", type: "expense", amount: 120, category: "Travel", date: "2026-04-03", note: "Cab or taxi" });
  const month = monthKey("2026-04-03");
  assert.equal(publicTransitSpend(db, month, "cab"), 120);
  assert.equal(vehicleFuelSpendMonth(db, month), 500);
  const own = vehicleOwnership(db, "v");
  assert.ok(own && Number.isFinite(own.perKm));
  assert.equal(costPerKmLine(own!.perKm, "km")?.includes("per km"), true);
  assert.equal(publicTransitSpend(db, month, "cab"), 120);
});

test("health board carries cycle; health off hides the tile", () => {
  const db = emptyDB();
  db.cycle.days.push({ id: "d1", date: "2026-04-01", bleeding: "flow", flow: "medium" });
  const healthTiles = homePresetTiles(db, "health", "real").map((item) => item.id);
  assert.ok(healthTiles.includes("cycle"));
  assert.equal(presetItems("home").some((item) => item.id === "cycle"), false);
  const healthOff = {
    ...db,
    settings: {
      ...db.settings,
      modules: db.settings.modules.map((row) => (row.id === "health" ? { ...row, enabled: false } : row)),
    },
  };
  assert.equal(homePresetTiles(healthOff, "health", "real").some((item) => item.id === "cycle"), false);
});

test("paper expiry days and service left lines stay calm", () => {
  const paper = { id: "p", kind: "puc" as const, title: "PUC", expiry: "2026-04-10", createdAt: "2026-01-01" };
  assert.equal(paperExpiryDays(paper, "2026-04-01"), 9);
  assert.equal(serviceLeftLine(80), "80 km to service");
  const fields = extractPaperFields("Policy number ABC-12345 expiry 2026-05-01");
  assert.equal(fields.number, "ABC-12345");
  assert.equal(fields.expiry, "2026-05-01");
});
