import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { visibleAttention } from "@core/attention";
import { fmtDate, money, todayISO } from "@core/format";
import type { DB } from "@core/types";
import type { SectionId } from "../App";

type Cmd = { id: string; title: string; subtitle?: string; run: () => void };

const SECTION_LABEL: Record<SectionId, string> = {
  today: "Today",
  attention: "Attention",
  money: "Money",
  vehicles: "Vehicles",
  health: "Health",
  home: "Home",
  travel: "Travel",
  papers: "Papers",
  notes: "Notes",
  media: "Media",
  settings: "Settings",
  devlab: "Dev Lab",
};

/**
 * Ctrl+K palette (v0.14): sections, records, attention and tools in one
 * flat, ranked list. Keyboard-first: arrows move, Enter runs, Esc closes.
 */
export function CommandPalette({ onClose, onJump, includeDev }: { onClose: () => void; onJump: (section: SectionId, focusId?: string) => void; includeDev: boolean }) {
  const { db } = useStore();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const cmds = useMemo<Cmd[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Cmd[] = [];
    const push = (id: string, title: string, subtitle: string | undefined, run: () => void) => {
      if (!q || title.toLowerCase().includes(q) || (subtitle ?? "").toLowerCase().includes(q)) {
        out.push({ id, title, subtitle, run });
      }
    };
    const match = (...text: (string | number | boolean | undefined)[]) => {
      if (!q) return true;
      return text.some((x) => x !== undefined && String(x).toLowerCase().includes(q));
    };

    for (const id of Object.keys(SECTION_LABEL) as SectionId[]) {
      if (id === "devlab" && !includeDev) continue;
      if (!moduleOn(db, id)) continue;
      const n = of(id);
      push(`section:${id}`, SECTION_LABEL[id], n < 9 ? `Open — Ctrl+${n + 1}` : "Open", () => onJump(id));
    }

    for (const item of visibleAttention(db, todayISO())) {
      push(`att:${item.key}`, item.title, item.subtitle, () => onJump("attention"));
    }

    if (moduleOn(db, "vehicles")) for (const v of db.vehicles) {
      if (match(v.name, v.make, v.model, v.plate)) out.push({ id: `vehicle:${v.id}`, title: v.name, subtitle: "Vehicle", run: () => onJump("vehicles", v.id) });
    }
    if (moduleOn(db, "money")) {
      for (const t of db.txns) {
        if (match(t.category, t.note, t.item)) out.push({ id: `txn:${t.id}`, title: t.note || t.category, subtitle: `${t.category} · ${fmtDate(t.date)} · ${money(t.amount, db.settings.currency)}`, run: () => onJump("money") });
      }
      for (const s of db.subscriptions) {
        if (match(s.name, s.category)) out.push({ id: `sub:${s.id}`, title: s.name, subtitle: `Renews ${fmtDate(s.nextRenewal)}`, run: () => onJump("money") });
      }
    }
    if (moduleOn(db, "papers")) for (const p of db.papers) {
      if (match(p.title, p.number, p.kind, p.note, p.insurer)) out.push({ id: `paper:${p.id}`, title: p.title, subtitle: "Paper", run: () => onJump("papers", p.id) });
    }
    if (moduleOn(db, "notes")) for (const n of db.notes) {
      if (match(n.title, n.body, ...n.checklist.map((c) => c.text))) out.push({ id: `note:${n.id}`, title: n.title || "Untitled note", subtitle: n.body.slice(0, 70) || undefined, run: () => onJump("notes", n.id) });
    }
    if (moduleOn(db, "kanban")) for (const b of db.kanban) {
      for (const c of b.cards) {
        if (match(c.title, c.note, b.name)) out.push({ id: `card:${c.id}`, title: c.title, subtitle: b.name, run: () => onJump("notes", c.id) });
      }
    }
    if (moduleOn(db, "travel")) for (const t of db.trips) {
      if (match(t.name, t.destination)) out.push({ id: `trip:${t.id}`, title: t.name, subtitle: t.destination, run: () => onJump("travel") });
    }
    if (moduleOn(db, "media")) for (const m of db.media) {
      if (match(m.title)) out.push({ id: `media:${m.id}`, title: m.title, subtitle: m.kind, run: () => onJump("media") });
    }
    if (moduleOn(db, "home")) {
      for (const a of db.appliances) {
        if (match(a.name, a.room, a.brand)) out.push({ id: `app:${a.id}`, title: a.name, subtitle: a.room, run: () => onJump("home") });
      }
      for (const c of db.chores) {
        if (match(c.name, c.room)) out.push({ id: `chore:${c.id}`, title: c.name, subtitle: `Every ${c.everyDays} days`, run: () => onJump("home") });
      }
    }
    if (moduleOn(db, "health")) for (const m of db.medicines) {
      if (match(m.name, m.dose)) out.push({ id: `med:${m.id}`, title: m.name, subtitle: m.dose, run: () => onJump("health") });
    }
    for (const r of db.reminders.slice(-20).reverse()) {
      if (match(r.title, r.note)) out.push({ id: `rem:${r.id}`, title: r.title, subtitle: `${fmtDate(r.date)} ${r.time}`, run: () => onJump("attention") });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, db, includeDev, onJump]);

  useEffect(() => setCursor(0), [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, cmds.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
      return;
    }
    if (e.key === "Enter" && cmds[cursor]) {
      e.preventDefault();
      cmds[cursor].run();
      onClose();
    }
  };

  return (
    <div className="pal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pal card" data-testid="palette">
        <input className="pal-input" ref={inputRef} placeholder="Search sections, records, attention…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown} />
        <div className="pal-list">
          {cmds.slice(0, 12).map((c, i) => (
            <button key={c.id} className={i === cursor ? "pal-row on" : "pal-row"} onMouseEnter={() => setCursor(i)} onClick={() => { c.run(); onClose(); }}>
              <span className="pal-title">{c.title}</span>
              {c.subtitle ? <span className="pal-sub muted">{c.subtitle}</span> : null}
            </button>
          ))}
          {cmds.length === 0 ? <p className="muted pal-row">No matches.</p> : null}
        </div>
        <div className="pal-foot muted small">↑↓ to move · Enter to open · Esc to close</div>
      </div>
    </div>
  );
}

/**
 * Keyboard order for Ctrl+1..9 across the sidebar. Devlab comes last.
 */
function of(section: SectionId): number {
  return ["today", "attention", "money", "vehicles", "health", "home", "travel", "papers", "notes", "media", "settings"].indexOf(section);
}

/** Workspace sections always show; module sections follow the module switches in Settings. */
function moduleOn(db: DB, section: string): boolean {
  if (section === "today" || section === "attention" || section === "settings" || section === "devlab") return true;
  if (section === "notes") return !["notes", "kanban"].every((id) => db.settings.modules.find((m) => m.id === id)?.enabled === false);
  const state = db.settings.modules.find((m) => m.id === section);
  return state ? state.enabled : true;
}
