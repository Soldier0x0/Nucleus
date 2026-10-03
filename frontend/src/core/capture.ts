/**
 * Capture bar grammar (fixed, deterministic, documented):
 *   fuel <litres>L <total> [odometer]        -> fuel entry for default vehicle
 *   <name> <amount> weekly|monthly|quarterly|yearly -> subscription
 *   <amount> <category> [note]               -> expense
 *   +<amount> <category> [note]              -> income
 */
import type { DB } from "./types";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./defaults";
import { classifyMoney } from "./moneyWords";
import { addFuel, addTxn, nextCycleDate, upsertSubscription } from "./actions";
import { currentOdometer } from "./intelligence";
import { money, num, todayISO, uid } from "./format";

export type Capture = { label: string; icon: string; apply: (db: DB) => DB } | { error: string };

const matchCat = (word: string, list: string[]) => list.find((c) => c.toLowerCase().startsWith(word.toLowerCase())) ?? "Other";

export function parseCapture(db: DB, input: string): Capture | null {
  const s = input.trim();
  if (!s) return null;
  const cur = db.settings.currency;
  let m = s.match(/^fuel\s+([\d.]+)\s*l\s+([\d.]+)(?:\s+(\d+))?$/i);
  if (m) {
    const v = db.vehicles.find((x) => x.id === db.settings.defaultVehicleId) ?? db.vehicles[0];
    if (!v) return { error: "Add a vehicle first" };
    const litres = Number(m[1]), total = Number(m[2]);
    const odo = m[3] ? Number(m[3]) : currentOdometer(db, v);
    if (odo < currentOdometer(db, v)) return { error: `Odometer must be ≥ ${num(currentOdometer(db, v), 0)}` };
    return { icon: "gas-station-outline", label: `Fuel · ${v.name} · ${litres} L · ${money(total, cur)} · ${num(odo, 0)} km`, apply: (d) => addFuel(d, { id: uid(), vehicleId: v.id, date: todayISO(), odometer: odo, litres, total, price: Number((total / litres).toFixed(2)) }) };
  }
  m = s.match(/^(.+?)\s+([\d.]+)\s+(weekly|monthly|quarterly|yearly)$/i);
  if (m) {
    const name = m[1][0].toUpperCase() + m[1].slice(1), amount = Number(m[2]), cycle = m[3].toLowerCase() as any;
    return { icon: "autorenew", label: `Subscription · ${name} · ${money(amount, cur)} ${cycle}`, apply: (d) => upsertSubscription(d, { id: uid(), name, amount, cycle, nextRenewal: nextCycleDate(todayISO(), cycle), category: "Subscriptions", active: true }) };
  }
  m = s.match(/^(\+)?([\d.]+)\s+(\S+)(?:\s+(.*))?$/);
  if (m) {
    const income = !!m[1], amount = Number(m[2]);
    if (!(amount > 0)) return { error: "Amount must be above 0" };
    const typed = (m[4] ?? "").trim();
    const hit = classifyMoney([m[3], typed].filter(Boolean).join(" "), income ? "income" : "expense");
    const category = hit?.category ?? matchCat(m[3], income ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);
    const item = hit?.item;
    const note = (hit ? typed || (m[3].toLowerCase() === category.toLowerCase() ? "" : m[3]) : [category === "Other" ? m[3] : "", typed].filter(Boolean).join(" ")).trim() || undefined;
    const detail = [category, item, note].filter((part, i, all) => part && all.indexOf(part) === i).join(" · ");
    return { icon: income ? "arrow-down-bold-circle-outline" : "arrow-up-bold-circle-outline", label: `${income ? "Income" : "Expense"} · ${money(amount, cur)} · ${detail}`, apply: (d) => addTxn(d, { id: uid(), type: income ? "income" : "expense", amount, category, date: todayISO(), note, ...(item ? { item } : {}) }) };
  }
  return { error: "Try: 450 food lunch · fuel 5.4L 560 · netflix 649 monthly" };
}
