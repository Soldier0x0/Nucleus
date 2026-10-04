/**
 * The small snapshot a home-screen widget is allowed to show.
 * Amounts follow privacy mode. Notes, papers and the emergency card are not included.
 */
import type { DB } from "./types";
import { addMonths, daysBetween, money, todayISO } from "./format";
import { calendarEvents, dueDayLabel } from "./life";

export type WidgetSnapshot = {
  countdown: { title: string; days: number; date: string } | null;
  budget: { label: string; value: string };
  trip: { title: string; days: number; when: string } | null;
  maintenance: { title: string; subtitle: string } | null;
  privacy: boolean;
  updated: string;
};

export function widgetSnapshot(db: DB, today = todayISO(), updated = ""): WidgetSnapshot {
  const soon = calendarEvents(db)
    .map((e) => ({ ...e, days: daysBetween(today, e.date) }))
    .filter((e) => e.days >= 0)
    .sort((a, b) => a.days - b.days || a.title.localeCompare(b.title))[0];
  const left = db.budget.monthly - db.txns.filter((t) => t.type === "expense" && t.date.slice(0, 7) === today.slice(0, 7)).reduce((s, t) => s + t.amount, 0);
  const hide = db.settings.privacyMode;
  const budget = db.budget.monthly > 0
    ? { label: "Left this month", value: hide ? "Hidden" : money(left, db.settings.currency, { decimals: false }) }
    : { label: "Budget", value: "No budget" };
  const trip = [...db.trips].filter((t) => t.end >= today).sort((a, b) => a.start.localeCompare(b.start))[0];
  const tripDays = trip ? daysBetween(today, trip.start) : 0;
  const maint = db.appliances
    .flatMap((a) => a.plans.map((p) => {
      const due = addMonths(p.lastDone, p.everyMonths);
      return { title: `${a.name} · ${p.name}`, due, days: daysBetween(today, due) };
    }))
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  return {
    countdown: soon ? { title: soon.title, days: soon.days, date: soon.date } : null,
    budget,
    trip: trip ? { title: trip.name, days: tripDays, when: tripDays > 0 ? `Starts in ${tripDays} days` : tripDays === 0 ? "Starts today" : "On the trip" } : null,
    maintenance: maint ? { title: maint.title, subtitle: maint.days < 0 ? dueDayLabel(maint.days) : maint.days === 0 ? "Due today" : `Due in ${maint.days} days` } : null,
    privacy: hide,
    updated,
  };
}
