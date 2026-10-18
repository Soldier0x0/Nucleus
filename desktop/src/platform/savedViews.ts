/**
 * Saved views (v0.14, generalized in v0.15): named filter sets for Money,
 * Papers, Travel and Media.
 *
 * Stored on the document's settings under a desktop-only key that is written
 * with a cast, the same pattern as `settings.desktopSync`: extra settings keys
 * survive normalizeDB, never cross pairing (settings do not sync) and pass
 * through file bundles because the name has no "sync" in it. The key must stay
 * out of the Settings type so the phone keeps its lean schema.
 */

export type SavedView = {
  id: string;
  name: string;
  section: "money" | "papers" | "travel" | "media";
  /** Month (money), tag (papers/media) or free-text query. */
  payload: { month?: string; tag?: string; query: string };
};

/** At most 20 views. Names trimmed; nameless or foreign shapes dropped. */
export function normalizeViews(raw: unknown): SavedView[] {
  const list = Array.isArray(raw) ? raw : [];
  const keyed: Record<string, string> = {};
  const out: SavedView[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const v = item as Record<string, unknown>;
    const nested = v.payload && typeof v.payload === "object" && !Array.isArray(v.payload) ? (v.payload as Record<string, unknown>) : {};
    const id = typeof v.id === "string" && v.id ? v.id : null;
    const name = typeof v.name === "string" && v.name.trim() ? v.name.trim().slice(0, 40) : null;
    const query = typeof (typeof nested.query === "string" ? nested.query : v.query) === "string" ? String(nested.query ?? v.query).trim().slice(0, 80) : "";
    if (!id || !name) continue;
    if (keyed[id]) continue;
    const payload: { month?: string; tag?: string; query: string } = { query };
    const month = typeof nested.month === "string" ? nested.month : typeof v.month === "string" ? v.month : "";
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) payload.month = month;
    const tag = typeof nested.tag === "string" ? nested.tag : typeof v.tag === "string" ? v.tag : "";
    if (tag) payload.tag = tag;
    keyed[id] = name;
    out.push({ id, name, section: SECTION_KEYS.has(v.section as string) ? (v.section as SavedView["section"]) : "money", payload });
  }
  return out.slice(0, 20);
}

const SECTION_KEYS = new Set(["money", "papers", "travel", "media"]);

export const VIEWS_KEY = "desktopViews";

export function readViews(db: { settings: Record<string, unknown> }): SavedView[] {
  return normalizeViews((db.settings as Record<string, unknown>)[VIEWS_KEY]);
}
