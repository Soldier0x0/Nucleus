/**
 * CSV / ICS exports on desktop: the exact column shapes the phone's
 * exports.ts writes (transactions, fuel, services, subscriptions, jars,
 * notes) plus the calendar ICS. Pure string building lives here so the
 * tests read it through the loader; saving uses the same dialog the
 * backup uses. Nothing uploads.
 */
import type { DB } from "@core/types";
import { SERVICE_LABEL } from "@core/actions";
import { fundSaved } from "@core/plan";
import { todayISO } from "@core/format";
import { isTauri } from "./env";

const esc = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: (string | number | undefined)[][]) => rows.map((r) => r.map(esc).join(",")).join("\n");

export type ExportKind = "transactions" | "fuel" | "services" | "subscriptions" | "jars" | "notes" | "calendar";

export const EXPORT_KINDS: { kind: ExportKind; label: string; ext: "csv" | "ics" }[] = [
  { kind: "transactions", label: "Transactions", ext: "csv" },
  { kind: "fuel", label: "Fuel log", ext: "csv" },
  { kind: "services", label: "Service history", ext: "csv" },
  { kind: "subscriptions", label: "Subscriptions", ext: "csv" },
  { kind: "jars", label: "Jars & debts", ext: "csv" },
  { kind: "notes", label: "Notes & lists", ext: "csv" },
  { kind: "calendar", label: "Dates for your calendar", ext: "ics" },
];

/** Pure; column-for-column with the phone's body(). */
export function exportBody(db: DB, kind: ExportKind): string {
  const vName = (id: string) => db.vehicles.find((v) => v.id === id)?.name ?? "";
  if (kind === "transactions") return csv([["date", "type", "amount", "currency", "category", "note"], ...db.txns.map((t) => [t.date, t.type, t.amount, db.settings.currency, t.category, t.note])]);
  if (kind === "fuel") return csv([["date", "vehicle", "odometer", "quantity", "price", "total", "note"], ...db.fuel.map((f) => [f.date, vName(f.vehicleId), f.odometer, f.litres, f.price, f.total, f.note])]);
  if (kind === "services") return csv([["date", "vehicle", "odometer", "kind", "cost", "details", "note"], ...db.services.map((s) => [s.date, vName(s.vehicleId), s.odometer, SERVICE_LABEL[s.kind], s.cost, Object.entries(s.details ?? {}).map(([k, v]) => `${k}=${v}`).join("; "), s.note])]);
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

/** Same events the phone's ICS covers: renewals, expiries, warranties, plans, trips. */
export function calendarEvents(db: DB) {
  const out: { date: string; title: string; note: string }[] = [];
  for (const s of db.subscriptions.filter((x) => x.active)) out.push({ date: s.nextRenewal, title: `${s.name} renews`, note: `${s.amount} ${db.settings.currency} · ${s.cycle}` });
  for (const v of db.vehicles) {
    if (v.insuranceExpiry) out.push({ date: v.insuranceExpiry, title: `${v.name} insurance expires`, note: "Nucleus" });
    if (v.pucExpiry) out.push({ date: v.pucExpiry, title: `${v.name} PUC expires`, note: "Nucleus" });
  }
  for (const a of db.appliances) {
    if (a.warrantyUntil) out.push({ date: a.warrantyUntil, title: `${a.name} warranty ends`, note: a.room ?? "" });
    for (const p of a.plans) out.push({ date: p.lastDone, title: `${a.name}: ${p.name} last done`, note: `every ${p.everyMonths} months` });
  }
  for (const t of db.trips) {
    out.push({ date: t.start, title: `${t.name} starts`, note: t.destination });
    for (const i of t.itinerary) out.push({ date: i.date, title: `${t.name}: ${i.title}`, note: [i.time, i.place].filter(Boolean).join(" · ") });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function exportFileName(kind: ExportKind): string {
  const meta = EXPORT_KINDS.find((e) => e.kind === kind)!;
  return `nucleus-${kind}-${todayISO()}.${meta.ext}`;
}

/** Builds the file and saves it with the dialog (or downloads it in the preview). */
export async function exportKindFile(db: DB, kind: ExportKind): Promise<string | null> {
  const text = exportBody(db, kind);
  const name = exportFileName(kind);
  const mime = kind === "calendar" ? "text/calendar" : "text/csv";
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: name, filters: [{ name: kind, extensions: [mime === "text/calendar" ? "ics" : "csv"] }] });
    if (!path) return null;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("write_export_file", { path, contents: text });
    return name;
  }
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return name;
}
