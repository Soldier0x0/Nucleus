/**
 * CSV / ICS exports. Written to the cache and handed to the share sheet (web: download).
 * Nothing is uploaded; the file only goes where you send it.
 */
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import type { DB } from "./types";
import { SERVICE_LABEL } from "./actions";
import { fundSaved } from "./plan";
import { fmtDate, todayISO } from "./format";

const esc = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: (string | number | undefined)[][]) => rows.map((r) => r.map(esc).join(",")).join("\n");

export type ExportKind = "transactions" | "fuel" | "services" | "subscriptions" | "jars" | "notes" | "calendar";

export const EXPORTS: { kind: ExportKind; label: string; icon: string; ext: "csv" | "ics"; count: (db: DB) => number }[] = [
  { kind: "transactions", label: "Transactions", icon: "swap-vertical", ext: "csv", count: (d) => d.txns.length },
  { kind: "fuel", label: "Fuel log", icon: "gas-station-outline", ext: "csv", count: (d) => d.fuel.length },
  { kind: "services", label: "Service history", icon: "wrench-outline", ext: "csv", count: (d) => d.services.length },
  { kind: "subscriptions", label: "Subscriptions", icon: "autorenew", ext: "csv", count: (d) => d.subscriptions.length },
  { kind: "jars", label: "Jars & debts", icon: "cube-outline", ext: "csv", count: (d) => d.funds.length + d.debts.length },
  { kind: "notes", label: "Notes & lists", icon: "note-text-outline", ext: "csv", count: (d) => d.notes.length },
  { kind: "calendar", label: "Dates for your calendar", icon: "calendar-export", ext: "ics", count: (d) => calendarEvents(d).length },
];

function calendarEvents(db: DB) {
  const out: { date: string; title: string; note: string }[] = [];
  for (const s of db.subscriptions.filter((x) => x.active)) out.push({ date: s.nextRenewal, title: `${s.name} renews`, note: `${s.amount} ${db.settings.currency} · ${s.cycle}` });
  for (const v of db.vehicles) {
    if (v.insuranceExpiry) out.push({ date: v.insuranceExpiry, title: `${v.name} insurance expires`, note: "Nucleus" });
    if (v.pucExpiry) out.push({ date: v.pucExpiry, title: `${v.name} PUC expires`, note: "Nucleus" });
  }
  for (const a of db.appliances) {
    if (a.warrantyUntil) out.push({ date: a.warrantyUntil, title: `${a.name} warranty ends`, note: a.room });
    for (const p of a.plans) out.push({ date: p.lastDone, title: `${a.name}: ${p.name} last done`, note: `every ${p.everyMonths} months` });
  }
  for (const t of db.trips) {
    out.push({ date: t.start, title: `${t.name} starts`, note: t.destination });
    for (const i of t.itinerary) out.push({ date: i.date, title: `${t.name}: ${i.title}`, note: [i.time, i.place].filter(Boolean).join(" · ") });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function body(db: DB, kind: ExportKind): string {
  const vName = (id: string) => db.vehicles.find((v) => v.id === id)?.name ?? "";
  if (kind === "transactions") return csv([["date", "type", "amount", "currency", "category", "note"], ...db.txns.map((t) => [t.date, t.type, t.amount, db.settings.currency, t.category, t.note])]);
  if (kind === "fuel") return csv([["date", "vehicle", "odometer", "quantity", "price", "total", "note"], ...db.fuel.map((f) => [f.date, vName(f.vehicleId), f.odometer, f.litres, f.price, f.total, f.note])]);
  if (kind === "services") return csv([["date", "vehicle", "odometer", "kind", "cost", "details", "note"], ...db.services.map((s) => [s.date, vName(s.vehicleId), s.odometer, SERVICE_LABEL[s.kind], s.cost, Object.entries(s.details).map(([k, v]) => `${k}=${v}`).join("; "), s.note])]);
  if (kind === "subscriptions") return csv([["name", "amount", "cycle", "next renewal", "category", "active"], ...db.subscriptions.map((s) => [s.name, s.amount, s.cycle, s.nextRenewal, s.category, s.active ? "yes" : "no"])]);
  if (kind === "jars")
    return csv([
      ["type", "name", "target/original", "saved/balance", "rate %", "monthly", "target date"],
      ...db.funds.map((f) => ["jar", f.name, f.target, fundSaved(f), "", "", f.targetDate]),
      ...db.debts.map((d) => ["debt", d.name, d.principal, d.balance, d.ratePct, d.emi, ""]),
    ]);
  if (kind === "notes") return csv([["title", "body", "checklist", "updated"], ...db.notes.map((n) => [n.title, n.body, n.checklist.map((c) => `${c.done ? "[x]" : "[ ]"} ${c.text}`).join(" | "), n.updatedAt])]);
  // ICS
  const ics = calendarEvents(db).map((e, i) => {
    const d = e.date.replace(/-/g, "");
    const next = new Date(Number(e.date.slice(0, 4)), Number(e.date.slice(5, 7)) - 1, Number(e.date.slice(8, 10)) + 1);
    const end = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}${String(next.getDate()).padStart(2, "0")}`;
    return ["BEGIN:VEVENT", `UID:nucleus-${i}-${d}@local`, `DTSTAMP:${todayISO().replace(/-/g, "")}T090000Z`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${e.title}`, `DESCRIPTION:${e.note}`, "END:VEVENT"].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nucleus//Local//EN", "CALSCALE:GREGORIAN", ...ics, "END:VCALENDAR"].join("\r\n");
}

export async function exportData(db: DB, kind: ExportKind) {
  const meta = EXPORTS.find((e) => e.kind === kind)!;
  const text = body(db, kind);
  const name = `nucleus-${kind}-${todayISO()}.${meta.ext}`;
  const mime = meta.ext === "csv" ? "text/csv" : "text/calendar";
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = (globalThis as any).document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return name;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: `Export ${meta.label}` });
  return name;
}

