import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { collapseUpiTwins, filterInbox } from "./smsMoney.ts";

const t0 = Date.parse("2026-10-14T10:00:00Z");

test("bank texts: a UPI notice and the bank SMS for one payment become one line", () => {
  const { kept } = filterInbox([
    { sender: "PhonePe", body: "Paid ₹450 to Cafe Coffee", at: String(t0), app: "com.phonepe.app" },
    { sender: "AX-HDFCBK", body: "Rs.450.00 debited from a/c XX1234 to VPA cafe@ybl", at: String(t0 + 60_000), app: "com.google.android.apps.messaging" },
  ]);
  assert.equal(kept.length, 1);
});

test("bank texts: two same-amount payments from one sender, or 10+ minutes apart, stay separate", () => {
  const a = { kind: "debit" as const, amount: 100, sender: "AX-HDFCBK", at: String(t0) };
  assert.equal(collapseUpiTwins([a, { ...a, at: String(t0 + 60_000) }]).length, 2);
  assert.equal(collapseUpiTwins([a, { ...a, sender: "GPay", at: String(t0 + 11 * 60_000) }]).length, 2);
  assert.equal(collapseUpiTwins([a, { ...a, kind: "credit", sender: "GPay" }]).length, 2);
});

test("bank texts: the native listener keeps only money-looking notices and covers the chosen SMS apps", () => {
  const kt = readFileSync(new URL("../../modules/nucleus-android/android/src/main/java/com/nucleus/widgets/BankNoticeService.kt", import.meta.url), "utf8");
  assert.match(kt, /!looksLikeMoney\(body\)\) return/);
  for (const pkg of ["com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms", "com.truecaller", "com.jio.messages"]) assert.ok(kt.includes(`"${pkg}"`), pkg);
});
