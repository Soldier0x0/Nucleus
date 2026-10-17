import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { parseWidgetAction, widgetSnapshot } from "./widgets.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("widget actions parse from a bare word or a deep-link URL; anything else is null", () => {
  assert.equal(parseWidgetAction("fuel"), "fuel");
  assert.equal(parseWidgetAction("expense"), "expense");
  assert.equal(parseWidgetAction("service"), "service");
  assert.equal(parseWidgetAction("nucleus://open?path=/money&action=expense"), "expense");
  assert.equal(parseWidgetAction("nucleus://open?path=/vehicles&action=fuel"), "fuel");
  assert.equal(parseWidgetAction("nucleus://open?action=SERVICE"), "service");
  assert.equal(parseWidgetAction("nucleus://open?path=/money"), null);
  assert.equal(parseWidgetAction("nucleus://open?action=%zz"), null);
  assert.equal(parseWidgetAction("wipe"), null);
  assert.equal(parseWidgetAction(""), null);
  assert.equal(parseWidgetAction(undefined), null);
  assert.equal(parseWidgetAction(["fuel"]), null);
});

test("an action deep link never carries an amount and privacy still hides the budget", () => {
  const db = emptyDB();
  db.budget.monthly = 3100;
  db.txns.push({ id: "t", type: "expense", amount: 1000, category: "Food", date: "2026-10-02" });
  db.settings.privacyMode = true;
  const snapshot = widgetSnapshot(db, "2026-10-02");
  assert.equal(snapshot.budget.value, "Hidden");
  assert.equal(snapshot.privacy, true);
  assert.equal(JSON.stringify(snapshot).includes("1000"), false);
  assert.equal(parseWidgetAction("nucleus://open?path=/money&action=expense"), "expense");
});

test("the root open route waits for unlock before opening a fuel, expense or service sheet", () => {
  const src = read("../../app/open.tsx");
  assert.match(src, /parseWidgetAction\(params\.action\)/);
  assert.match(src, /useLockSignal\(\)/);
  assert.match(src, /gate !== "unlocked"/);
  assert.match(src, /FuelSheet/);
  assert.match(src, /TxnSheet/);
  assert.match(src, /ServiceSheet/);
});

test("the installed app registers fuel, expense and service action widgets that only deep-link", () => {
  const kt = read("../../modules/nucleus-android/android/src/main/java/com/nucleus/widgets/Widgets.kt");
  const manifest = read("../../modules/nucleus-android/android/src/main/AndroidManifest.xml");
  for (const [cls, kind] of [["FuelWidget", "fuel"], ["ExpenseWidget", "expense"], ["ServiceWidget", "service"]] as const) {
    assert.match(kt, new RegExp(`class ${cls} : NucleusWidget\\(\\)[\\s\\S]*?override val kind = "${kind}"`));
    assert.match(manifest, new RegExp(`android:name="com\\.nucleus\\.widgets\\.${cls}"`));
  }
  assert.match(kt, /nucleus:\/\/open\?path=\$path\$actionText/);
  assert.match(kt, /&action=\$action/);
  assert.doesNotMatch(kt, /nucleus\.db/);
  assert.match(manifest, /android.appwidget.action.APPWIDGET_UPDATE/);
});
