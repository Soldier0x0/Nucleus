import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addCustomSymptom, emptyCycle, estimateLine, forecast, listedSymptoms, markStart, setFlowLevel, setSymptom, toggleSymptom } from "./cycle.ts";
import { doctorReport, reportLabel, textPdf, VISIT_GUIDE } from "./cycleReport.ts";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { parseLook } from "./looks.ts";
import { themeToIconVariant } from "./launcher.ts";
import { PRIVACY_CONNECTION } from "./privacyCopy.ts";
import { buildTheme } from "../theme.ts";
import { addWaterTime, normalizeWater, removeWaterTime, shiftWaterClock, waterNoticeCopy } from "./water.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("a range says how sure the guess is", () => {
  const one = markStart(markStart([], "2026-01-01"), "2026-01-29");
  const placeholder = forecast({ ...emptyCycle(), days: one }, "2026-02-01");
  assert.equal(placeholder?.confidence, "low");
  assert.match(estimateLine(placeholder!), /Low confidence/);
  assert.match(estimateLine(placeholder!), /28-day placeholder/);
  assert.match(estimateLine(placeholder!), /not one promised day/);

  const two = markStart(one, "2026-02-26");
  const closer = forecast({ ...emptyCycle(), days: two }, "2026-02-26");
  assert.equal(closer?.confidence, "closer");
  assert.match(estimateLine(closer!), /Closer/);
  assert.match(estimateLine(closer!), /Still a guess/);

  let mixed = markStart([], "2026-01-01");
  mixed = markStart(mixed, "2026-01-27");
  mixed = markStart(mixed, "2026-03-03");
  const wider = forecast({ ...emptyCycle(), days: mixed }, "2026-03-03");
  assert.equal(wider?.confidence, "wider");
  assert.match(estimateLine(wider!), /Less sure/);

  const paused = forecast({ ...emptyCycle(), days: two, paused: true }, "2026-02-26");
  assert.equal(paused?.confidence, "low");
  assert.match(estimateLine(paused!), /not a prediction/);
  assert.match(estimateLine(paused!), /Logged days stay/);
});

test("symptom chips keep a name the person added, and a flow change keeps them", () => {
  let days = toggleSymptom(markStart([], "2026-04-02"), "2026-04-02", "cramps");
  days = toggleSymptom(days, "2026-04-02", "headache");
  const day = days.find((item) => item.date === "2026-04-02");
  assert.equal(day?.symptom, "cramps");
  assert.deepEqual(day?.symptoms, ["headache"]);
  assert.deepEqual(listedSymptoms(day!), ["cramps", "headache"]);
  const named = addCustomSymptom(emptyCycle(), "Nausea");
  assert.deepEqual(named.customSymptoms, ["Nausea"]);
  assert.equal(addCustomSymptom(named, "cramps").customSymptoms.length, 1);
  days = toggleSymptom(days, "2026-04-02", "Nausea");
  days = setFlowLevel(days, "2026-04-02", "heavy");
  assert.deepEqual(listedSymptoms(days[0]), ["cramps", "headache", "Nausea"]);
  const cleared = setSymptom(days, "2026-04-02", null);
  assert.equal(cleared[0].symptom, undefined);
  assert.ok(listedSymptoms(cleared[0]).includes("Nausea"));
});

test("the doctor report uses initials, cites the guides, and can be a PDF", () => {
  const cycle = { ...emptyCycle(), buddyName: "Mango", days: setSymptom(markStart([], "2026-04-02"), "2026-04-02", "cramps") };
  assert.equal(reportLabel("private", "Mango"), "M.");
  assert.equal(reportLabel("private", "Ada Lovelace"), "A. L.");
  assert.equal(reportLabel("private", ""), "Private");
  assert.equal(reportLabel("normal", "Mango"), "Mango");
  const report = doctorReport(cycle, "2026-04-02");
  assert.match(report, /Name: M\./);
  assert.equal(report.includes("Mango"), false);
  assert.match(report, /This is not a diagnosis/);
  assert.match(report, /Age is not asked/);
  assert.match(report, /FIGO \(2018\)/);
  assert.match(report, /24 to 38 days/);
  assert.match(report, /ACOG/);
  assert.doesNotMatch(report, /you have|endometriosis|pregnant|BBT|TTC/i);
  const named = doctorReport({ ...cycle, reportName: "normal" }, "2026-04-02");
  assert.match(named, /Name: Mango/);
  const pdf = textPdf(["Hello 🥭", ...VISIT_GUIDE]);
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /%%EOF$/);
  assert.match(pdf, /Hello \?/);
  assert.match(pdf, /Helvetica/);
  assert.equal(pdf.includes("🥭"), false);
});

