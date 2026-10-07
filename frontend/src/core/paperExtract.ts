import type { Paper } from "./types";

export type PaperExtract = { number?: string; expiry?: string; insurer?: string; confidence: "high" | "low" };

const EXPIRY = /\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/;
const POLICY = /\b(?:policy|pol\.?)\s*(?:no\.?|number|#)?\s*[:.]?\s*([A-Z0-9][A-Z0-9\-/]{4,})\b/i;
const POLICY_LOOSE = /\b([A-Z]{2,}-\d{4,})\b/;

/** Best-effort fields from plain text. Never invents values when nothing matches. */
export function extractPaperFields(text: string): PaperExtract {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return { confidence: "low" };
  const expiryMatch = clean.match(EXPIRY);
  const policyMatch = clean.match(POLICY);
  const out: PaperExtract = { confidence: policyMatch || expiryMatch ? "high" : "low" };
  if (expiryMatch) {
    const [, y, m, d] = expiryMatch;
    out.expiry = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (policyMatch?.[1]) out.number = policyMatch[1].slice(0, 40);
  else {
    const loose = clean.match(POLICY_LOOSE);
    if (loose?.[1]) out.number = loose[1].slice(0, 40);
  }
  const insurer = clean.match(/\b(lic|hdfc|bajaj|tata aig|icici|sbi|reliance|go digit|acko)\b/i);
  if (insurer?.[1]) out.insurer = insurer[1];
  return out;
}

export function mergeExtract(paper: Paper, extract: PaperExtract): Paper {
  if (extract.confidence === "low") return paper;
  const next = { ...paper };
  if (extract.number && !next.number) next.number = extract.number;
  if (extract.expiry && !next.expiry) next.expiry = extract.expiry;
  if (extract.insurer && !next.insurer) next.insurer = extract.insurer;
  return next;
}

/** PDF data URIs sometimes carry readable ASCII in the base64 payload. */
export function extractFromPdfDataUri(uri: string): PaperExtract {
  if (!uri.startsWith("data:application/pdf;base64,")) return { confidence: "low" };
  try {
    const b64 = uri.slice("data:application/pdf;base64,".length);
    const bin =
      typeof atob === "function"
        ? atob(b64)
        : (globalThis as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer?.from(b64, "base64").toString("latin1") ?? "";
    const text = bin.replace(/[^\x20-\x7E\n]/g, " ");
    return extractPaperFields(text);
  } catch {
    return { confidence: "low" };
  }
}
