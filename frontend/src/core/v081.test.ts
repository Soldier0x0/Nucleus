import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { batterySummary, parsePhoneBattery } from "./batteryFacts.ts";
import { chanceFrames } from "./chance.ts";
import { deviceMakeModel } from "./deviceLabel.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const touchPad = (lab: string) => lab.slice(lab.indexOf("memo(function TouchPad"), lab.indexOf("export default function Lab"));

test("a repeating bill keeps the due date the form chose", () => {
  const screen = read("../../app/bills/index.tsx");
  assert.match(screen, /DateField/);
  assert.match(screen, /testID="bill-due"/);
  assert.match(screen, /nextRenewal: due/);
  assert.doesNotMatch(screen, /nextRenewal: todayISO\(\)/);
});

test("the touch box is a plain pressable and does not scale while sensors update", () => {
  const lab = read("../../app/lab/index.tsx");
  const pad = touchPad(lab);
  assert.ok(pad.length > 40);
  assert.match(pad, /Pressable/);
  assert.match(pad, /lab-touch-area/);
  assert.doesNotMatch(pad, /useSharedValue|withTiming|<Press[\s>]/);
  assert.doesNotMatch(pad, /setXyz|setHistory|Magnetometer|Accelerometer/);
  assert.match(pad, /memo\(function TouchPad/);
});

test("vibrate reports a failure and the manifest keeps the vibrate permission", () => {
  const lab = read("../../app/lab/index.tsx");
  const pad = touchPad(lab);
  assert.match(pad, /Vibration\.vibrate\(/);
  assert.match(pad, /lab-vibrate-button/);
  assert.doesNotMatch(pad, /\.catch\(\(\) => \{\}\)/);
  const manifest = read("../../modules/nucleus-android/android/src/main/AndroidManifest.xml");
  assert.match(manifest, /android\.permission\.VIBRATE/);
  const app = read("../../app.json");
  assert.doesNotMatch(app, /android\.permission\.VIBRATE/);
});

test("make and model are title case and the real-device row is gone", () => {
  assert.equal(deviceMakeModel("google", "Pixel 7"), "Google Pixel 7");
  assert.equal(deviceMakeModel("Google", "pixel 7a"), "Google Pixel 7a");
  assert.equal(deviceMakeModel(null, null), "—");
  const lab = read("../../app/lab/index.tsx");
  assert.match(lab, /deviceMakeModel\(/);
  assert.doesNotMatch(lab, /Real device/);
  assert.doesNotMatch(lab, /isDevice/);
});

test("main tools are tiles and unit categories stay pills", () => {
  const tools = read("../../app/tools/index.tsx");
  assert.match(tools, /tools-tile-units/);
  assert.match(tools, /tools-tile-cooking/);
  const grid = tools.slice(tools.indexOf("tools-grid"), tools.indexOf("tool-"));
  assert.doesNotMatch(grid, /ChipRow/);
  const units = read("../components/tools.tsx");
  assert.match(units, /units-category-row/);
  assert.match(units, /<ChipRow/);
  assert.match(units, /OptionSheet/);
  assert.doesNotMatch(units, /setUnit\(unit === "days"/);
  const cooking = read("../components/tools2.tsx");
  const kitchen = cooking.slice(cooking.indexOf("export function CookingTool"), cooking.indexOf("export function TimeTool"));
  assert.match(kitchen, /OptionSheet/);
  assert.match(kitchen, /cooking-unit/);
  assert.doesNotMatch(kitchen, /nextKey\(/);
});

test("phone lab labels stay on one short line", () => {
  const lab = read("../../app/lab/index.tsx");
  assert.match(lab, /<Eyebrow>Sensors<\/Eyebrow>/);
  assert.match(lab, /<Eyebrow>Touch test<\/Eyebrow>/);
  assert.match(lab, /<Eyebrow>Display test<\/Eyebrow>/);
  assert.match(lab, /Dead pixels/);
  assert.doesNotMatch(lab, /flat colour|Tap a swatch/);
});

test("dice, a coin, and a number show frames before the result", () => {
  let n = 0;
  const random = () => {
    n += 1;
    return (n % 5) / 5;
  };
  const dice = chanceFrames("dice", { sides: 6, count: 2, lo: 1, hi: 6 }, random, 4);
  assert.equal(dice.frames.length, 4);
  assert.equal(dice.final.length, 2);
  for (const face of [...dice.frames.flat(), ...dice.final]) {
    const value = Number(face);
    assert.ok(value >= 1 && value <= 6);
  }
  const coin = chanceFrames("coin", { sides: 2, count: 1, lo: 0, hi: 1 }, () => 0, 3);
  assert.deepEqual(coin.final, ["Tails"]);
  assert.equal(coin.frames.length, 3);
  const number = chanceFrames("number", { sides: 6, count: 1, lo: 10, hi: 12 }, () => 0.99, 3);
  assert.equal(number.final[0], "12");
  const screen = read("../components/tools2.tsx");
  assert.match(screen, /chanceFrames\(/);
  assert.match(screen, /reducedMotion/);
});

test("battery lines name the facts the phone reported and skip the ones it did not", () => {
  const shown = batterySummary(parsePhoneBattery(JSON.stringify({
    level: 0.82,
    state: "not charging",
    saver: false,
    cycleCount: 214,
    health: "Good",
    temperatureC: 31.2,
    voltageV: 4.18,
    technology: "Li-ion",
  })));
  assert.equal(shown.figure, "82%");
  assert.match(shown.lines.join(" "), /not charging/);
  assert.match(shown.lines.join(" "), /214 cycles/);
  assert.match(shown.lines.join(" "), /Good/);
  assert.match(shown.lines.join(" "), /31\.2°C/);
  assert.match(shown.lines.join(" "), /4\.18 V/);
  assert.match(shown.lines.join(" "), /Li-ion/);
  const quiet = batterySummary(parsePhoneBattery(JSON.stringify({ level: 0.5, state: "unplugged", saver: true })));
  assert.equal(quiet.figure, "50%");
  assert.match(quiet.lines.join(" "), /Battery saver on/);
  assert.doesNotMatch(quiet.lines.join(" "), /cycles|°C| V/);
  const kotlin = read("../../modules/nucleus-android/android/src/main/java/com/nucleus/widgets/PhoneBattery.kt");
  assert.match(kotlin, /EXTRA_CYCLE_COUNT|BATTERY_PROPERTY_CYCLE_COUNT/);
  assert.match(kotlin, /EXTRA_HEALTH/);
  assert.match(kotlin, /EXTRA_TEMPERATURE/);
  assert.match(kotlin, /EXTRA_VOLTAGE/);
  assert.match(kotlin, /EXTRA_TECHNOLOGY/);
  const lab = read("../../app/lab/index.tsx");
  assert.match(lab, /batterySummary\(/);
  assert.match(lab, /readPhoneBattery\(/);
});
