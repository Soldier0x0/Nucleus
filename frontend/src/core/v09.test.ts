import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { emptyDB } from "./defaults.ts";
import { parseCapture } from "./capture.ts";
import { completeFuelNumbers, estimateOdometer, parseFuelDraft, recomputeFuelEstimates, setFuelFacts } from "./fuelCapture.ts";
import { attentionItems } from "./intelligence.ts";
import { SNOOZE_CHOICES, daysPastDue, snoozeStillPastDue } from "./attention.ts";
import { labelNeedsFullRow, openBoards } from "./presets.ts";
import { morningLine, applianceIcon } from "./life.ts";
import { changeOvertimeLine, clampChangeHours, defaultChangeHours, emptyCycle, productWindow, rematchLine, skipBuddyIntro, startChangeTimer } from "./cycle.ts";
import { edgeScrollDelta, neighborShift } from "./homeOrder.ts";
import { paintLook } from "./looks.ts";
import { buildTheme } from "../theme.ts";
import { withSampleData, withoutSampleData } from "./sample.ts";
import { MODULES } from "./modules.ts";
import type { FuelEntry, Vehicle } from "./types.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function activa(): Vehicle {
  return {
    id: "v1",
    name: "Activa",
    type: "bike",
    fuelType: "petrol",
    initialOdometer: 1000,
    serviceIntervalKm: 5000,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

test("two of litres, total, and rate fill the third to 2 decimals", () => {
  assert.deepEqual(completeFuelNumbers({ litres: 5.4, total: 560 }), { litres: 5.4, total: 560, rate: 103.7 });
  assert.deepEqual(completeFuelNumbers({ litres: 5.4, rate: 103.7 }), { litres: 5.4, total: 559.98, rate: 103.7 });
  assert.equal(completeFuelNumbers({ total: 560 }), null);
});

test("fuel capture accepts any order and only a named vehicle", () => {
  const db = emptyDB();
  db.vehicles.push(activa());
  const named = parseCapture(db, "560 5.4L Activa @103.7 18420km 2026-04-02 at Shell");
  assert.ok(named && !("error" in named));
  if (!named || "error" in named) return;
  const saved = named.apply(db);
  assert.equal(saved.fuel.length, 1);
  assert.equal(saved.fuel[0].vehicleId, "v1");
  assert.equal(saved.fuel[0].litres, 5.4);
  assert.equal(saved.fuel[0].total, 560);
  assert.equal(saved.fuel[0].price, 103.7);
  assert.equal(saved.fuel[0].date, "2026-04-02");
  assert.equal(saved.fuel[0].station, "Shell");
  assert.equal(saved.fuel[0].odometer, 18420);
  assert.equal(saved.fuel[0].odometerEstimated, undefined);

  const plain = parseCapture(db, "5.4L 560");
  assert.ok(plain && !("error" in plain));
  if (!plain || "error" in plain) return;
  const spend = plain.apply(db);
  assert.equal(spend.fuel.length, 0);
  assert.equal(spend.txns[0].category, "Fuel");
  assert.equal(spend.txns[0].amount, 560);

  const mid = parseCapture(db, "Activa at Shell 5.4L 560");
  assert.ok(mid && !("error" in mid));
  if (!mid || "error" in mid) return;
  const midSaved = mid.apply(db);
  const fill = midSaved.fuel.at(-1);
  assert.equal(fill?.station, "Shell");
  assert.equal(fill?.litres, 5.4);
  assert.equal(fill?.total, 560);

  const lunch = parseCapture(db, "450 food lunch");
  assert.ok(lunch && !("error" in lunch));
  if (!lunch || "error" in lunch) return;
  assert.equal(lunch.apply(db).txns.at(-1)?.category, "Food");
  assert.equal(parseFuelDraft(db, "450 food lunch"), null);
});

test("a missing odometer is estimated, then a typed reading spaces the earlier guesses", () => {
  const vehicle = activa();
  const db = emptyDB();
  db.vehicles.push(vehicle);
  const first = parseCapture(db, "Activa 5L 500 2026-04-01 1200km");
  assert.ok(first && !("error" in first));
  if (!first || "error" in first) return;
  let next = first.apply(db);
  const second = parseCapture(next, "Activa 5L 520 2026-04-11");
  assert.ok(second && !("error" in second));
  if (!second || "error" in second) return;
  next = second.apply(next);
  assert.equal(next.fuel[1].odometerEstimated, true);
  assert.ok(next.fuel[1].odometer >= 1200);
  const typed = setFuelFacts(next, next.fuel[1].id, { odometer: 1500 });
  assert.equal(typed.fuel.find((row) => row.id === next.fuel[1].id)?.odometerEstimated, false);
  assert.equal(typed.fuel.find((row) => row.id === next.fuel[1].id)?.odometer, 1500);

  const rows: FuelEntry[] = [
    { id: "a", vehicleId: "v1", date: "2026-04-01", odometer: 1000, litres: 5, price: 100, total: 500 },
    { id: "b", vehicleId: "v1", date: "2026-04-05", odometer: 1000, odometerEstimated: true, litres: 5, price: 100, total: 500 },
    { id: "c", vehicleId: "v1", date: "2026-04-09", odometer: 1400, litres: 5, price: 100, total: 500 },
  ];
  const spaced = recomputeFuelEstimates(rows, "v1");
  assert.equal(spaced.find((row) => row.id === "b")?.odometer, 1200);
  assert.equal(estimateOdometer(rows, vehicle, "2026-04-13"), 1600);
});

test("fuel follow-ups stay info, and only the latest fill asks for a station", () => {
  const db = emptyDB();
  db.vehicles.push(activa());
  db.fuel.push(
    { id: "old", vehicleId: "v1", date: "2026-04-01", odometer: 1100, litres: 5, price: 100, total: 500 },
    { id: "new", vehicleId: "v1", date: "2026-04-08", odometer: 1300, odometerEstimated: true, litres: 5, price: 100, total: 500, station: "" },
  );
  db.fuel[1].station = undefined;
  db.fuel.push({ id: "blank", vehicleId: "v1", date: "", odometer: 1400, litres: 5, price: 100, total: 500 });
  const items = attentionItems(db, "2026-04-10");
  const odo = items.find((item) => item.key === "fuel-odo:new");
  const date = items.find((item) => item.key === "fuel-date:blank");
  const stations = items.filter((item) => item.key.startsWith("fuel-station:"));
  assert.equal(odo?.severity, "info");
  assert.match(odo?.title ?? "", /Activa/);
  assert.equal(date?.severity, "info");
  assert.equal(stations.length, 1);
  assert.equal(stations[0].key, "fuel-station:blank");
});

test("snooze greys choices that are still before a past due date", () => {
  assert.deepEqual(SNOOZE_CHOICES, [1, 3, 7, 15, 30]);
  assert.equal(daysPastDue("2026-04-01", "2026-04-11"), 10);
  assert.equal(snoozeStillPastDue(10, 1), true);
  assert.equal(snoozeStillPastDue(10, 7), true);
  assert.equal(snoozeStillPastDue(10, 15), false);
  assert.equal(snoozeStillPastDue(0, 1), false);
});

test("a disabled module hides its home pill, and a long label takes the row", () => {
  const db = emptyDB();
  db.settings.modules = db.settings.modules.map((item) => (item.id === "money" ? { ...item, enabled: false } : item));
  assert.equal(openBoards(db).includes("money"), false);
  assert.equal(openBoards(db).includes("vehicle"), true);
  assert.equal(labelNeedsFullRow("Subscriptions"), true);
  assert.equal(labelNeedsFullRow("Attention"), true);
  assert.equal(labelNeedsFullRow("Fuel"), false);
  assert.equal(morningLine(emptyDB(), "2026-04-01"), "");
});

test("each product has its own change window, and an empty bag still notes the timer", () => {
  assert.equal(defaultChangeHours("pad"), 5);
  assert.equal(clampChangeHours("tampon", 12), 8);
  assert.equal(clampChangeHours("disc", 20), 12);
  assert.equal(productWindow("underwear").max, 24);
  assert.match(productWindow("underwear").line, /when it is wet/);
  const started = startChangeTimer({ ...emptyCycle(), changeKind: "tampon", changeHours: 8, stash: emptyCycle().stash.map((item) => (item.kind === "tampon" ? { ...item, count: 4, carry: 0 } : item)) }, new Date("2026-04-01T08:00:00.000Z"));
  assert.ok(started.changeRematchAt);
  assert.match(rematchLine(started, new Date("2026-04-01T15:30:00.000Z")) ?? "", /quiet reminder/);
  assert.match(changeOvertimeLine(started, new Date("2026-04-01T17:00:00.000Z")) ?? "", /bag is empty/);
  assert.match(changeOvertimeLine(started, new Date("2026-04-01T17:00:00.000Z")) ?? "", /Home still has 4/);
  const carried = { ...started, stash: started.stash.map((item) => (item.kind === "tampon" ? { ...item, carry: 1 } : item)) };
  assert.equal(changeOvertimeLine(carried, new Date("2026-04-01T17:00:00.000Z")), null);
  assert.equal(skipBuddyIntro(emptyCycle()).buddyIntroSeen, true);
  assert.equal(skipBuddyIntro(emptyCycle()).buddyName, "");
});

test("drag follows the finger and neighbors step aside", () => {
  assert.equal(neighborShift(2, 0, 4), -1);
  assert.equal(neighborShift(4, 0, 4), 0);
  assert.equal(neighborShift(1, 3, 0), 1);
  assert.equal(edgeScrollDelta(10, 0, 400), -16);
  assert.equal(edgeScrollDelta(390, 0, 400), 16);
  assert.equal(edgeScrollDelta(200, 0, 400), 0);
});

test("appearances paint cards and pills, and Paper plus Cards keeps the page color", () => {
  const a11y = { highContrast: false, largeTouch: false, reducedMotion: false };
  const paper = buildTheme("paper", "ochre", false, a11y, "cards");
  assert.equal(paper.colors.surface, "#F6F7F9");
  assert.notEqual(paper.colors.surfaceSecondary, paper.colors.surface);
  const current = buildTheme("paper", "ochre", false, a11y, "current");
  assert.equal(current.colors.surface, "#F6F7F9");
  assert.equal(current.colors.surfaceSecondary, "#FFFFFF");
  const soft = paintLook(current.colors, "soft", "light");
  assert.notEqual(soft.surface, current.colors.surface);
  assert.notEqual(soft.surfaceSecondary, current.colors.surfaceSecondary);
  const blush = buildTheme("paper", "ochre", false, a11y, "blush");
  assert.equal(blush.colors.surface, "#F8F1F3");
  assert.equal(blush.colors.surfaceSecondary, "#FFF9FB");
});

test("appliance names pick a glyph", () => {
  assert.equal(applianceIcon("Bedroom AC"), "air-conditioner");
  assert.equal(applianceIcon("Water purifier"), "air-filter");
  assert.equal(applianceIcon("Washing machine"), "washing-machine");
  assert.equal(applianceIcon("Dishwasher"), "dishwasher");
  assert.equal(applianceIcon("Lamp"), "home-outline");
});

test("sample cycle history is several periods and comes back out", () => {
  const sampled = withSampleData(emptyDB());
  const days = sampled.cycle.days.filter((day) => day.id.startsWith("sample-cycle-"));
  assert.ok(days.length >= 16);
  assert.equal(sampled.cycle.buddyName, "");
  assert.ok(days.some((day) => day.flow === "heavy" && day.symptom === "cramps"));
  assert.ok(days.some((day) => day.ended));
  const again = withSampleData(sampled);
  assert.equal(again.cycle.days.filter((day) => day.id.startsWith("sample-cycle-")).length, days.length);
  const mine = { ...sampled, cycle: { ...sampled.cycle, days: [...sampled.cycle.days, { id: "mine", date: "2020-01-01", bleeding: "flow" as const }] } };
  const cleaned = withoutSampleData(mine);
  assert.equal(cleaned.cycle.days.some((day) => day.id.startsWith("sample-cycle-")), false);
  assert.equal(cleaned.cycle.days.some((day) => day.id === "mine"), true);
});

test("Cycle is on the first-run list with the plain description", () => {
  const cycle = MODULES.find((item) => item.id === "cycle");
  assert.equal(cycle?.description, "Log periods and get a simple next-date guess. No AI. Stays on this phone.");
  const onboarding = read("../../app/onboarding.tsx");
  assert.equal(onboarding.includes('m.id !== "cycle"'), false);
  const attention = read("../../app/(tabs)/attention.tsx");
  assert.match(attention, /attention-snooze-/);
  assert.match(attention, /See more/);
  assert.match(attention, /SNOOZE_CHOICES/);
});