/** Everything that ever happened, newest first — the Timeline feed. */
export type TimelineEntry = { id: string; date: string; icon: string; title: string; sub: string; route?: string };

export function timeline(db: DB): TimelineEntry[] {
  const cur = db.settings.currency;
  const vName = (id: string) => db.vehicles.find((v) => v.id === id)?.name ?? "Vehicle";
  const out: TimelineEntry[] = [
    ...db.fuel.map((f) => ({ id: f.id, date: f.date, icon: "gas-station-outline", title: `${vName(f.vehicleId)} · ${f.litres} ${db.settings.volumeUnit}`, sub: `${f.total} ${cur} · ${f.odometer} ${db.settings.distanceUnit}`, route: `/record/fuel/${f.id}` })),
    ...db.services.map((s) => ({ id: s.id, date: s.date, icon: "wrench-outline", title: `${vName(s.vehicleId)} · ${SERVICE_LABEL[s.kind]}`, sub: `${s.cost} ${cur}`, route: `/record/service/${s.id}` })),
    ...db.txns.map((t) => ({ id: t.id, date: t.date, icon: t.type === "income" ? "arrow-down-bold-circle-outline" : "arrow-up-bold-circle-outline", title: t.note || t.category, sub: `${t.type === "income" ? "+" : "-"}${t.amount} ${cur} · ${t.category}`, route: `/record/txn/${t.id}` })),
    ...db.trips.map((t) => ({ id: t.id, date: t.start, icon: "bag-suitcase-outline", title: t.name, sub: `Trip · ${t.destination}`, route: `/travel/${t.id}` })),
    ...db.appliances.filter((a) => a.purchaseDate).map((a) => ({ id: a.id, date: a.purchaseDate!, icon: "washing-machine", title: `Bought ${a.name}`, sub: `${a.room}${a.price ? ` · ${a.price} ${cur}` : ""}`, route: "/home" })),
    ...db.notes.map((n) => ({ id: n.id, date: n.updatedAt.slice(0, 10), icon: "note-text-outline", title: n.title || "Note", sub: n.checklist.length ? `${n.checklist.filter((c) => c.done).length}/${n.checklist.length} done` : "Note", route: `/notes?id=${n.id}` })),
  ];
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export const timelineLabel = (date: string) => fmtDate(date);
