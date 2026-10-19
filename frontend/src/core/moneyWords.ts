/**
 * Fixed word list for Money. No model: a typed word either matches a row here
 * or it stays uncategorised so the person can name it themselves.
 */
import type { Txn } from "./types";
import { addDays, parseISO } from "./format";

export type MoneyHit = { category: string; item?: string };
export type MoneySuggestion = { label: string; hit: MoneyHit };
type Entry = { category: string; item?: string; words: string[] };

const EXPENSE: Entry[] = [
  { category: "Food", item: "Breakfast", words: ["breakfast", "idli", "dosa", "poha", "upma"] },
  { category: "Food", item: "Lunch", words: ["lunch"] },
  { category: "Food", item: "Dinner", words: ["dinner"] },
  { category: "Food", item: "Coffee", words: ["coffee", "cafe", "chai", "tea"] },
  { category: "Food", item: "Snacks", words: ["samosa", "pakora", "chips", "biscuit"] },
  { category: "Food", item: "Sweets", words: ["sweet", "sweets", "mithai"] },
  { category: "Food", item: "Meal", words: ["biryani", "pizza", "burger", "thali", "dominos", "kfc", "pizza hut", "popeyes"] },
  { category: "Food", item: "Delivery", words: ["swiggy", "zomato"] },
  { category: "Food", words: ["food"] },
  { category: "Groceries", item: "Carrot", words: ["carrot", "carrots"] },
  { category: "Groceries", item: "Vegetables", words: ["vegetable", "vegetables", "sabzi", "onion", "onions", "tomato", "tomatoes", "potato", "potatoes"] },
  { category: "Groceries", item: "Fruit", words: ["fruit", "apple", "banana"] },
  { category: "Groceries", item: "Milk", words: ["milk", "curd", "paneer"] },
  { category: "Groceries", item: "Staples", words: ["rice", "atta", "dal", "oil", "bread", "egg", "eggs"] },
  { category: "Groceries", words: ["groceries", "grocery", "instamart", "blinkit", "zepto", "bigbasket"] },
  { category: "Fuel", words: ["fuel", "petrol", "diesel", "cng", "ev charge", "charging"] },
  { category: "Vehicle", item: "PUC", words: ["puc", "pollution"] },
  { category: "Vehicle", item: "Insurance", words: ["motor policy", "bike insurance", "car insurance", "roadside", "rsa"] },
  { category: "Vehicle", item: "Service", words: ["service", "servicing", "workshop"] },
  { category: "Other", item: "Documents", words: ["passport", "licence", "license", "fastag", "registration", "paperwork"] },
  { category: "Vehicle", item: "Maintenance", words: ["maintenance", "oil change"] },
  { category: "Vehicle", item: "Accident", words: ["accident"] },
  { category: "Vehicle", item: "Repair", words: ["repair", "tyre", "tire", "battery"] },
  { category: "Vehicle", item: "Insurance", words: ["vehicle insurance"] },
  { category: "Vehicle", words: ["vehicle"] },
  { category: "Travel", item: "Cab", words: ["cab", "uber", "ola", "auto", "rickshaw"] },
  { category: "Travel", item: "Bike taxi", words: ["bike taxi", "biketaxi", "rapido"] },
  { category: "Travel", item: "Metro", words: ["metro"] },
  { category: "Travel", item: "Bus", words: ["bus"] },
  { category: "Travel", words: ["transport"] },
  { category: "Bills", item: "Phone", words: ["recharge", "phone bill", "phone"] },
  { category: "Bills", item: "Internet", words: ["internet", "wifi", "broadband"] },
  { category: "Bills", words: ["bill", "bills"] },
  { category: "Electricity", words: ["electricity", "power bill"] },
  { category: "Rent", words: ["rent"] },
  { category: "Shopping", item: "Clothes", words: ["clothes", "clothing", "shirt"] },
  { category: "Shopping", item: "Laundry", words: ["laundry"] },
  { category: "Shopping", words: ["shopping"] },
  { category: "Health", item: "Salon", words: ["salon", "haircut"] },
  { category: "Travel", item: "Parking", words: ["parking"] },
  { category: "Travel", item: "Toll", words: ["toll", "tollgate"] },
  { category: "Health", item: "Hospital", words: ["hospital"] },
  { category: "Health", item: "Doctor", words: ["doctor"] },
  { category: "Health", item: "Medicine", words: ["medicine", "pharmacy"] },
  { category: "Health", words: ["health"] },
  { category: "Entertainment", item: "Movie", words: ["movie", "movies", "cinema"] },
  { category: "Entertainment", item: "Concert", words: ["concert"] },
  { category: "Entertainment", item: "Comedy", words: ["standup", "stand up", "stand-up", "comedy"] },
  { category: "Entertainment", words: ["entertainment"] },
  { category: "Subscriptions", item: "Netflix", words: ["netflix"] },
  { category: "Subscriptions", words: ["subscription", "subscriptions"] },
  { category: "Travel", item: "Hotel", words: ["hotel"] },
  { category: "Travel", item: "Flight", words: ["flight"] },
  { category: "Travel", item: "Train", words: ["train"] },
  { category: "Travel", words: ["travel"] },
  { category: "Loan EMI", words: ["emi", "loan"] },
  { category: "Miscellaneous", words: ["misc", "miscellaneous"] },
];

