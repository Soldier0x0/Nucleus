/**
 * Attention composition: built-in rules (intelligence) + user rules, then the
 * done/snoozed/dismissed marks. Kept separate so `rules.ts` can reuse the statistics
 * in `intelligence.ts` without a circular import.
 */
import type { DB } from "./types";
import { attentionItems, type AttentionItem } from "./intelligence";
import { ruleAttention } from "./rules";
import { daysBetween, todayISO } from "./format";
import { moduleAlerts } from "./presets";
import { changeOvertimeLine } from "./cycle";

export const SNOOZE_CHOICES = [1, 3, 7, 15, 30] as const;
export const ATTENTION_PAGE = 4;

export function attentionPreview<T>(items: T[], expanded: boolean, page = ATTENTION_PAGE): T[] {
  return expanded ? items : items.slice(0, page);
}

export function snoozeStillPastDue(daysPastDue: number, choice: number): boolean {
  return daysPastDue > 0 && choice <= daysPastDue;
}

export function daysPastDue(due: string | undefined, today: string): number {
  if (!due) return 0;
  const span = daysBetween(due, today);
  return span > 0 ? span : 0;
}

function cycleAttention(db: DB): AttentionItem[] {
  const enabled = db.settings.modules.find((item) => item.id === "cycle")?.enabled;
  if (!enabled) return [];
  const line = changeOvertimeLine(db.cycle);
  if (!line) return [];
  return [{
    key: "cycle:bag-empty",
    module: "cycle",
    severity: "info",
    icon: "timer-sand",
    title: "Change timer is past the usual time",
    subtitle: line,
    score: 80,
    route: "/cycle/more",
    why: {
      summary: line,
      facts: [
        { label: "Bag", value: "Empty" },
        { label: "Home stash", value: "Does not cancel this" },
      ],
      rule: "Info when a change timer is past its usual time and the bag is empty.",
      ranking: "Ranked INFO by rule, then ordered by the timer.",
    },
  }];
}

export function allAttention(db: DB, today = todayISO()): AttentionItem[] {
  return [...attentionItems(db, today), ...cycleAttention(db), ...ruleAttention(db, today)].sort((a, b) => b.score - a.score);
}

/** Share of the card a finger must cross before snooze or done. A shorter drag snaps back. */
export const ATTENTION_SWIPE_PULL = 0.6;

export function attentionSwipeThreshold(width: number): number {
  return Math.max(1, Math.round(width * ATTENTION_SWIPE_PULL));
}

/** Swipe right snoozes. Swipe left marks done. Anything shorter changes nothing. */
export function attentionSwipeOutcome(dx: number, width: number): "snap-back" | "snooze" | "done" {
  const need = attentionSwipeThreshold(width);
  if (dx >= need) return "snooze";
  if (-dx >= need) return "done";
  return "snap-back";
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
