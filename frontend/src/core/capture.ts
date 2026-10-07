/**
 * Capture bar grammar (fixed, deterministic, documented):
 *   litres, total, and rate in any order, with optional date, time, km, station, full/partial
 *   a named saved vehicle becomes a fuel entry; otherwise fuel-like numbers are a Fuel expense
 *   <name> <amount> weekly|monthly|quarterly|yearly -> subscription
 *   <amount> <category> [note]               -> expense
 *   +<amount> <category> [note]              -> income
 */
import type { DB } from "./types";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./defaults";
import { classifyMoney } from "./moneyWords";
import { addFuel, addTxn, nextCycleDate, upsertSubscription } from "./actions";
import { estimateOdometer, parseFuelDraft } from "./fuelCapture";
import { money, num, todayISO, uid } from "./format";

export type Capture = { label: string; icon: string; apply: (db: DB) => DB } | { error: string };

const matchCat = (word: string, list: string[]) => list.find((c) => c.toLowerCase().startsWith(word.toLowerCase())) ?? "Other";

export function parseCapture(db: DB, input: string): Capture | null {
  const s = input.trim();
  if (!s) return null;
  const cur = db.settings.currency;
  const fuel = parseFuelDraft(db, s);
  if (fuel?.numbers) {
    const { litres, total, rate } = fuel.numbers;
    if (!fuel.vehicle) {
      return {
        icon: "arrow-up-bold-circle-outline",
        label: `Expense · ${money(total, cur)} · Fuel`,
        apply: (d) => addTxn(d, { id: uid(), type: "expense", amount: total, category: "Fuel", date: fuel.date || todayISO(), note: [litres ? `${litres} L` : "", fuel.station ?? ""].filter(Boolean).join(" · ") || undefined }),
      };
    }
    const v = fuel.vehicle;
    const known = fuel.odometer;
    const floor = Math.max(v.initialOdometer, ...db.fuel.filter((row) => row.vehicleId === v.id && !row.odometerEstimated).map((row) => row.odometer));
    if (known != null && known < floor) return { error: `Odometer must be ≥ ${num(floor, 0)}` };
    const estimated = known == null;
    const odo = known ?? estimateOdometer(db.fuel, v, fuel.date);
    const date = fuel.date ?? "";
    const stationBit = fuel.station ? ` · ${fuel.station}` : "";
    const odoBit = estimated ? " · odometer estimated" : ` · ${num(odo, 0)} km`;
    const kindBit = fuel.fillKind === "partial" ? " · partial" : fuel.fillKind === "full" ? " · full" : "";
    return {
      icon: "gas-station-outline",
      label: `Fuel · ${v.name} · ${litres} L · ${money(total, cur)} · ${num(rate, 2)}/L${kindBit}${odoBit}${stationBit}`,
      apply: (d) =>
        addFuel(d, {
          id: uid(),
          vehicleId: v.id,
          date,
          odometer: odo,
          odometerEstimated: estimated || undefined,
          fillKind: fuel.fillKind ?? "full",
          ...(fuel.loggedAt ? { loggedAt: fuel.loggedAt } : {}),
          ...(fuel.station ? { station: fuel.station } : {}),
          litres,
          total,
          price: rate,
        }),
    };
  }
  let m = s.match(/^(.+?)\s+([\d.]+)\s+(weekly|monthly|quarterly|yearly)$/i);
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
