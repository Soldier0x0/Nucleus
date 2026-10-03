import { parseReceipt } from "./receipt";

export type PageBox = { x: number; y: number; w: number; h: number };

/** Crop matches the page. A small inset in the middle of the photo is not a scan. */
export function cropToPage(photo: { w: number; h: number }, page: PageBox): PageBox {
  const x = Math.max(0, Math.min(page.x, Math.max(0, photo.w - 1)));
  const y = Math.max(0, Math.min(page.y, Math.max(0, photo.h - 1)));
  const w = Math.max(1, Math.min(page.w, photo.w - x));
  const h = Math.max(1, Math.min(page.h, photo.h - y));
  return { x, y, w, h };
}

/** Amount, date, and shop come from the words on this phone. No cloud model. */
export function readReceiptWords(text: string): { shop: string; amount: number | null; date: string | null; source: "words" } {
  const read = parseReceipt(text);
  return { shop: read.merchant, amount: read.amount, date: read.date, source: "words" };
}

export function receiptCounts(confirmed: boolean): boolean {
  return confirmed;
}

export function flagMismatch(receiptAmount: number, debitAmount: number): boolean {
  return Math.round(receiptAmount * 100) !== Math.round(debitAmount * 100);
}
