/**
 * Local Intelligence Engine — deterministic, explainable, no AI.
 * statistics -> forecasts/anomalies -> attention items (prioritized) -> "Why?" explanations.
 */
import type { DB, Vehicle } from "./types";
import { addMonths, daysBetween, fmtDate, mean, median, money, monthKey, monthLabel, num, todayISO } from "./format";

export type Fact = { label: string; value: string };
export type Why = { summary: string; facts: Fact[]; rule: string; ranking: string };
export type Severity = "urgent" | "upcoming" | "info";
export type AttentionItem = {
  key: string;
  module: "vehicles" | "money";
  severity: Severity;
  icon: string;
  title: string;
  subtitle: string;
  score: number;
  why: Why;
  route?: string;
  subscriptionId?: string;
};

const SEV_WEIGHT: Record<Severity, number> = { urgent: 300, upcoming: 200, info: 100 };
const rankText = (sev: Severity, basis: string) => `Ranked ${sev.toUpperCase()} by rule, then ordered by ${basis}. Higher severity always outranks lower.`;

// ---------------- Vehicles ----------------
export function currentOdometer(db: DB, v: Vehicle) {
  const odos = [v.initialOdometer, ...db.fuel.filter((f) => f.vehicleId === v.id).map((f) => f.odometer), ...db.services.filter((s) => s.vehicleId === v.id).map((s) => s.odometer)];
  return Math.max(...odos);
}

export type MileagePoint = { date: string; value: number };

export function vehicleStats(db: DB, v: Vehicle) {
  const fuel = db.fuel.filter((f) => f.vehicleId === v.id).sort((a, b) => a.odometer - b.odometer);
  const mileage: MileagePoint[] = [];
  for (let i = 1; i < fuel.length; i++) {
    const dist = fuel[i].odometer - fuel[i - 1].odometer;
    if (dist > 0 && fuel[i].litres > 0) mileage.push({ date: fuel[i].date, value: dist / fuel[i].litres });
  }
  const totalFuelCost = fuel.reduce((s, f) => s + f.total, 0);
  const distanceTracked = fuel.length > 1 ? fuel[fuel.length - 1].odometer - fuel[0].odometer : 0;
  const costForDistance = fuel.slice(1).reduce((s, f) => s + f.total, 0);
  const costPerKm = distanceTracked > 0 ? costForDistance / distanceTracked : NaN;
  const avgMileage = mileage.length ? mean(mileage.map((m) => m.value)) : NaN;
  const lastMileage = mileage.length ? mileage[mileage.length - 1].value : NaN;
  const thisMonth = monthKey(todayISO());
  const monthFuel = fuel.filter((f) => monthKey(f.date) === thisMonth).reduce((s, f) => s + f.total, 0);
  const serviceCost = db.services.filter((s) => s.vehicleId === v.id).reduce((s, x) => s + x.cost, 0);
  return { fuel, mileage, totalFuelCost, distanceTracked, costPerKm, avgMileage, lastMileage, monthFuel, serviceCost, odometer: currentOdometer(db, v), service: serviceEstimate(db, v) };
}

export function serviceEstimate(db: DB, v: Vehicle) {
  const svc = db.services.filter((s) => s.vehicleId === v.id && (s.kind === "general" || s.kind === "oil")).sort((a, b) => a.odometer - b.odometer);
  const intervals: number[] = [];
  for (let i = 1; i < svc.length; i++) intervals.push(svc[i].odometer - svc[i - 1].odometer);
  const fromHistory = svc.length >= 3;
  const interval = fromHistory ? Math.round(mean(intervals) / 50) * 50 : v.serviceIntervalKm;
  const odo = currentOdometer(db, v);
  const lastOdo = svc.length ? svc[svc.length - 1].odometer : v.initialOdometer;
  const since = odo - lastOdo;
  const remaining = interval - since;
  const facts: Fact[] = fromHistory
    ? [
        ...intervals.map((d, i) => ({ label: `Interval ${i + 1}`, value: `${num(d, 0)} km` })),
        { label: "Average interval", value: `≈ ${num(interval, 0)} km` },
        { label: "Median interval", value: `${num(median(intervals), 0)} km` },
        { label: "Since last service", value: `${num(since, 0)} km` },
      ]
    : [
        { label: "Services logged", value: `${svc.length} of 3 needed` },
        { label: "Configured interval", value: `${num(interval, 0)} km` },
        { label: "Since last service", value: `${num(since, 0)} km` },
      ];
  const explanation = fromHistory
    ? `Your last ${intervals.length} service intervals averaged about ${num(interval, 0)} km. You are ${num(since, 0)} km past the last service.`
    : `Using your configured interval of ${num(interval, 0)} km. Log ${3 - svc.length} more general/oil service${3 - svc.length === 1 ? "" : "s"} and Tessera will learn your real interval.`;
  return { interval, fromHistory, intervals, since, remaining, lastOdo, count: svc.length, facts, explanation, lastDate: svc[svc.length - 1]?.date };
}

