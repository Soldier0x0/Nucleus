import type { Paper, PaperTag } from "./types";

/**
 * Phase 9.6: one vault, multi-tag. The fixed sections a paper can sit in,
 * aligned with the app's menu sections (Vehicle, Health, Money, Life →
 * Travel/Home) plus Other.
 */
export const PAPER_TAGS: readonly PaperTag[] = ["Vehicle", "Health", "Money", "Home", "Travel", "Other"];

const TAG_SET = new Set<string>(PAPER_TAGS);

export function isPaperTag(value: unknown): value is PaperTag {
  return typeof value === "string" && TAG_SET.has(value);
}

/**
 * Old records only had a kind. The migration maps it to sections:
 * insurance/puc/registration/roadside → Vehicle, health/medical → Health,
 * money/receipt → Money, home/appliance → Home, travel → Travel, else Other.
 * The app's own kinds stay sensible: licence/fastag/PA → Vehicle, warranty →
 * Home, passport → Travel.
 */
export function paperTagsFromKind(kind: string): PaperTag[] {
  const k = typeof kind === "string" ? kind.trim().toLowerCase() : "";
  if (/insurance|puc|registration|roadside|licen[cs]e|fastag|personal[ _-]?accident/.test(k)) return ["Vehicle"];
  if (/health|medical/.test(k)) return ["Health"];
  if (/money|receipt/.test(k)) return ["Money"];
  if (/home|appliance|warranty/.test(k)) return ["Home"];
  if (/travel|passport/.test(k)) return ["Travel"];
  return ["Other"];
}

/** `undefined` when the snapshot has no tags array (old record); [] stays []. */
export function normalizePaperTags(raw: unknown): PaperTag[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: PaperTag[] = [];
  for (const value of raw) {
    if (isPaperTag(value) && !out.includes(value)) out.push(value);
  }
  return out;
}

/** Sections to show this paper under. Kind-only records fall back to their kind. */
export function effectivePaperTags(paper: Pick<Paper, "kind" | "tags">): PaperTag[] {
  return Array.isArray(paper.tags) ? paper.tags : paperTagsFromKind(paper.kind);
}

export function paperHasTag(paper: Pick<Paper, "kind" | "tags">, tag: PaperTag): boolean {
  return effectivePaperTags(paper).includes(tag);
}

export type PaperTagFilter = PaperTag | "All";

/** Filter the one vault: "All" (or no tag) keeps every paper in place, never copies. */
export function papersByTag(papers: Paper[], tag?: PaperTagFilter | null): Paper[] {
  if (!tag || tag === "All") return papers;
  return papers.filter((paper) => paperHasTag(paper, tag));
}

/** Pure delete of one paper id. The action layer handles files, links and reminders. */
export function withoutPaper(papers: Paper[], id: string): Paper[] {
  return papers.filter((paper) => paper.id !== id);
}
