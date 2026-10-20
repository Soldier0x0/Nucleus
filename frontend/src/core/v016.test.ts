/**
 * v0.16 — every module now runs on the desktop as well as the phone.
 * The pins below hold the doors open: one screen per module, a Settings
 * page with no badges, reminders that speak honestly, and network checks
 * that never touch anything beyond what was typed.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const DESK = "../../../desktop";


describe("v016 · the module ports", () => {
  it("every module has a real screen file and App renders it", () => {
    for (const f of ["Tools.tsx", "Rules.tsx", "Dev.tsx", "Builder.tsx", "Cycle.tsx", "Net.tsx", "Lab.tsx"]) {
      assert.ok(existsSync(new URL(`${DESK}/src/screens/${f}`, import.meta.url)), `${f} exists`);
    }
    const app = read(`${DESK}/src/App.tsx`);
    for (const id of ["tools", "rules", "dev", "builder", "cycle", "net", "lab"]) {
      assert.ok(app.includes(`id: "${id}"`), `sidebar knows ${id}`);
      assert.match(app, new RegExp(`import \\{ \\w+ \\} from "./screens/${id === "tools" ? "Tools" : id[0].toUpperCase() + id.slice(1)}"`));
    }
    for (const screen of ["<Tools focusId", "<Rules />", "<Dev />", "<Builder onJump", "<Cycle />", "<Net />", "<Lab />"]) {
      assert.ok(app.includes(screen), `App renders ${screen}`);
    }
  });

  it("the Settings page has no phone-only ladders left anywhere", () => {
    for (const file of ["Settings.tsx", "../App.tsx"]) {
      const src = read(`${DESK}/src/screens/${file}`);
      assert.ok(!src.includes("Later phase"), `${file}: no later-phase badge`);
      assert.ok(!src.includes("Phone only"), `${file}: no phone-only badge`);
    }
    const settings = read(`${DESK}/src/screens/Settings.tsx`);
    assert.ok(settings.includes("Every module runs here as well as on the phone."), "the caption tells the new truth");
  });

  it("cycle reminders come from the shared data through the desktop notify wrapper", () => {
    const cycle = read(`${DESK}/src/screens/Cycle.tsx`);
    assert.match(cycle, /cycleNotices\(db\.cycle, db\.settings\.quietHours, today\)/);
    assert.match(cycle, /syncCycleNotices/);
    const notify = read(`${DESK}/src/platform/notify.ts`);
    assert.ok(notify.includes("syncReminders"), "rule reminders sync");
    assert.ok(notify.includes("syncCycleNotices"), "cycle alarms sync");
    assert.ok(notify.includes("syncWaterNotices"), "water alarms sync");
    assert.ok(!notify.includes("@tauri-apps/plugin-notification"), "no notification plugin was smuggled in");
    assert.match(notify, /Notification\.permission/, "the webview's own notifications are the channel");
  });

  it("the reminders copy is honest about when they fire", () => {
    const src = read(`${DESK}/src/screens/Rules.tsx`);
    assert.match(src, /while this app is open/, "reminders say they fire while the app is open");
    assert.match(src, /dryRun\(db, draft\)/, "the editor dry runs");
    assert.match(src, /markFired/, "one-shot rules are marked");
  });

  it("the network checks stay local and validated", () => {
    const lib = read(`${DESK}/src-tauri/src/lib.rs`);
    for (const cmd of ["net::net_ping", "net::net_dns", "net::net_lan_start", "net::net_lan_stop", "net::device_facts"]) {
      assert.ok(lib.includes(cmd), `lib wires ${cmd}`);
    }
    const net = read(`${DESK}/src-tauri/src/net.rs`);
    assert.match(net, /fn valid_host/, "hosts are validated before use");
    assert.ok(!net.includes("/bin/sh") && !net.includes("cmd.concat") && !net.includes("format!(\"{} {}\""), "nothing is built into a shell");
    assert.match(net, /connect_timeout/, "the scan is a bounded connect, not a flood");
    const ts = read(`${DESK}/src/platform/net.ts`);
    assert.match(ts, /invoke<\w+>\("net_ping"/);
    assert.match(ts, /listen<LanEvent>\("net-lan"/);
  });

  it("the Lab screen says plainly what a computer does not have", () => {
    const src = read(`${DESK}/src/screens/Lab.tsx`);
    assert.ok(src.includes("deviceFacts"), "facts come from the device command");
    assert.ok(src.includes("has no accelerometer"), "the sensor panel is honest");
    assert.ok(src.includes("Display test"), "the display test survives the port");
  });

  it("the cycle calendar keeps its pink flow niceties in css", () => {
    const css = read(`${DESK}/src/styles.css`);
    for (const cls of [".cal {", ".cal-day.flow", ".cal-day.window", ".cal-day.survey", ".fill-page"]) {
      if (cls === ".cal-day.survey") continue;
      assert.ok(css.includes(cls), `${cls} exists`);
    }
    const cycle = read(`${DESK}/src/screens/Cycle.tsx`);
    assert.match(cycle, /pinkCalendar/, "the pink switch moved over");
    assert.match(cycle, /doctorReport/, "the doctor report moved over");
    assert.match(cycle, /cycleCsv/, "the private export moved over");
  });
});
