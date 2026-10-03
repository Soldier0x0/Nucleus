import assert from "node:assert/strict";
import test from "node:test";
import { ABSORBENCY_NOTE, DOCTOR_NOTE, HYGIENE_NOTES, PHASES, buddyShareLine, clampChangeHours, cycleCsv, cycleLengths, cycleNotices, dismissAbsorbency, emptyCycle, forecast, loggedHeavyFlow, markEnd, markStart, normalizeCycle, periodStarts, searchCycleDays, setBleeding, setFlowLevel, setSymptom, showAbsorbency, timerCopy } from "./cycle.ts";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { calendarEvents } from "./life.ts";
import { buildDecoyDB } from "./profiles.ts";
import { search } from "./search.ts";
import { widgetSnapshot } from "./widgets.ts";

const quiet = { enabled: true, from: 22, to: 7 };

test("spotting does not start a cycle, and start plus end does not fill the days between", () => {
  let days = markStart([], "2026-03-01");
  days = setBleeding(days, "2026-03-02", "spotting");
  days = markEnd(days, "2026-03-05");
  assert.deepEqual(periodStarts(days), ["2026-03-01"]);
  assert.deepEqual(days.map((d) => d.date), ["2026-03-01", "2026-03-02", "2026-03-05"]);
  assert.equal(days.find((d) => d.date === "2026-03-02")?.bleeding, "spotting");
  assert.equal(days.find((d) => d.date === "2026-03-05")?.ended, true);
});

test("a flow day ten or more days later is another period", () => {
  let days = markStart([], "2026-03-01");
  days = setBleeding(days, "2026-03-11", "flow");
  assert.deepEqual(periodStarts(days), ["2026-03-01", "2026-03-11"]);
});

test("one real cycle stays on the 28-day placeholder, two use her own middle", () => {
  const one = markStart(markStart([], "2026-01-01"), "2026-01-29");
  const placeholder = forecast({ ...emptyCycle(), days: one }, "2026-02-01");
  assert.equal(placeholder?.source, "placeholder");
  assert.equal(placeholder?.length, 28);
  assert.equal(placeholder?.line.startsWith("Guess · "), true);
  assert.notEqual(placeholder?.from, placeholder?.to);

  const two = markStart(one, "2026-02-26");
  assert.deepEqual(cycleLengths(two), [28, 28]);
  const own = forecast({ ...emptyCycle(), days: two }, "2026-02-26");
  assert.equal(own?.source, "own");
  assert.equal(own?.length, 28);
  assert.equal(own?.wide, false);
  assert.equal(own?.ovulation, "2026-03-12");
});

test("the window widens when recent cycles disagree, and a long gap is left out", () => {
  let days = markStart([], "2026-01-01");
  days = markStart(days, "2026-01-27");
  days = markStart(days, "2026-03-03");
  const mixed = forecast({ ...emptyCycle(), days }, "2026-03-03");
  assert.equal(mixed?.source, "own");
  assert.equal(mixed?.wide, true);
  assert.ok((mixed?.from ?? "") < (mixed?.center ?? ""));
  assert.ok((mixed?.to ?? "") > (mixed?.center ?? ""));

  let skipped = markStart([], "2026-01-01");
  skipped = markStart(skipped, "2026-01-29");
  skipped = markStart(skipped, "2026-05-20");
  skipped = markStart(skipped, "2026-06-17");
  const lengths = cycleLengths(skipped);
  assert.equal(lengths.includes(28), true);
  assert.equal(lengths.some((n) => n > 90), false);
  const after = forecast({ ...emptyCycle(), days: skipped }, "2026-06-17");
  assert.equal(after?.length, 28);
});

test("pause and a gap past 90 days hide the guess without deleting logs", () => {
  const days = markStart([], "2026-01-01");
  const kept = JSON.stringify(days);
  const paused = forecast({ ...emptyCycle(), days, paused: true }, "2026-01-10");
  assert.equal(paused?.line, "Paused");
  assert.equal(JSON.stringify(days), kept);
  const stale = forecast({ ...emptyCycle(), days }, "2026-05-01");
  assert.equal(stale?.longGap, true);
  assert.equal(stale?.line, "Paused");
});

test("editing one day leaves the other record untouched", () => {
  const first = markStart([], "2026-04-01")[0];
  const days = setSymptom(setFlowLevel(markStart([first], "2026-04-02"), "2026-04-02", "heavy"), "2026-04-02", "cramps");
  assert.equal(days.find((d) => d.date === "2026-04-01"), first);
  assert.equal(days.find((d) => d.date === "2026-04-02")?.flow, "heavy");
  assert.equal(days.find((d) => d.date === "2026-04-02")?.symptom, "cramps");
});

test("notifications and the share are only the buddy line", () => {
  const days = markStart([], "2026-10-01");
  const cycle = { ...emptyCycle(), buddyName: "Mango 🥭", buddyEmoji: "🥭", periodNudge: true, changeNudge: true, changeEndsAt: "2026-10-03T12:00:00.000Z", days };
  const notices = cycleNotices(cycle, quiet, "2026-09-01", new Date("2026-09-01T00:00:00"));
  assert.equal(notices.length, 2);
  for (const notice of notices) {
    assert.equal(notice.title, "Mango needs attention");
    assert.equal(notice.body, "");
    assert.equal(notice.title.includes("🥭"), false);
    assert.doesNotMatch(notice.title, /flow|period|cramp|2026/i);
  }
  assert.deepEqual(notices.map((n) => n.id).sort(), ["cycle:change", "cycle:period"]);
  assert.equal(buddyShareLine("Mango 🥭"), "Mango needs attention");
  assert.equal(buddyShareLine("  "), "");
  const quietOnly = cycleNotices({ ...cycle, periodNudge: false }, quiet, "2026-09-01", new Date("2026-09-01T00:00:00"));
  assert.deepEqual(quietOnly.map((n) => n.id), ["cycle:change"]);
  const paused = cycleNotices({ ...cycle, paused: true, changeNudge: false }, quiet, "2026-09-01", new Date("2026-09-01T00:00:00"));
  assert.equal(paused.length, 0);
});

