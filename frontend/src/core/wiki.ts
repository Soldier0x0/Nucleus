import type { WikiPage } from "./types";

const LINK = /\[\[([^\]|#]+)(?:#[^\]]*)?\]\]/g;

/** Titles written as [[Page]]. The order is first appearance, without duplicates. */
export function linkedTitles(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of body.matchAll(LINK)) {
    const title = match[1].trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}

export function pageByTitle(pages: WikiPage[], title: string): WikiPage | undefined {
  const key = title.trim().toLowerCase();
  return pages.find((p) => p.title.trim().toLowerCase() === key);
}

export function backlinks(pages: WikiPage[], title: string): WikiPage[] {
  const key = title.trim().toLowerCase();
  return pages.filter((p) => p.title.trim().toLowerCase() !== key && linkedTitles(p.body).some((t) => t.toLowerCase() === key));
}
