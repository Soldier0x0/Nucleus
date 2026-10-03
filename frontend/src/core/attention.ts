/**
 * Attention composition: built-in rules (intelligence) + user rules, then the
 * done/snoozed/dismissed marks. Kept separate so `rules.ts` can reuse the statistics
 * in `intelligence.ts` without a circular import.
 */
import type { DB } from "./types";
import { attentionItems, type AttentionItem } from "./intelligence";
import { ruleAttention } from "./rules";
import { todayISO } from "./format";
import { moduleAlerts } from "./presets";

export function allAttention(db: DB, today = todayISO()): AttentionItem[] {
  return [...attentionItems(db, today), ...ruleAttention(db, today)].sort((a, b) => b.score - a.score);
}

export function visibleAttention(db: DB, today = todayISO()) {
  const open = allAttention(db, today).filter((i) => {
    const m = db.attention[i.key];
    if (!m) return true;
    if (m.status === "snoozed") return !!m.until && m.until <= today;
    return false;
  });
  return moduleAlerts(db, open);
}
