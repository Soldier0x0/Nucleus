import type { DB } from "./types";
import { MODULES } from "./modules";
import { fmtDate, money, num } from "./format";
import { SERVICE_LABEL } from "./actions";
import { vehicleStats } from "./intelligence";

export type SearchItem = { id: string; title: string; subtitle: string; icon: string; route: string };
export type SearchGroup = { title: string; summary?: string; items: SearchItem[] };

const TOOLS = [
  { id: "units", name: "Unit converter", keys: "length weight volume temperature speed area data pressure convert" },
  { id: "percent", name: "Percentage & GST", keys: "percent gst discount markup margin tax" },
  { id: "split", name: "Tip & bill split", keys: "tip bill split share restaurant" },
  { id: "dates", name: "Date calculator", keys: "date days age working countdown difference" },
  { id: "emi", name: "EMI / loan", keys: "emi loan interest amortization mortgage" },
];

/** Local, in-memory structured search grouped by entity type, with relationship summaries. */
export function search(db: DB, q: string): SearchGroup[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const has = (...f: (string | number | undefined)[]) => f.some((x) => x !== undefined && String(x).toLowerCase().includes(s));
  const cur = db.settings.currency;
  const on = (id: string) => db.settings.modules.find((m) => m.id === id)?.enabled;
  const groups: SearchGroup[] = [];

  const mods = MODULES.filter((m) => m.id !== "cycle" && m.status === "available" && on(m.id) && has(m.name, m.description));
  const tools = on("tools") ? TOOLS.filter((t) => has(t.name, t.keys)) : [];
  if (mods.length || tools.length)
    groups.push({
      title: "Modules & tools",
      items: [
        ...mods.map((m) => ({ id: m.id, title: m.name, subtitle: m.description, icon: m.icon, route: m.route! })),
        ...tools.map((t) => ({ id: t.id, title: t.name, subtitle: "Quick tool", icon: "calculator-variant-outline", route: `/tools?tool=${t.id}` })),
      ],
    });

  if (on("vehicles")) {
    const vs = db.vehicles.filter((v) => has(v.name, v.make, v.model, v.plate));
    for (const v of vs) {
      const st = vehicleStats(db, v);
      const linkedSpend = db.links.filter((l) => l.from.kind === "vehicle" && l.from.id === v.id && l.to.kind === "txn").map((l) => db.txns.find((t) => t.id === l.to.id)?.amount ?? 0).reduce((a, b) => a + b, 0);
      groups.push({
        title: `Vehicle · ${v.name}`,
        summary: `${st.fuel.length} fuel entries · ${money(linkedSpend || st.totalFuelCost + st.serviceCost, cur)} spent · ${st.service.remaining > 0 ? `service in ~${num(st.service.remaining, 0)} km` : "service overdue"}`,
        items: [{ id: v.id, title: v.name, subtitle: [v.make, v.model, v.plate].filter(Boolean).join(" · "), icon: v.type === "bike" ? "motorbike" : "car-side", route: `/vehicles/${v.id}` }],
      });
    }
    const vName = (id: string) => db.vehicles.find((v) => v.id === id)?.name ?? "";
    const fuel = db.fuel.filter((f) => has(f.note, vName(f.vehicleId), "fuel"));
    if (fuel.length)
      groups.push({
        title: "Fuel entries",
        summary: `${fuel.length} entries · ${money(fuel.reduce((a, f) => a + f.total, 0), cur)}`,
        items: fuel.slice(-5).reverse().map((f) => ({ id: f.id, title: `${vName(f.vehicleId)} · ${f.litres} L`, subtitle: `${fmtDate(f.date)} · ${money(f.total, cur)}`, icon: "gas-station-outline", route: `/record/fuel/${f.id}` })),
      });
    const svc = db.services.filter((x) => has(x.note, vName(x.vehicleId), SERVICE_LABEL[x.kind], "service", ...Object.values(x.details)));
    if (svc.length)
      groups.push({
        title: "Services",
        summary: `${svc.length} records · ${money(svc.reduce((a, x) => a + x.cost, 0), cur)}`,
        items: svc.slice(-5).reverse().map((x) => ({ id: x.id, title: `${vName(x.vehicleId)} · ${SERVICE_LABEL[x.kind]}`, subtitle: `${fmtDate(x.date)} · ${num(x.odometer, 0)} km`, icon: "wrench-outline", route: `/record/service/${x.id}` })),
      });
  }

  if (on("money")) {
    const tx = db.txns.filter((t) => has(t.category, t.note));
    if (tx.length) {
      const spent = tx.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
      groups.push({
        title: "Transactions",
        summary: `${tx.length} matches · ${money(spent, cur)} spent`,
        items: [...tx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((t) => ({ id: t.id, title: t.note || t.category, subtitle: `${t.category} · ${fmtDate(t.date)} · ${t.type === "income" ? "+" : "-"}${money(t.amount, cur)}`, icon: t.type === "income" ? "arrow-down-bold-circle-outline" : "arrow-up-bold-circle-outline", route: `/record/txn/${t.id}` })),
      });
    }
    const subs = db.subscriptions.filter((x) => has(x.name, x.category));
    if (subs.length)
      groups.push({
        title: "Subscriptions",
        items: subs.map((x) => ({ id: x.id, title: x.name, subtitle: `${money(x.amount, cur)} ${x.cycle} · renews ${fmtDate(x.nextRenewal)}`, icon: "autorenew", route: `/record/subscription/${x.id}` })),
      });
  }

  if (on("notes")) {
    const notes = db.notes.filter((n) => has(n.title, n.body, ...n.checklist.map((c) => c.text)));
    if (notes.length)
      groups.push({
        title: "Notes & lists",
        summary: `${notes.length} match${notes.length === 1 ? "" : "es"}`,
        items: notes.slice(0, 6).map((n) => ({ id: n.id, title: n.title || "Untitled note", subtitle: n.checklist.length ? `${n.checklist.filter((c) => c.done).length}/${n.checklist.length} done` : n.body.slice(0, 60) || "Note", icon: "note-text-outline", route: `/notes?id=${n.id}` })),
      });
  }

  if (on("papers")) {
    const papers = db.papers.filter((p) => has(p.title, p.number, p.kind, p.note));
    const people = db.people.filter((p) => has(p.name, p.note));
    if (papers.length || people.length)
      groups.push({
        title: "Papers",
        summary: `${papers.length} document${papers.length === 1 ? "" : "s"}`,
        items: [
          ...papers.slice(0, 6).map((p) => ({ id: p.id, title: p.title, subtitle: [p.kind, p.expiry].filter(Boolean).join(" · "), icon: "file-document-outline", route: "/papers" })),
          ...people.slice(0, 4).map((p) => ({ id: p.id, title: p.name, subtitle: "Household", icon: "account-outline", route: "/papers" })),
        ],
      });
  }

  if (on("kanban")) {
    const cards = db.kanban.flatMap((b) => b.cards.filter((c) => has(c.title, c.note, b.name)).map((c) => ({ id: c.id, title: c.title, subtitle: b.name, icon: "view-column-outline", route: "/kanban" })));
    if (cards.length) groups.push({ title: "Kanban", summary: `${cards.length} card${cards.length === 1 ? "" : "s"}`, items: cards.slice(0, 6) });
  }

  if (on("wiki")) {
    const pages = db.wiki.filter((p) => has(p.title, p.body));
    if (pages.length)
      groups.push({
        title: "Wiki",
        summary: `${pages.length} page${pages.length === 1 ? "" : "s"}`,
        items: pages.slice(0, 6).map((p) => ({ id: p.id, title: p.title || "Untitled", subtitle: p.body.slice(0, 60) || "Page", icon: "book-open-variant", route: "/wiki" })),
      });
  }

  if (on("rules")) {
    const rs = db.rules.filter((r) => has(r.name, r.trigger.kind));
    if (rs.length)
      groups.push({
        title: "Rules",
        items: rs.map((r) => ({ id: r.id, title: r.name, subtitle: r.enabled ? "Active rule" : "Paused rule", icon: "source-branch", route: "/rules" })),
      });
  }
  return groups;
}
