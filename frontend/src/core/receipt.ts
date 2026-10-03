/**
 * Receipt text. A pasted or shared bill is read with fixed rules.
 * No photo is scanned and no model is loaded.
 */
export type ReceiptRead = { merchant: string; amount: number | null; date: string | null; lines: number };

const TOTAL = /(?:grand\s+total|amount\s+due|balance\s+due|total\s+amount|net\s+payable|total)/i;

function moneyOf(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n >= 10_000_000) return null;
  return Math.round(n * 100) / 100;
}

function validDate(y: string, month: string, day: string): string | null {
  const m = month.padStart(2, "0");
  const d = day.padStart(2, "0");
  const iso = `${y}-${m}-${d}`;
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== Number(y) || dt.getMonth() + 1 !== Number(m) || dt.getDate() !== Number(d)) return null;
  return iso;
}

function dateFrom(line: string): string | null {
  const iso = line.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return validDate(iso[1], iso[2], iso[3]);
  const stamped = line.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](20\d{2})\b/);
  if (!stamped) return null;
  const a = Number(stamped[1]);
  const b = Number(stamped[2]);
  if (a > 12) return validDate(stamped[3], String(b), String(a));
  if (b > 12) return validDate(stamped[3], String(a), String(b));
  return validDate(stamped[3], String(b), String(a));
}

export function parseReceipt(text: string): ReceiptRead {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let amount: number | null = null;
  const totalLine = [...lines].reverse().find((l) => TOTAL.test(l));
  if (totalLine) {
    const nums = [...totalLine.matchAll(/[0-9]{1,7}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?/g)];
    const last = nums[nums.length - 1];
    if (last) amount = moneyOf(last[0]);
  }
  let date: string | null = null;
  for (const line of lines) {
    date = dateFrom(line);
    if (date) break;
  }
  const skip = /total|gst|cgst|sgst|tax|thank|invoice|bill|date|qty|amount|cash|upi|card|subtotal/i;
  const merchant = lines.find((l) => /[a-z]/i.test(l) && !skip.test(l) && !dateFrom(l)) ?? "";
  return { merchant: merchant.slice(0, 80), amount, date, lines: lines.length };
}

/** A shared note is a receipt only when it is more than one line and names a total. */
export function looksLikeReceipt(text: string): boolean {
  return text.includes("\n") && TOTAL.test(text) && parseReceipt(text).amount != null;
}