// ---------------- Money ----------------
export function monthTotals(db: DB, mk: string) {
  const txns = db.txns.filter((t) => monthKey(t.date) === mk);
  const spent = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const byCat: Record<string, number> = {};
  txns.filter((t) => t.type === "expense").forEach((t) => (byCat[t.category] = (byCat[t.category] ?? 0) + t.amount));
  const categories = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  return { txns, spent, income, categories };
}

export function monthSeries(db: DB, n: number, category?: string) {
  const cur = monthKey(todayISO());
  const out: { key: string; label: string; value: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = monthKey(addMonths(cur + "-01", -i));
    const value = db.txns.filter((t) => t.type === "expense" && monthKey(t.date) === key && (!category || t.category === category)).reduce((s, t) => s + t.amount, 0);
    out.push({ key, label: monthLabel(key), value });
  }
  return out;
}

export type Insight = { key: string; icon: string; title: string; why: Why; kind: "trend" | "anomaly" };

export function moneyInsights(db: DB): Insight[] {
  const cur = db.settings.currency;
  const out: Insight[] = [];
  const thisMonth = monthKey(todayISO());
  const dayOfMonth = Number(todayISO().slice(8, 10));
  const cats = Array.from(new Set(db.txns.filter((t) => t.type === "expense").map((t) => t.category)));
  for (const c of cats) {
    const series = monthSeries(db, 7, c);
    const past = series.slice(0, 6).filter((m) => m.value > 0);
    const now = series[6].value;
    // anomaly: this month vs. average of previous months with data
    if (past.length >= 3 && now > 0) {
      const avg = mean(past.map((m) => m.value));
      const ratio = now / avg;
      if (ratio >= 1.3 && now - avg > 200) {
        out.push({
          key: `anom:${c}:${thisMonth}`,
          kind: "anomaly",
          icon: "chart-bell-curve-cumulative",
          title: `${c} this month is ${num((ratio - 1) * 100, 0)}% above your ${past.length}-month average`,
          why: {
            summary: `${money(now, cur)} spent on ${c} so far in ${monthLabel(thisMonth)} (day ${dayOfMonth}), versus a typical ${money(avg, cur)} per month.`,
            facts: [...past.map((m) => ({ label: m.label, value: money(m.value, cur) })), { label: `${monthLabel(thisMonth)} (so far)`, value: money(now, cur) }, { label: "Average", value: money(avg, cur) }],
            rule: "Flag when the current month exceeds the average of prior months by at least 30% (and the difference is meaningful). Needs 3+ months of history.",
            ranking: rankText("info", "size of the deviation"),
          },
        });
      }
    }
    // trend: last 4 complete months strictly increasing
    const complete = series.slice(2, 6);
    if (complete.every((m) => m.value > 0) && complete.every((m, i) => i === 0 || m.value > complete[i - 1].value)) {
      const growth = (complete[3].value / complete[0].value - 1) * 100;
      out.push({
        key: `trend:${c}:${thisMonth}`,
        kind: "trend",
        icon: "trending-up",
        title: `${c} spending is trending up`,
        why: {
          summary: `${c} has risen for 4 months in a row, up ${num(growth, 0)}% overall.`,
          facts: complete.map((m) => ({ label: m.label, value: money(m.value, cur) })),
          rule: "Flag when the last 4 complete months each increase over the previous month.",
          ranking: rankText("info", "growth rate"),
        },
      });
    }
  }
  return out;
}

