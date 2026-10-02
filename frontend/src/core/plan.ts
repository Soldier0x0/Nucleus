/**
 * Money planning maths — sinking funds, debts, net worth and the month-end projection.
 * All pure functions over the local DB, each with facts you can show in a "Why?".
 */
import type { DB, Debt, Fund, NetWorthSnapshot } from "./types";
import { monthTotals } from "./intelligence";
import { daysBetween, money, monthKey, monthLabel, num, todayISO } from "./format";
import type { Why } from "./intelligence";

export const fundSaved = (f: Fund) => f.contributions.reduce((s, c) => s + c.amount, 0);

export function fundProgress(f: Fund, today = todayISO()) {
  const saved = fundSaved(f);
  const pct = f.target > 0 ? Math.min(saved / f.target, 1) : 0;
  const left = Math.max(f.target - saved, 0);
  const days = f.targetDate ? daysBetween(today, f.targetDate) : undefined;
  const months = days !== undefined ? Math.max(days / 30.44, 0) : undefined;
  const perMonth = months && months > 0 ? left / months : undefined;
  return { saved, pct, left, days, perMonth, onTrack: perMonth === undefined || perMonth <= 0 ? true : undefined };
}

/** Simple reducing-balance payoff with a fixed monthly payment. */
export function debtPayoff(d: Debt) {
  const i = d.ratePct / 100 / 12;
  const pay = d.emi ?? 0;
  if (pay <= 0) return { months: NaN, interest: NaN, paid: d.principal - d.balance, pct: d.principal > 0 ? 1 - d.balance / d.principal : 0 };
  let bal = d.balance;
  let months = 0;
  let interest = 0;
  while (bal > 0 && months < 600) {
    const add = bal * i;
    if (pay <= add) return { months: Infinity, interest: Infinity, paid: d.principal - d.balance, pct: d.principal > 0 ? 1 - d.balance / d.principal : 0 };
    interest += add;
    bal = bal + add - pay;
    months++;
  }
  return { months, interest, paid: d.principal - d.balance, pct: d.principal > 0 ? 1 - d.balance / d.principal : 0 };
}

export const netWorthOf = (s: NetWorthSnapshot) => s.assets - s.liabilities;

export function netWorthSeries(db: DB) {
  return [...db.netWorth].sort((a, b) => a.date.localeCompare(b.date)).map((s) => ({ date: s.date, value: netWorthOf(s) }));
}

/**
 * Month-end projection: spend so far ÷ fraction of the month elapsed.
 * Deliberately naive and explained — no model, just arithmetic you can check.
 */
export function monthEndProjection(db: DB, today = todayISO()): { spent: number; projected: number; budget: number; over: number; elapsed: number; reliable: boolean; why: Why } {
  const mk = monthKey(today);
  const day = Number(today.slice(8, 10));
  const daysInMonth = new Date(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)), 0).getDate();
  const elapsed = day / daysInMonth;
  const t = monthTotals(db, mk);
  const projected = elapsed > 0 ? t.spent / elapsed : t.spent;
  const budget = db.budget.monthly;
  const cur = db.settings.currency;
  return {
    spent: t.spent,
    projected,
    budget,
    over: budget > 0 ? projected - budget : 0,
    elapsed,
    reliable: day >= 7,
    why: {
      summary: `You've spent ${money(t.spent, cur)} in the first ${day} of ${daysInMonth} days of ${monthLabel(mk)}. Keeping that pace means about ${money(projected, cur)} by month end.`,
      facts: [
        { label: "Spent so far", value: money(t.spent, cur) },
        { label: "Month elapsed", value: `${num(elapsed * 100, 0)}% (day ${day} of ${daysInMonth})` },
        { label: "Daily average", value: money(t.spent / Math.max(day, 1), cur) },
        { label: "Projected total", value: money(projected, cur) },
        ...(budget > 0 ? [{ label: "Budget", value: money(budget, cur) }, { label: projected > budget ? "Projected overspend" : "Projected to spare", value: money(Math.abs(projected - budget), cur) }] : []),
      ],
      rule: "Projection = spend so far ÷ share of the month elapsed. It assumes the rest of the month looks like the part you've lived, and is only shown from the 7th — before that a single big day would distort it.",
      ranking: "Shown as information only; it never creates an urgent item on its own.",
    },
  };
}

// ---------- actions ----------
export const upsertFund = (db: DB, f: Fund): DB => ({ ...db, funds: db.funds.some((x) => x.id === f.id) ? db.funds.map((x) => (x.id === f.id ? f : x)) : [...db.funds, f] });
export const upsertDebt = (db: DB, d: Debt): DB => ({ ...db, debts: db.debts.some((x) => x.id === d.id) ? db.debts.map((x) => (x.id === d.id ? d : x)) : [...db.debts, d] });
export const addSnapshot = (db: DB, s: NetWorthSnapshot): DB => ({ ...db, netWorth: [...db.netWorth.filter((x) => x.date !== s.date), s] });
