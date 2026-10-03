import { addDays, addMonths } from "./format";
import { moneyCsv } from "./moneyWords";
import type { Txn } from "./types";

export type DeskTxn = {
  id: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  date: string;
  note?: string;
  item?: string;
  cash?: boolean;
  transfer?: boolean;
  balance?: number;
};

function spending(row: DeskTxn): boolean {
  return row.type === "expense" && !row.transfer;
}

export function monthFlow(rows: DeskTxn[], month: string): { in: number; out: number } {
  const inMonth = rows.filter((row) => row.date.slice(0, 7) === month && !row.transfer);
  return {
    in: inMonth.filter((row) => row.type === "income").reduce((sum, row) => sum + row.amount, 0),
    out: inMonth.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.amount, 0),
  };
}

export function categorySplit(rows: DeskTxn[], month: string): { category: string; amount: number }[] {
  const by: Record<string, number> = {};
  for (const row of rows) {
    if (row.date.slice(0, 7) !== month || !spending(row)) continue;
    by[row.category] = (by[row.category] ?? 0) + row.amount;
  }
  return Object.entries(by)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

export function balanceOverTime(rows: DeskTxn[]): { date: string; balance: number }[] {
  let running = 0;
  const points: { date: string; balance: number }[] = [];
  for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    if (typeof row.balance === "number") running = row.balance;
    else if (row.transfer) {
      /* A move between your own accounts does not change the combined balance. */
    } else if (row.type === "income") running += row.amount;
    else running -= row.amount;
    points.push({ date: row.date, balance: Math.round(running * 100) / 100 });
  }
  return points;
}

export function namedCategories(names: string[]): string[] {
  return names.map((name) => name.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export function unusedCategories(named: string[], rows: DeskTxn[]): string[] {
  const used = new Set(rows.map((row) => row.category));
  return named.filter((name) => !used.has(name));
}

export function repeatingBills(rows: DeskTxn[]): { name: string; amount: number; last: string; next: string }[] {
  const groups = new Map<string, DeskTxn[]>();
  for (const row of rows) {
    if (!spending(row) || !row.note) continue;
    const list = groups.get(row.note) ?? [];
    list.push(row);
    groups.set(row.note, list);
  }
  const bills: { name: string; amount: number; last: string; next: string }[] = [];
  for (const [name, list] of groups) {
    const months = new Set(list.map((row) => row.date.slice(0, 7)));
    if (months.size < 2) continue;
    const ordered = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const last = ordered[ordered.length - 1];
    bills.push({ name, amount: last.amount, last: last.date, next: addMonths(last.date, 1) });
  }
  return bills.sort((a, b) => a.next.localeCompare(b.next) || a.name.localeCompare(b.name));
}

export function dayBefore(nextDate: string): string {
  return addDays(nextDate, -1);
}

export function priceChange(rows: DeskTxn[], name: string): { previous: number; latest: number; changed: boolean } | null {
  const charges = rows
    .filter((row) => spending(row) && (row.note === name || row.category === name))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  if (charges.length < 2) return null;
  const previous = charges[charges.length - 2].amount;
  const latest = charges[charges.length - 1].amount;
  return { previous, latest, changed: previous !== latest };
}

export function cashRow(id: string, amount: number, category: string, date: string): DeskTxn {
  return { id, type: "expense", amount, category, date, cash: true, transfer: false };
}

export function yearlyMoneyCsv(rows: DeskTxn[], currency: string, year: string): string {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const txns: Txn[] = rows
    .filter((row) => row.date >= from && row.date <= to)
    .map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      category: row.category,
      date: row.date,
      note: row.note,
      item: row.item,
    }));
  return moneyCsv(txns, currency, from, to);
}

export function billReminders(rows: DeskTxn[], quiet: { enabled: boolean; from: number; to: number }, now = Date.now()): { key: string; title: string; body: string; at: Date; once: boolean }[] {
  return repeatingBills(rows).flatMap((bill) => {
    const [year, month, day] = dayBefore(bill.next).split("-").map(Number);
    const at = quietDelivery(new Date(year, (month || 1) - 1, day || 1, 9, 0, 0), quiet);
    if (at.getTime() <= now) return [];
    const change = priceChange(rows, bill.name);
    const body = change?.changed ? `The last charge was ${change.latest}, after ${change.previous}.` : "Due tomorrow.";
    return [{ key: `bill:${bill.name}:${bill.next}`, title: `${bill.name} is due tomorrow`, body, at, once: true }];
  });
}

export function quietDelivery(at: Date, quiet: { enabled: boolean; from: number; to: number }): Date {
  if (!quiet.enabled) return at;
  const hour = at.getHours();
  const overnight = quiet.from > quiet.to;
  const inside = overnight ? hour >= quiet.from || hour < quiet.to : hour >= quiet.from && hour < quiet.to;
  if (!inside) return at;
  const next = new Date(at.getTime());
  if (overnight && hour >= quiet.from) next.setDate(next.getDate() + 1);
  next.setHours(quiet.to, 0, 0, 0);
  return next;
}