// ---------------- Attention Center ----------------
function expiryItem(db: DB, v: Vehicle, doc: "Insurance" | "PUC", date: string | undefined, today: string): AttentionItem | null {
  if (!date) return null;
  const d = daysBetween(today, date);
  if (d > 30) return null;
  const sev: Severity = d <= 7 ? "urgent" : "upcoming";
  const title = d < 0 ? `${v.name} ${doc} expired` : `${v.name} ${doc} expires ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}`;
  return {
    key: `${doc.toLowerCase()}:${v.id}:${date}`,
    module: "vehicles",
    severity: sev,
    icon: doc === "Insurance" ? "shield-car" : "smoke",
    title,
    subtitle: d < 0 ? `Expired on ${fmtDate(date)}` : `Expiry ${fmtDate(date)}`,
    score: SEV_WEIGHT[sev] + Math.max(0, 60 - d),
    route: `/vehicles/${v.id}`,
    why: {
      summary: `The ${doc} date you recorded for ${v.name} is ${fmtDate(date)}.`,
      facts: [
        { label: "Expiry date", value: fmtDate(date) },
        { label: "Days remaining", value: String(d) },
      ],
      rule: "Urgent when 7 days or fewer remain (or already expired). Upcoming within 30 days.",
      ranking: rankText(sev, "days remaining"),
    },
  };
}

