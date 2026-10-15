/**
 * Phase D1 compatibility gate: the desktop platform layer must read and write
 * exactly what the phone's core/crypto.ts and core/security.ts do.
 *
 * The phone modules run here through the node:test stubs (expo-crypto is backed
 * by node:crypto; storage stubs are inert). The desktop modules are imported
 * straight from desktop/src/platform and must stay free of Tauri imports.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { gcm } from "@noble/ciphers/aes.js";
import * as phone from "./crypto.ts";
import * as desk from "../../../desktop/src/platform/crypto.ts";
import { hashPin, isValidPin, verifyPinRecord, type PinRecord } from "../../../desktop/src/platform/security.ts";

// ---------- pinned fixtures ----------
// Generated once by the phone's own construction (NCE1 envelope and
// PBKDF2-100k password envelope). If either side drifts, these fail loudly.
const FIXTURE_KEY_B64 = "hmLKM8aqWLbGFlDuiDau6/CpgcETBRfLEPDu+Q9BSyc=";
const FIXTURE_ENVELOPE = "NCE1.AAECAwQFBgcICQoL.GgYSmpQfHNJ6SEZnGUcS0PyxOfr7AlAa7ER1K7iiF07m4rZcGvAZWHnZZUy06ucapXM+cgAavhQFt6d543BGYuk=";
const FIXTURE_PLAIN = '{"note":"café — naïve · ₹1,234","ok":true}';
const FIXTURE_PW_SALT = "AQIDBAUGBwgJCgsMDQ4PEA==";
const FIXTURE_PW_IV = "ZWZnaGlqa2xtbm9w";
const FIXTURE_PW_CT = "7LHkIoeRvvv0A3yBBiA/rXT+KacI0A6Ow2Rw5dYLJup6QsXvCEIG/ElhudR0OT5ylpE544PL6q84NRDbx2u+d5X2DsKIhmaGftPykpAUBWw=";
const FIXTURE_PW_PLAIN = '{"format":"nucleus-backup","schema":1,"note":"café — naïve"}';
const FIXTURE_PW_SECRET = "fixture-password-123";
const FIXTURE_PIN_SALT = "fixture-salt-0001";
const FIXTURE_PIN_HASH = "65a62930a528d5ff10e8db02f6db0a3c09eb9fa391d372b28edba604ed5c0499";

const TEXT = "Hello, café — naïve · ₹1,234 · 日本語";
const KEY = desk.fromB64(FIXTURE_KEY_B64);

test("desktop opens an envelope sealed by the phone", () => {
  const sealed = phone.sealString(TEXT, KEY);
  assert.equal(desk.isEncrypted(sealed), true);
  assert.equal(desk.openString(sealed, KEY), TEXT);
});

test("the pinned phone-written envelope stays readable on desktop", () => {
  assert.equal(desk.openString(FIXTURE_ENVELOPE, KEY), FIXTURE_PLAIN);
});

test("desktop envelopes carry the phone's NCE1 shape and open with its primitives", () => {
  const sealed = desk.sealString(TEXT, KEY);
  assert.equal(phone.isEncrypted(sealed), true);
  const [ivB64, ctB64] = sealed.slice("NCE1.".length).split(".");
  const plain = phone.fromUtf8(gcm(KEY, phone.fromB64(ivB64)).decrypt(phone.fromB64(ctB64)));
  assert.equal(plain, TEXT);
  assert.equal(phone.fromB64(ivB64).length, 12);
});

test("a tampered envelope is refused on desktop", () => {
  const sealed = desk.sealString(TEXT, KEY);
  const mut = sealed.slice(0, -2) + (sealed.endsWith("AA") ? "BB" : "AA");
  assert.throws(() => desk.openString(mut, KEY), desk.DataUnreadableError);
});

test("base64 and utf-8 ports agree with the phone for tricky text", () => {
  for (const s of [TEXT, "ascii", "ıııı", "𝒜", "a".repeat(1000)]) {
    const bytes = desk.toUtf8(s);
    assert.deepEqual([...phone.toUtf8(s)], [...bytes]);
    assert.equal(desk.fromUtf8(bytes), s);
    assert.equal(phone.fromUtf8(phone.fromB64(desk.toB64(bytes))), s);
    assert.deepEqual([...phone.fromB64(phone.toB64(bytes))], [...desk.fromB64(desk.toB64(bytes))]);
  }
});

test("password envelopes decrypt across implementations in both directions", async () => {
  const deskEnv = await desk.encryptWithPassword(TEXT, "correct-horse-battery");
  assert.equal(await phone.decryptWithPassword(deskEnv, "correct-horse-battery"), TEXT);

  const phoneEnv = await phone.encryptWithPassword(TEXT, "correct-horse-battery");
  assert.equal(await desk.decryptWithPassword(phoneEnv, "correct-horse-battery"), TEXT);

  assert.equal(deskEnv.kdf, "pbkdf2-sha256");
  assert.equal(deskEnv.iterations, phone.PBKDF2_ITERATIONS);
  assert.equal(deskEnv.iterations, 100_000);
  assert.equal(desk.fromB64(deskEnv.salt).length, 16);
  assert.equal(desk.fromB64(deskEnv.iv).length, 12);
});

test("the pinned password envelope opens on both sides", async () => {
  const env = { kdf: "pbkdf2-sha256" as const, iterations: 100_000, salt: FIXTURE_PW_SALT, iv: FIXTURE_PW_IV, ct: FIXTURE_PW_CT };
  assert.equal(await desk.decryptWithPassword(env, FIXTURE_PW_SECRET), FIXTURE_PW_PLAIN);
  assert.equal(await phone.decryptWithPassword(env, FIXTURE_PW_SECRET), FIXTURE_PW_PLAIN);
  await assert.rejects(() => desk.decryptWithPassword(env, "wrong-password"));
  await assert.rejects(() => phone.decryptWithPassword(env, "wrong-password"));
});

test("password strength label matches the phone everywhere", () => {
  for (const pw of ["", "1234", "password1", "short", "Correct-Horse-9", "x".repeat(24), "aaaaaaaaaaaa", "Str0ng!Passphrase-2026"]) {
    assert.deepEqual(desk.passwordStrength(pw), phone.passwordStrength(pw), pw);
  }
});

test("PIN hash port matches the phone's iterated SHA-256 record", async () => {
  assert.equal(await hashPin("1234", FIXTURE_PIN_SALT), FIXTURE_PIN_HASH);
  const record: PinRecord = { salt: FIXTURE_PIN_SALT, h: FIXTURE_PIN_HASH };
  assert.equal(await verifyPinRecord(record, "1234"), true);
  assert.equal(await verifyPinRecord(record, "1235"), false);
  assert.equal(await verifyPinRecord({ salt: "", h: "" }, "1234"), false);
});

test("PIN rules match the phone's digit rule", () => {
  assert.equal(isValidPin("1234"), true);
  assert.equal(isValidPin("12345"), true);
  assert.equal(isValidPin("123"), false);
  assert.equal(isValidPin("12ab"), false);
  assert.equal(isValidPin(""), false);
});
