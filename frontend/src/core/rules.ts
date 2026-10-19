/**
 * Rules — visual "when / then" automations, evaluated locally.
 *
 * A rule never runs in the background: date-based rules are turned into one-off local
 * notifications (scheduled by the OS), threshold rules are evaluated every time the app
 * computes Attention. Everything is a pure function of the DB, so a rule can also be
 * "dry run" over your history before you save it.
 */
import type { AttentionItem, Severity } from "./intelligence";
import { monthTotals, serviceEstimate } from "./intelligence";
import { homeSchedule, tripStatus } from "./domains";
import type { DB, Rule, RuleTriggerKind } from "./types";
import { addDays, addMonths, daysBetween, fmtDate, money, monthKey, monthLabel, num, todayISO } from "./format";
import { serviceLeftLine } from "./vehicleMath";

export type TriggerMeta = {
  kind: RuleTriggerKind;
  label: string;
  icon: string;
  unit: string;
  module: "money" | "vehicles" | "travel" | "home";
  options: number[];
  sentence: (v: number) => string;
  dated: boolean;
};

export const TRIGGERS: TriggerMeta[] = [
  { kind: "renewal", label: "Subscription renewal", icon: "autorenew", unit: "days", module: "money", options: [1, 2, 3, 5, 7, 14], sentence: (v) => `a subscription renews within ${v} day${v === 1 ? "" : "s"}`, dated: true },
  { kind: "expiry", label: "Insurance / PUC / warranty", icon: "shield-car", unit: "days", module: "vehicles", options: [7, 14, 30, 60, 90], sentence: (v) => `insurance, PUC or a warranty expires within ${v} days`, dated: true },
  { kind: "tripStart", label: "Trip starts", icon: "bag-suitcase-outline", unit: "days", module: "travel", options: [1, 3, 7, 14, 30], sentence: (v) => `a trip starts within ${v} day${v === 1 ? "" : "s"}`, dated: true },
  { kind: "maintenance", label: "Home maintenance due", icon: "wrench-clock", unit: "days", module: "home", options: [1, 3, 7, 14, 30], sentence: (v) => `home maintenance is due within ${v} day${v === 1 ? "" : "s"}`, dated: true },
  { kind: "serviceKm", label: "Service distance left", icon: "speedometer", unit: "km", module: "vehicles", options: [200, 300, 500, 1000], sentence: (v) => `a vehicle is within ${num(v, 0)} km of its service interval`, dated: false },
  { kind: "budgetPct", label: "Budget used", icon: "chart-donut", unit: "%", module: "money", options: [50, 70, 80, 90, 100], sentence: (v) => `this month's spending reaches ${v}% of the budget`, dated: false },
  { kind: "bigExpense", label: "Large expense", icon: "cash-multiple", unit: "amount", module: "money", options: [1000, 2500, 5000, 10000, 25000], sentence: (v) => `a single expense is more than ${num(v, 0)}`, dated: false },
];

export const triggerMeta = (k: RuleTriggerKind) => TRIGGERS.find((t) => t.kind === k)!;

export const ruleSentence = (r: Rule) => {
  const acts = [r.actions.includes("notify") ? "remind me" : "", r.actions.includes("attention") ? "show it in Attention" : ""].filter(Boolean);
  return `When ${triggerMeta(r.trigger.kind).sentence(r.trigger.value)}, ${acts.join(" and ") || "do nothing"}.`;
};

export type RuleHit = {
  key: string;
  rule: Rule;
  title: string;
  subtitle: string;
  /** Calendar date the thing happens, for date-based triggers. */
  date?: string;
  severity: Severity;
  facts: { label: string; value: string }[];
};

