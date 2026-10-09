import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { askAfterLeave, askOnRelaunch } from "./lockPolicy.ts";
import { unlockSettingsForNewLock } from "./lockSettings.ts";

test("enabling lock picks both when biometrics are available", () => {
  assert.deepEqual(unlockSettingsForNewLock(true), { unlockMethod: "both", biometricEnabled: true });
  assert.deepEqual(unlockSettingsForNewLock(false), { unlockMethod: "pin", biometricEnabled: false });
});

test("install-over and icon restart still ask on relaunch", () => {
  assert.equal(askOnRelaunch({ lockEnabled: true, marked: true, phoneLocked: false, fullyClosed: false }), true);
});

test("lock timeout zero locks on any background return", () => {
  assert.equal(
    askAfterLeave({
      lockEnabled: true,
      deviceLocked: false,
      screenTurnedOff: false,
      screenshot: false,
      backgroundMs: 1,
      lockTimeoutSec: 0,
      externalActivity: false,
    }),
    true,
  );
});

test("biometricUnlock failures stay locked", async () => {
  const sec = readFileSync(new URL("./security.ts", import.meta.url), "utf8");
  assert.match(sec, /try\s*\{[\s\S]*authenticateAsync[\s\S]*catch/);
  const gate = readFileSync(new URL("../components/LockGate.tsx", import.meta.url), "utf8");
  assert.match(gate, /AppState\.currentState !== "active"/);
});

test("native phone lock read fails closed", () => {
  const android = readFileSync(new URL("../native/android.ts", import.meta.url), "utf8");
  assert.match(android, /deviceLocked: true/);
  const kotlin = readFileSync(new URL("../../modules/nucleus-android/android/src/main/java/com/nucleus/widgets/NucleusAndroidModule.kt", import.meta.url), "utf8");
  assert.match(kotlin, /deviceLocked" to true/);
  assert.match(kotlin, /OnActivityEntersForeground/);
  assert.match(kotlin, /registerLockReceivers/);
});

test("expo-local-authentication is listed in app plugins", () => {
  const app = readFileSync(new URL("../../app.json", import.meta.url), "utf8");
  assert.match(app, /expo-local-authentication/);
});
