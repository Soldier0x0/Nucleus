/**
 * The small snapshot a home-screen widget is allowed to show.
 * Amounts follow privacy mode. Notes and papers are not included.
 */
import type { DB } from "./types";
import { addMonths, daysBetween, money, todayISO } from "./format";
import { calendarEvents, dueDayLabel } from "./life";
import { fuelMileagePoints } from "./vehicleMath";
import { visibleAttention } from "./attention";

export type WidgetSnapshot = {
  countdown: { title: string; days: number; date: string } | null;
  budget: { label: string; value: string };
  trip: { title: string; days: number; when: string } | null;
  maintenance: { title: string; subtitle: string } | null;
  attention: { count: number; top: { title: string; subtitle: string; daysLine: string } | null };
  fuel: { cycleLine: string; priceLine: string } | null;
  privacy: boolean;
  updated: string;
};

/**
 * Action widgets deep-link with `nucleus://open?path=…&action=…`. The widget
 * process only opens the app; the sheet itself runs after unlock.
 */
export const WIDGET_ACTIONS = ["fuel", "expense", "service"] as const;
export type WidgetAction = (typeof WIDGET_ACTIONS)[number];

/** An action from a deep-link URL or a bare action word. Unknown or missing gives null. */
export function parseWidgetAction(raw: unknown): WidgetAction | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  const inUrl = /[?&]action=([^&#]*)/i.exec(text);
  let value = inUrl ? inUrl[1] : text;
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  value = value.trim().toLowerCase();
  return (WIDGET_ACTIONS as readonly string[]).includes(value) ? (value as WidgetAction) : null;
}

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
    attention: attentionWidgetCard(db, today),
    fuel: fuelWidgetCard(db),
    privacy: hide,
    updated,
  };
}

/** The 2×2 Attention card: how many, and the loudest one. Marks (done/snoozed) respected. */
export function attentionWidgetCard(db: DB, today = todayISO()): WidgetSnapshot["attention"] {
  const open = visibleAttention(db, today);
  const count = open.length == 0 ? 0 : open.length;
  const top = open[0];
  if (!top) return { count: 0, top: null };
  const days = top.due ? daysBetween(today, top.due) : null;
  return {
    count,
    top: { title: top.title, subtitle: top.subtitle, daysLine: days == null ? "" : dueDayLabel(days) },
  };
}

/** The 4×2 partner card: the current fuel cycle stats for the newest-filled ride. ₹/L respects privacy mode. */
export function fuelWidgetCard(db: DB): WidgetSnapshot["fuel"] {
  const fuel = db.fuel;
  if (!fuel.length) return null;
  const ride = [...fuel].sort((a, b) => a.date.localeCompare(b.date))[fuel.length - 1].vehicleId;
  const mine = fuel.filter((row) => row.vehicleId === ride);
  const points = fuelMileagePoints(mine);
  const km = points.length ? points[points.length - 1].value : null;
  const rt = mine.slice(-6).filter((row) => row.price > 0);
  const avg = rt.length ? rt.reduce((sum, row) => sum + row.price, 0) / rt.length : null;
  if (km == null && avg == null) return null;
  const unit = db.settings.distanceUnit;
  const cur = db.settings.currency;
  return {
    cycleLine: km != null ? `${Math.round(km)} ${unit}/${db.settings.volumeUnit}` : "No stretch yet",
    priceLine: db.settings.privacyMode ? "Hidden" : avg != null ? `${money(avg, cur)} / ${db.settings.volumeUnit}` : "—",
  };
}