export function attentionItems(db: DB, today = todayISO()): AttentionItem[] {
  const items: AttentionItem[] = [];
  const cur = db.settings.currency;
  const on = (id: string) => db.settings.modules.find((m) => m.id === id)?.enabled;

  if (on("vehicles")) {
    for (const v of db.vehicles) {
      const a = expiryItem(db, v, "Insurance", v.insuranceExpiry, today);
      const b = expiryItem(db, v, "PUC", v.pucExpiry, today);
      if (a) items.push(a);
      if (b) items.push(b);
      const s = serviceEstimate(db, v);
      const warnAt = Math.max(300, s.interval * 0.1);
      if (s.remaining <= warnAt) {
        const sev: Severity = s.remaining <= 0 ? "urgent" : "upcoming";
        items.push({
          key: `service:${v.id}:${s.lastOdo}`,
          module: "vehicles",
          severity: sev,
          icon: "wrench-clock",
          title: s.remaining <= 0 ? `${v.name} service overdue by ${num(-s.remaining, 0)} km` : `${v.name} service due in ~${num(s.remaining, 0)} km`,
          subtitle: `${num(s.since, 0)} km since last service`,
          score: SEV_WEIGHT[sev] + Math.min(99, Math.max(0, -s.remaining / 10 + 50)),
          route: `/vehicles/${v.id}`,
          why: {
            summary: s.explanation,
            facts: s.facts,
            rule: `Upcoming when within ${num(warnAt, 0)} km (10% of the interval, min 300 km). Urgent once the interval is exceeded.`,
            ranking: rankText(sev, "distance remaining"),
          },
        });
      }
    }
  }

  if (on("money")) {
    for (const sub of db.subscriptions.filter((s) => s.active)) {
      const d = daysBetween(today, sub.nextRenewal);
      if (d > 7) continue;
      const sev: Severity = d <= 3 ? "urgent" : "upcoming";
      const yearly = sub.cycle === "yearly" ? sub.amount : sub.cycle === "quarterly" ? sub.amount * 4 : sub.cycle === "monthly" ? sub.amount * 12 : sub.amount * 52;
      items.push({
        key: `sub:${sub.id}:${sub.nextRenewal}`,
        module: "money",
        severity: sev,
        icon: "autorenew",
        title: d < 0 ? `${sub.name} renewal passed — log payment?` : `${sub.name} renews ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}`,
        subtitle: `${money(sub.amount, cur)} · ${sub.cycle}`,
        score: SEV_WEIGHT[sev] + Math.max(0, 30 - d),
        route: "/money?tab=subscriptions",
        subscriptionId: sub.id,
        why: {
          summary: `${sub.name} is a ${sub.cycle} charge of ${money(sub.amount, cur)} (${money(yearly, cur)} per year). Next renewal: ${fmtDate(sub.nextRenewal)}.`,
          facts: [
            { label: "Renewal date", value: fmtDate(sub.nextRenewal) },
            { label: "Days remaining", value: String(d) },
            { label: "Annual cost", value: money(yearly, cur) },
          ],
          rule: "Upcoming within 7 days of renewal, urgent within 3 days. Marking done logs the payment in Money and moves the renewal forward.",
          ranking: rankText(sev, "days to renewal"),
        },
      });
    }

    const mk = monthKey(today);
    const t = monthTotals(db, mk);
    if (db.budget.monthly > 0) {
      const pct = (t.spent / db.budget.monthly) * 100;
      if (pct >= 80) {
        const sev: Severity = pct >= 100 ? "urgent" : "upcoming";
        const day = Number(today.slice(8, 10));
        const daysInMonth = new Date(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)), 0).getDate();
        items.push({
          key: `budget:${mk}:${pct >= 100 ? 100 : 80}`,
          module: "money",
          severity: sev,
          icon: "chart-donut",
          title: pct >= 100 ? `Monthly budget exceeded (${num(pct, 0)}%)` : `${num(pct, 0)}% of monthly budget used`,
          subtitle: `${money(t.spent, cur)} of ${money(db.budget.monthly, cur)}`,
          score: SEV_WEIGHT[sev] + Math.min(99, pct - 80),
          route: "/money",
          why: {
            summary: `You've spent ${money(t.spent, cur)} with ${daysInMonth - day} days left in ${monthLabel(mk)}.`,
            facts: [
              { label: "Budget", value: money(db.budget.monthly, cur) },
              { label: "Spent", value: money(t.spent, cur) },
              { label: "Month elapsed", value: `${num((day / daysInMonth) * 100, 0)}%` },
              ...t.categories.slice(0, 3).map(([c, v]) => ({ label: `Top: ${c}`, value: money(v, cur) })),
            ],
            rule: "Upcoming at 80% of the monthly budget, urgent at 100%.",
            ranking: rankText(sev, "percentage used"),
          },
        });
      }
      for (const [cat, limit] of Object.entries(db.budget.categories)) {
        if (!limit) continue;
        const spentCat = t.categories.find(([c]) => c === cat)?.[1] ?? 0;
        const p = (spentCat / limit) * 100;
        if (p >= 90) {
          items.push({
            key: `catbudget:${cat}:${mk}`,
            module: "money",
            severity: "upcoming",
            icon: "tag-outline",
            title: `${cat} budget ${p >= 100 ? "exceeded" : "nearly used"} (${num(p, 0)}%)`,
            subtitle: `${money(spentCat, cur)} of ${money(limit, cur)}`,
            score: 200 + Math.min(50, p - 90),
            route: "/money",
            why: {
              summary: `${cat} spending this month is ${money(spentCat, cur)} against a limit of ${money(limit, cur)}.`,
              facts: [
                { label: "Category limit", value: money(limit, cur) },
                { label: "Spent", value: money(spentCat, cur) },
              ],
              rule: "Upcoming when a category reaches 90% of its own budget.",
              ranking: rankText("upcoming", "percentage used"),
            },
          });
        }
      }
    }

    for (const ins of moneyInsights(db)) {
      items.push({ key: ins.key, module: "money", severity: "info", icon: ins.icon, title: ins.title, subtitle: ins.kind === "anomaly" ? "Unusual compared with your history" : "Pattern in your history", score: 100 + (ins.kind === "anomaly" ? 20 : 10), route: "/money", why: ins.why });
    }
  }

  return items.sort((a, b) => b.score - a.score);
}

export function visibleAttention(db: DB, today = todayISO()) {
  return attentionItems(db, today).filter((i) => {
    const m = db.attention[i.key];
    if (!m) return true;
    if (m.status === "snoozed") return !!m.until && m.until <= today;
    return false;
  });
}