/** Everything a rule matches right now. Pure; safe to call on every render. */
export function evaluateRule(db: DB, r: Rule, today = todayISO()): RuleHit[] {
  const cur = db.settings.currency;
  const hits: RuleHit[] = [];
  const v = r.trigger.value;
  const sev = (d: number): Severity => (d <= 1 ? "urgent" : d <= 7 ? "upcoming" : "info");

  if (r.trigger.kind === "renewal") {
    for (const s of db.subscriptions.filter((x) => x.active)) {
      const d = daysBetween(today, s.nextRenewal);
      if (d > v) continue;
      hits.push({
        key: `rule:${r.id}:sub:${s.id}:${s.nextRenewal}`,
        rule: r,
        title: `${s.name} renews ${d < 0 ? "already passed" : d === 0 ? "today" : `in ${d} days`}`,
        subtitle: `${money(s.amount, cur)} · ${s.cycle}`,
        date: s.nextRenewal,
        severity: sev(d),
        facts: [{ label: "Renewal", value: fmtDate(s.nextRenewal) }, { label: "Amount", value: money(s.amount, cur) }],
      });
    }
  }

  if (r.trigger.kind === "expiry") {
    const dated: { name: string; what: string; date: string }[] = [];
    for (const veh of db.vehicles) {
      if (veh.insuranceExpiry) dated.push({ name: veh.name, what: "insurance", date: veh.insuranceExpiry });
      if (veh.pucExpiry) dated.push({ name: veh.name, what: "PUC", date: veh.pucExpiry });
    }
    for (const a of db.appliances) if (a.warrantyUntil) dated.push({ name: a.name, what: "warranty", date: a.warrantyUntil });
    for (const x of dated) {
      const d = daysBetween(today, x.date);
      if (d > v || d < -30) continue;
      hits.push({
        key: `rule:${r.id}:exp:${x.name}:${x.what}:${x.date}`,
        rule: r,
        title: `${x.name} ${x.what} ${d < 0 ? "has expired" : d === 0 ? "expires today" : `expires in ${d} days`}`,
        subtitle: fmtDate(x.date),
        date: x.date,
        severity: sev(d),
        facts: [{ label: "Expiry", value: fmtDate(x.date) }, { label: "Days left", value: String(d) }],
      });
    }
  }

  if (r.trigger.kind === "tripStart") {
    for (const t of db.trips.filter((x) => tripStatus(x) !== "past")) {
      const d = daysBetween(today, t.start);
      if (d > v) continue;
      hits.push({
        key: `rule:${r.id}:trip:${t.id}:${t.start}`,
        rule: r,
        title: `${t.name} starts ${d <= 0 ? "now" : `in ${d} days`}`,
        subtitle: `${t.destination} · ${fmtDate(t.start)}`,
        date: t.start,
        severity: sev(d),
        facts: [{ label: "Departure", value: fmtDate(t.start) }, { label: "Travellers", value: String(t.travellers) }],
      });
    }
  }

  if (r.trigger.kind === "maintenance") {
    for (const x of homeSchedule(db).filter((s) => s.days <= v)) {
      hits.push({
        key: `rule:${r.id}:maint:${x.p.id}:${x.p.lastDone}`,
        rule: r,
        title: `${x.a.name}: ${x.p.name} ${x.days < 0 ? `was due ${-x.days} days ago` : x.days === 0 ? "due today" : `due in ${x.days} days`}`,
        subtitle: `Every ${x.p.everyMonths} months`,
        date: x.due,
        severity: sev(x.days),
        facts: [{ label: "Next due", value: fmtDate(x.due) }, { label: "Interval", value: `${x.p.everyMonths} months` }],
      });
    }
  }

  if (r.trigger.kind === "serviceKm") {
    for (const veh of db.vehicles) {
      const s = serviceEstimate(db, veh);
      if (s.remaining > v) continue;
      hits.push({
        key: `rule:${r.id}:svc:${veh.id}:${s.lastOdo}`,
        rule: r,
        title: `${veh.name}: ${serviceLeftLine(s.remaining)}`,
        subtitle: `${num(s.since, 0)} km since the last service`,
        severity: s.remaining <= 0 ? "urgent" : "upcoming",
        facts: [{ label: "Interval", value: `${num(s.interval, 0)} km` }, { label: "Since service", value: `${num(s.since, 0)} km` }],
      });
    }
  }

  if (r.trigger.kind === "budgetPct" && db.budget.monthly > 0) {
    const mk = monthKey(today);
    const t = monthTotals(db, mk);
    const pct = (t.spent / db.budget.monthly) * 100;
    if (pct >= v)
      hits.push({
        key: `rule:${r.id}:budget:${mk}:${v}`,
        rule: r,
        title: `${num(pct, 0)}% of the ${monthLabel(mk)} budget is used`,
        subtitle: `${money(t.spent, cur)} of ${money(db.budget.monthly, cur)}`,
        severity: pct >= 100 ? "urgent" : "upcoming",
        facts: [{ label: "Spent", value: money(t.spent, cur) }, { label: "Budget", value: money(db.budget.monthly, cur) }],
      });
  }

  if (r.trigger.kind === "bigExpense") {
    const since = addDays(today, -7);
    for (const t of db.txns.filter((x) => x.type === "expense" && x.amount > v && x.date >= since))
      hits.push({
        key: `rule:${r.id}:txn:${t.id}`,
        rule: r,
        title: `${money(t.amount, cur)} on ${t.category}`,
        subtitle: `${t.note || "Large expense"} · ${fmtDate(t.date)}`,
        severity: "info",
        facts: [{ label: "Amount", value: money(t.amount, cur) }, { label: "Date", value: fmtDate(t.date) }],
      });
  }

  return hits;
}

export const enabledRules = (db: DB) => (db.settings.modules.find((m) => m.id === "rules")?.enabled ? db.rules.filter((r) => r.enabled) : []);

