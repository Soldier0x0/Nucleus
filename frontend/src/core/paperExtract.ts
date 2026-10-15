import type { Paper, PaperTag } from "./types";
import { PAPER_TAGS } from "./paperTags";

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

/** Words that hint at a section. Checked against the file name and typed fields. */
const TAG_HINTS: { tag: PaperTag; words: RegExp }[] = [
  { tag: "Vehicle", words: /\b(insurance|policy|motor|vehicle|bike|scooter|car|rc|registration|licen[cs]e|puc|pollution|fastag|roadside|challan|driving)\b/i },
  { tag: "Health", words: /\b(health|medical|mediclaim|hospital|doctor|prescription|medicine|clinic|diagnos\w*|vaccin\w*)\b/i },
  { tag: "Money", words: /\b(money|receipt|invoice|payment|salary|bank|cheque|check|statement|bill|tax)\b/i },
  { tag: "Home", words: /\b(home|house|appliance|warranty|rent|lease|property|electricity|plumb\w*)\b/i },
  { tag: "Travel", words: /\b(travel|passport|visa|ticket|boarding|flight|train|hotel|itinerary|booking|airline)\b/i },
];

const GENERIC_NAME = /^(img|image|photo|pic|scan|scanner|document|doc|file|download|whatsapp|screenshot|untitled)[\s\d]*$/i;

/** Sections that fit the file name and typed words. Empty when nothing matches. */
export function suggestPaperTags(...texts: (string | undefined)[]): PaperTag[] {
  const hay = texts
    .filter((text): text is string => typeof text === "string" && !!text.trim())
    .join(" ")
    .replace(/[_+]+/g, " ")
    .replace(/[-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!hay) return [];
  const out: PaperTag[] = [];
  for (const hint of TAG_HINTS) {
    if (hint.words.test(hay) && !out.includes(hint.tag)) out.push(hint.tag);
  }
  return out.filter((tag) => PAPER_TAGS.includes(tag));
}

/** A readable title from a file name, or nothing when it looks generic or empty. */
export function suggestPaperTitle(fileName?: string): string | undefined {
  if (!fileName?.trim()) return undefined;
  const base = fileName.trim().split(/[\\/]/).pop() ?? "";
  const words = base
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[_+]+/g, " ")
    .replace(/[-.()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (words.length < 3 || words.length > 80) return undefined;
  if (!/[a-z]/i.test(words) || GENERIC_NAME.test(words)) return undefined;
  return words.slice(0, 60);
}

export type PaperSuggestion = { title?: string; tags: PaperTag[] };

/** Everything the sheet may offer, as data. The UI applies it only on a tap. */
export function suggestPaper(input: { fileName?: string; typed?: string }): PaperSuggestion {
  const tags = suggestPaperTags(input.fileName, input.typed);
  const title = suggestPaperTitle(input.fileName);
  const out: PaperSuggestion = { tags };
  if (title) out.title = title;
  return out;
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