const INCOME: Entry[] = [
  { category: "Salary", item: "Bonus", words: ["bonus"] },
  { category: "Salary", words: ["salary", "paycheck", "wages"] },
  { category: "Freelance", words: ["freelance", "invoice"] },
  { category: "Interest", words: ["interest"] },
  { category: "Dividend", words: ["dividend"] },
  { category: "Refund", words: ["refund"] },
  { category: "Gift", words: ["gift"] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const flat = (s: string) => norm(s).replace(/ /g, "");

function hasPhrase(text: string, phrase: string) {
  const hay = ` ${norm(text)} `;
  const needle = ` ${norm(phrase)} `;
  return needle.trim().length > 0 && hay.includes(needle);
}

function best(text: string, list: Entry[]): MoneyHit | null {
  let winner: { score: number; hit: MoneyHit } | null = null;
  for (const entry of list) {
    for (const word of entry.words) {
      if (!hasPhrase(text, word)) continue;
      const score = flat(word).length + (entry.item ? 100 : 0);
      const hit: MoneyHit = entry.item ? { category: entry.category, item: entry.item } : { category: entry.category };
      if (!winner || score > winner.score) winner = { score, hit };
    }
  }
  return winner?.hit ?? null;
}

export function classifyMoney(text: string, type: "expense" | "income"): MoneyHit | null {
  const clean = norm(text);
  if (!clean) return null;
  return best(clean, type === "income" ? INCOME : EXPENSE);
}

/**
 * v0.9.8 (plan 10.2): keep the last chips on screen while there is text, so a space or a
 * one-letter word does not make them vanish. They go when the note is cleared or saved.
 */
export function heldSuggestions<T>(previous: T[], next: T[], text: string): T[] {
  if (!text.trim()) return [];
  return next.length ? next : previous;
}

export function moneySuggestions(text: string, type: "expense" | "income", limit = 6): MoneySuggestion[] {
  const q = norm(text);
  const token = q.split(" ").filter(Boolean).pop() ?? "";
  if (token.length < 2) return [];
  const qFlat = flat(q);
  const list = type === "income" ? INCOME : EXPENSE;
  const found: { label: string; hit: MoneyHit; rank: number }[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    let rank = Infinity;
    for (const word of entry.words) {
      const wordFlat = flat(word);
      if (wordFlat.startsWith(token) || wordFlat.startsWith(qFlat) || norm(word).startsWith(q)) rank = Math.min(rank, wordFlat.length);
    }
    if (rank === Infinity) continue;
    const key = `${entry.category}:${entry.item ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const hit: MoneyHit = entry.item ? { category: entry.category, item: entry.item } : { category: entry.category };
    found.push({ label: entry.item ?? entry.category, hit, rank });
  }
  return found
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ label, hit }) => ({ label, hit }));
}

/** A typed Other name replaces Other. Blank stays Other. */
export function categoryFromOther(typed: string): string {
  const name = typed.replace(/\s+/g, " ").trim().slice(0, 40);
  return name || "Other";
}

export function itemTotals(txns: Pick<Txn, "type" | "category" | "item" | "amount">[], category: string): [string, number][] {
  const by: Record<string, number> = {};
  for (const t of txns) {
    if (t.type !== "expense" || t.category !== category || !t.item) continue;
    by[t.item] = (by[t.item] ?? 0) + t.amount;
  }
  return Object.entries(by).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export type ExportSpan = "month" | "30" | "60" | "custom";

export function exportBounds(today: string, span: ExportSpan, from?: string, to?: string): { from: string; to: string } {
  if (span === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (span === "30") return { from: addDays(today, -29), to: today };
  if (span === "60") return { from: addDays(today, -59), to: today };
  const iso = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : today);
  const a = iso(from);
  const b = iso(to);
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

function weekStart(iso: string) {
  const day = parseISO(iso).getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(iso, delta);
}

function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const end = to.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key === end) break;
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function weeksBetween(from: string, to: string) {
  const out: string[] = [];
  let cursor = weekStart(from);
  const end = weekStart(to);
  while (cursor <= end) {
    out.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return out;
}

function cell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function money2(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** UTF-8 CSV: monthly totals, weekly totals (Monday), then each transaction. */
export function moneyCsv(txns: Txn[], currency: string, from: string, to: string): string {
  const rows = txns.filter((t) => t.date >= from && t.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const lines = ["Nucleus spending", `From,${from}`, `To,${to}`, `Currency,${currency}`, "", "Monthly totals", "Month,Spent,Income"];
  for (const month of monthsBetween(from, to)) {
    const inMonth = rows.filter((t) => t.date.slice(0, 7) === month);
    const spent = inMonth.filter((t) => t.type === "expense" && !t.transfer).reduce((s, t) => s + t.amount, 0);
    const income = inMonth.filter((t) => t.type === "income" && !t.transfer).reduce((s, t) => s + t.amount, 0);
    lines.push([month, money2(spent), money2(income)].join(","));
  }
  lines.push("", "Weekly totals", "Week starting,Spent,Income");
  for (const week of weeksBetween(from, to)) {
    const next = addDays(week, 7);
    const inWeek = rows.filter((t) => t.date >= week && t.date < next);
    const spent = inWeek.filter((t) => t.type === "expense" && !t.transfer).reduce((s, t) => s + t.amount, 0);
    const income = inWeek.filter((t) => t.type === "income" && !t.transfer).reduce((s, t) => s + t.amount, 0);
    lines.push([week, money2(spent), money2(income)].join(","));
  }
  lines.push("", "Transactions", "Date,Type,Category,Item,Amount,Note");
  for (const t of rows) lines.push([t.date, t.type, cell(t.category), cell(t.item ?? ""), money2(t.amount), cell(t.note ?? "")].join(","));
  return `\uFEFF${lines.join("\n")}\n`;
}