/** Rule hits that asked to appear in the Attention centre. */
export function ruleAttention(db: DB, today = todayISO()): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const r of enabledRules(db).filter((x) => x.actions.includes("attention"))) {
    const meta = triggerMeta(r.trigger.kind);
    for (const h of evaluateRule(db, r, today)) {
      out.push({
        key: h.key,
        module: meta.module,
        severity: h.severity,
        icon: meta.icon,
        title: h.title,
        subtitle: `${h.subtitle} · rule "${r.name}"`,
        score: (h.severity === "urgent" ? 300 : h.severity === "upcoming" ? 200 : 100) + 5,
        route: "/rules",
        why: {
          summary: `Your rule "${r.name}" matched. ${h.subtitle}.`,
          facts: h.facts,
          rule: ruleSentence(r),
          ranking: `Severity comes from how close the trigger is; rules rank just above built-in items of the same severity.`,
        },
      });
    }
  }
  return out;
}

/**
 * What a rule *would* have done over the last 90 days — shown before you save it,
 * so a rule is never a surprise.
 */
export function dryRun(db: DB, r: Rule, today = todayISO()): { count: number; window: string } {
  const from = addDays(today, -90);
  const v = r.trigger.value;
  const inWindow = (d?: string) => !!d && d >= from && d <= today;
  let count = 0;
  switch (r.trigger.kind) {
    case "renewal":
      // Walk each subscription's cycle backwards through the window.
      for (const s of db.subscriptions) {
        const step = s.cycle === "weekly" ? 7 : s.cycle === "monthly" ? 30 : s.cycle === "quarterly" ? 91 : 365;
        for (let d = s.nextRenewal; d >= from; d = addDays(d, -step)) if (inWindow(d)) count++;
      }
      break;
    case "expiry":
      for (const veh of db.vehicles) {
        if (inWindow(veh.insuranceExpiry) || (veh.insuranceExpiry && daysBetween(today, veh.insuranceExpiry) <= v && daysBetween(today, veh.insuranceExpiry) >= 0)) count++;
        if (inWindow(veh.pucExpiry) || (veh.pucExpiry && daysBetween(today, veh.pucExpiry) <= v && daysBetween(today, veh.pucExpiry) >= 0)) count++;
      }
      for (const a of db.appliances) if (inWindow(a.warrantyUntil) || (a.warrantyUntil && daysBetween(today, a.warrantyUntil) <= v && daysBetween(today, a.warrantyUntil) >= 0)) count++;
      break;
    case "tripStart":
      count = db.trips.filter((t) => inWindow(t.start) || daysBetween(today, t.start) <= v).length;
      break;
    case "maintenance":
      count = homeSchedule(db).filter((x) => x.days <= v).length;
      break;
    case "serviceKm":
      count = db.services.filter((s) => inWindow(s.date)).length;
      break;
    case "budgetPct":
      if (db.budget.monthly > 0)
        // Adding 30 days jumps two calendar months in the short ones. Walk months.
        for (let i = 0; i < 3; i++) {
          const mk = monthKey(addMonths(`${today.slice(0, 7)}-01`, -i));
          if ((monthTotals(db, mk).spent / db.budget.monthly) * 100 >= v) count++;
        }
      break;
    case "bigExpense":
      count = db.txns.filter((t) => t.type === "expense" && t.amount > v && inWindow(t.date)).length;
      break;
  }
  return { count, window: "last 90 days" };
}

// ---------- reminders ----------
export type Reminder = { key: string; title: string; body: string; at: Date; once: boolean };

const shiftOutOfQuietHours = (d: Date, q: { enabled: boolean; from: number; to: number }) => {
  if (!q.enabled) return d;
  const h = d.getHours();
  const inQuiet = q.from > q.to ? h >= q.from || h < q.to : h >= q.from && h < q.to;
  if (!inQuiet) return d;
  const out = new Date(d);
  if (q.from > q.to && h >= q.from) out.setDate(out.getDate() + 1);
  out.setHours(q.to, 0, 0, 0);
  return out;
};

/** One-off reminders to hand to the OS scheduler. Dated rules fire at 09:00 on the day. */
export function reminders(db: DB, today = todayISO()): Reminder[] {
  const out: Reminder[] = [];
  const now = Date.now();
  for (const r of enabledRules(db).filter((x) => x.actions.includes("notify"))) {
    const meta = triggerMeta(r.trigger.kind);
    for (const h of evaluateRule(db, r, today)) {
      let at: Date;
      if (meta.dated && h.date) {
        const [y, m, d] = h.date.split("-").map(Number);
        at = new Date(y, m - 1, d, 9, 0, 0, 0);
        if (at.getTime() <= now) continue; // the day has passed; Attention still shows it
      } else {
        if (db.ruleFires[h.key]) continue; // threshold rules nudge once
        at = new Date(now + 60_000);
      }
      out.push({ key: h.key, title: r.name, body: `${h.title} — ${h.subtitle}`, at: shiftOutOfQuietHours(at, db.settings.quietHours), once: !meta.dated });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 30);
}

export const markFired = (db: DB, keys: string[]): DB => ({ ...db, ruleFires: { ...db.ruleFires, ...Object.fromEntries(keys.map((k) => [k, new Date().toISOString()])) } });