test("history search and the private file use her logs, and the file has no buddy name", () => {
  let days = setFlowLevel(markStart([], "2026-04-02"), "2026-04-02", "heavy");
  days = setSymptom(days, "2026-04-02", "cramps");
  days = setSymptom(days, "2026-04-08", "headache");
  assert.deepEqual(searchCycleDays(days, "heavy").map((d) => d.date), ["2026-04-02"]);
  assert.deepEqual(searchCycleDays(days, "cramps").map((d) => d.date), ["2026-04-02"]);
  const file = cycleCsv(days);
  assert.match(file, /2026-04-02,flow,heavy,Cramps/);
  assert.doesNotMatch(file, /Mango/);
});

test("a heavier day suggests absorbency and does not change the stash", () => {
  const days = setFlowLevel(markStart([], "2026-04-01"), "2026-04-01", "heavy");
  const cycle = { ...emptyCycle(), days, stash: emptyCycle().stash };
  const before = JSON.stringify(cycle.stash);
  assert.equal(loggedHeavyFlow(days), true);
  assert.equal(showAbsorbency(cycle), true);
  const noted = dismissAbsorbency(cycle);
  assert.equal(showAbsorbency(noted), false);
  assert.equal(JSON.stringify(noted.stash), before);
  assert.equal(JSON.stringify(noted.days), JSON.stringify(days));
});

test("saved days survive normalization, and an old document gains an empty calendar", () => {
  const raw = normalizeCycle({
    buddyName: "Mango 🥭",
    buddyEmoji: "🥭",
    days: [
      { id: "keep", date: "2026-04-02", bleeding: "spotting", symptom: "cramps", flow: "heavy" },
      { date: "2026-04-03", bleeding: "flow", flow: "light", ended: true },
    ],
  });
  assert.equal(raw.buddyName, "Mango");
  assert.equal(raw.buddyEmoji, "🥭");
  assert.equal(raw.days[0].bleeding, "spotting");
  assert.equal(raw.days[0].flow, undefined);
  assert.equal(raw.days[0].symptom, "cramps");
  assert.equal(raw.days[1].id, "day-2026-04-03");
  assert.equal(raw.days[1].ended, true);
  const legacy = normalizeDB({ version: 1, txns: [{ id: "bill", type: "expense", amount: 10, category: "Food", date: "2026-01-01" }] });
  assert.equal(legacy.cycle.days.length, 0);
  assert.equal(legacy.txns[0].id, "bill");
});

test("the decoy document does not keep the buddy or the logs", () => {
  const real = emptyDB();
  real.cycle = { ...real.cycle, buddyName: "Mango", buddyEmoji: "🥭", days: setSymptom(markStart([], "2026-04-01"), "2026-04-01", "cramps") };
  const decoy = buildDecoyDB(real);
  assert.equal(decoy.cycle.buddyName, "");
  assert.equal(decoy.cycle.buddyEmoji, "");
  assert.equal(decoy.cycle.days.length, 0);
  assert.equal(decoy.settings.modules.some((m) => m.id === "cycle"), false);
  assert.equal(JSON.stringify(decoy).includes("Mango"), false);
  assert.equal(JSON.stringify(decoy).includes("cramps"), false);
  const groups = search(real, "cramps");
  assert.equal(JSON.stringify(groups).includes("cramps"), false);
  assert.equal(JSON.stringify(search(real, "cycle")).includes("/cycle"), false);
});

test("home dates and widgets do not read the private calendar", () => {
  const db = emptyDB();
  db.cycle = { ...db.cycle, buddyName: "Mango", days: markStart([], "2026-06-01") };
  assert.equal(calendarEvents(db).some((event) => event.date === "2026-06-01"), false);
  const widget = JSON.stringify(widgetSnapshot(db, "2026-05-01"));
  assert.equal(widget.includes("Mango"), false);
  assert.equal(widget.includes("2026-06-01"), false);
});

test("timer limits and phase copy stay inside the brief", () => {
  assert.equal(clampChangeHours("tampon", 12), 8);
  assert.equal(clampChangeHours("pad", 2), 4);
  assert.equal(clampChangeHours("cup", 20), 12);
  assert.match(timerCopy("tampon"), /8 hours/);
  assert.match(timerCopy("cup"), /12 hours/);
  const copy = [...PHASES.map((p) => p.line), ...HYGIENE_NOTES, DOCTOR_NOTE, ABSORBENCY_NOTE, timerCopy("pad"), timerCopy("tampon"), timerCopy("cup")].join("\n").toLowerCase();
  assert.equal(copy.includes("you will"), false);
  assert.equal(copy.includes("arousal"), false);
  assert.equal(copy.includes("yoga"), false);
  assert.equal(copy.includes("massage"), false);
  for (const phase of PHASES) assert.match(phase.line, /some people/i);
  assert.match(DOCTOR_NOTE, /doctor/i);
});