test("Blush paints pills, tiles, and sheets, and the launcher stays on a light picture", () => {
  const a11y = { highContrast: false, largeTouch: false, reducedMotion: false };
  const blush = buildTheme("paper", "ochre", false, a11y, "blush");
  assert.equal(blush.colors.surface, "#F8F1F3");
  assert.equal(blush.colors.brandPrimary, "#C48998");
  assert.equal(blush.colors.surfaceSecondary, "#FFF9FB");
  const theme = buildTheme("blush", "ochre", false, a11y, "cards");
  assert.equal(theme.colors.surface, "#F8F1F3");
  assert.equal(theme.colors.brandPrimary, "#C48998");
  const paper = buildTheme("paper", "ochre", false, a11y, "cards");
  assert.equal(paper.colors.brandPrimary, "#D68E42");
  assert.equal(paper.colors.surface, "#F6F7F9");
  assert.equal(parseLook("blush"), "blush");
  assert.equal(themeToIconVariant("blush"), "paper");
  const picker = read("../components/LookPicker.tsx");
  assert.match(picker, /theme: "blush"/);
  assert.match(picker, /accent: "blush"/);
});

test("privacy says what needs a connection", () => {
  assert.match(PRIVACY_CONNECTION, /connection/);
  assert.match(PRIVACY_CONNECTION, /online weather/);
  assert.match(PRIVACY_CONNECTION, /stay on this phone/);
  assert.doesNotMatch(PRIVACY_CONNECTION, /\bshe\b|overdue|\bmissed\b|behind|\blate\b|\bfail|arousal|\bpoints\b/i);
  const screen = read("../../app/privacy.tsx");
  assert.match(screen, /PRIVACY_CONNECTION/);
  assert.match(screen, /Needs a connection/);
});

test("water reminders are fixed times, and quiet hours move the clock", () => {
  const quiet = { enabled: true, from: 22, to: 7 };
  assert.deepEqual(shiftWaterClock(23, 30, quiet), { hour: 7, minute: 0 });
  assert.deepEqual(shiftWaterClock(6, 15, quiet), { hour: 7, minute: 0 });
  assert.deepEqual(shiftWaterClock(8, 15, quiet), { hour: 8, minute: 15 });
  assert.deepEqual(shiftWaterClock(23, 0, { enabled: false, from: 22, to: 7 }), { hour: 23, minute: 0 });
  let water = addWaterTime({ times: [] }, 9, 0);
  water = addWaterTime(water, 9, 0);
  assert.equal(water.times.length, 1);
  water = addWaterTime(water, 14, 30);
  assert.equal(removeWaterTime(water, water.times[0].id).times.length, 1);
  assert.deepEqual(waterNoticeCopy(false), { title: "Water", body: "A sip, at a time you set." });
  assert.deepEqual(waterNoticeCopy(true), { title: "Reminder", body: "" });
  const fresh = emptyDB();
  assert.equal(fresh.water.times.length, 0);
  assert.equal(fresh.settings.modules.some((row) => row.id === "health" && row.enabled), true);
  const legacy = normalizeDB({ version: 1 });
  assert.deepEqual(legacy.water.times, []);
  assert.equal(normalizeWater({ times: [{ hour: 9, minute: 0 }, { hour: 9, minute: 0 }, { hour: 9, minute: 0 }] }).times.length, 1);
});

test("cycle, health, and reminders stay inside this pass", () => {
  const calendar = read("../../app/cycle/index.tsx");
  const details = read("../../app/cycle/more.tsx");
  const health = read("../../app/health/index.tsx");
  const notify = read("./notify.ts");
  const alarms = read("./useCycleNotify.ts");
  const waterAlarms = read("./useWaterNotify.ts");
  assert.match(calendar, /cycle-estimate/);
  assert.match(calendar, /pinkCalendar/);
  assert.match(details, /cycle-report/);
  assert.match(details, /textPdf/);
  assert.match(details, /captureRef/);
  assert.match(details, /cycle-name-private/);
  assert.match(details, /toggleSymptom/);
  assert.match(health, /Nothing is counted/);
  assert.doesNotMatch(health, /glasses|streak|\bml\b/i);
  assert.match(notify, /WATER_PREFIX/);
  assert.match(notify, /CYCLE_NOTICE_PINK/);
  assert.match(notify, /keptAlarm/);
  assert.match(alarms, /pink: db\.cycle\.pinkCalendar/);
  assert.match(alarms, /privacyMode/);
  assert.match(waterAlarms, /shiftWaterClock/);
  assert.doesNotMatch(waterAlarms, /CYCLE_NOTICE_PINK/);
});
