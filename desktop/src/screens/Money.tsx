import { useMemo, useState } from "react";
import { useStore } from "../store";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@core/defaults";
import { categorySplit, monthFlow } from "@core/moneyDesk";
import { monthSeries } from "@core/intelligence";
import { fmtDate, money, monthKey, todayISO, uid } from "@core/format";
import type { Settings, Txn } from "@core/types";
import { Bars, Donut, PALETTE } from "../components/Charts";
import { readViews, type SavedView } from "../platform/savedViews";
import { exportKindFile } from "../platform/exporters";

const blank = { type: "expense" as Txn["type"], amount: "", category: "Food", date: todayISO(), note: "" };

const monthName = (month: string) => {
  const [y, m] = month.split("-");
  if (!y || !m) return month;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });
};

export function Money() {
  const { db, update, setSettings } = useStore();
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [draft, setDraft] = useState(blank);
  const [exporting, setExporting] = useState(false);
  const views = useMemo(() => readViews(db).filter((v) => v.section === "money"), [db]);

  const flow = monthFlow(db.txns, month);
  const split = useMemo(() => categorySplit(db.txns, month), [db.txns, month]);
  const trend = useMemo(() => monthSeries(db, 6), [db]);
  const currency = db.settings.currency;
  const namedCategories = [...new Set([...db.settings.moneyNames, ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])].sort();
  const monthInMonth = db.txns.filter((t) => t.date.slice(0, 7) === month);

  const rows = monthInMonth
    .filter((t) => catFilter === "all" || t.category === catFilter)
    .filter((t) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [t.category, t.item, t.note].some((v) => v?.toLowerCase().includes(q));
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const add = () => {
    const amount = Number.parseFloat(draft.amount.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const row: Txn = { id: uid(), type: draft.type, amount, category: draft.category.trim() || "Other", date: draft.date || todayISO() };
    if (draft.note.trim()) row.note = draft.note.trim().slice(0, 200);
    update((d) => ({ ...d, txns: [row, ...d.txns] }));
    setDraft({ ...blank, type: draft.type, category: draft.category, date: draft.date });
  };

  const remove = (id: string) => update((d) => ({ ...d, txns: d.txns.filter((t) => t.id !== id) }));

  const writeViews = (views: SavedView[]) => setSettings({ ...db.settings, desktopViews: [...readViews(db).filter((v) => v.section !== "money"), ...views] } as Partial<Settings>);
  const saveView = () => {
    if (!query.trim() && catFilter === "all") return;
    const name = window.prompt("Name this view");
    if (!name?.trim()) return;
    const view: SavedView = { id: uid(), name: name.trim(), section: "money", payload: { month, query: query.trim(), ...(catFilter !== "all" ? { tag: catFilter } : {}) } };
    writeViews([...readViews(db).filter((v) => v.section === "money"), view]);
  };
  const dropView = (id: string) => writeViews(readViews(db).filter((v) => v.section === "money" && v.id !== id));
  const applyView = (view: SavedView) => {
    setMonth(view.payload.month ?? monthKey(todayISO()));
    setQuery(view.payload.query);
    setCatFilter(view.payload.tag ?? "all");
  };

  const runExport = async () => {
    setExporting(true);
    try {
      await exportKindFile(db, "transactions");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="caption">{monthInMonth.length} transactions · {monthName(month)}</p>
          <h1>Money</h1>
        </div>
        <div className="right no-print">
          <button className="small-btn" onClick={saveView}>Save view</button>
          <button className="small-btn" onClick={() => window.print()}>Print</button>
          <button className="primary" onClick={runExport} disabled={exporting} data-testid="money-export-csv">
            {exporting ? "Saving…" : "Export CSV"}
          </button>
        </div>
      </header>

      <div className="workcol">
        <div className="filters no-print">
          <label className="filter">
            <b>Month</b>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value || monthKey(todayISO()))} style={{ border: 0, background: "none", padding: 0 }} />
          </label>
          <label className="filter">
            <b>{catFilter === "all" ? "All categories" : catFilter}</b>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ border: 0, background: "none", padding: 0, color: "inherit", fontSize: "inherit" }}>
              <option value="all">All categories</option>
              {namedCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="filter grow" style={{ maxWidth: 300 }}>
            <input className="grow" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transactions" style={{ border: 0, background: "none", padding: 0 }} />
          </div>
          <div className="row saved-view-row" data-testid="money-views" style={{ marginLeft: "auto" }}>
            {views.map((v) => (
              <span key={v.id} className="chip-view">
                <button className="chip" onClick={() => applyView(v)}>{v.name}</button>
                <button className="link danger" title="Remove view" onClick={() => dropView(v.id)}>✕</button>
              </span>
            ))}
          </div>
        </div>

        <div className="kpis">
          <section className="kpi card"><span className="lab">In</span><div className="val num">{money(flow.in, currency)}</div><div className="note">money in this month</div></section>
          <section className="kpi card"><span className="lab">Out</span><div className="val num">{money(flow.out, currency)}</div><div className="note">{split.length} categories touched</div></section>
          <section className="kpi card">
            <span className="lab">Net</span>
            <div className="val num">{money(flow.in - flow.out, currency)}</div>
            <div className="note">
              <span className={`delta ${flow.in - flow.out >= 0 ? "good" : "bad"}`}>{flow.in - flow.out >= 0 ? "Positive" : "Over"}</span>
              <span>in − out</span>
            </div>
          </section>
          <section className="kpi card"><span className="lab">Rows</span><div className="val num">{rows.length}</div><div className="note">matching the filters below</div></section>
        </div>

        <div className="workcols" style={{ padding: 0 }}>
          <section className="card tablecard" style={{ padding: 0, overflow: "hidden" }}>
            <div className="add-row no-print" style={{ padding: "14px 16px" }}>
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Txn["type"] })} className="filter">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <input className="filter w-amount" inputMode="decimal" placeholder="Amount" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              <input list="money-categories" className="filter w-cat" placeholder="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              <datalist id="money-categories">
                {namedCategories.map((c) => <option key={c} value={c} />)}
              </datalist>
              <input type="date" className="filter" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              <input className="filter grow" placeholder="Note (optional)" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              <button className="primary" onClick={add}>{draft.type === "income" ? "Add income" : "Add expense"}</button>
            </div>
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Category</th><th>Note</th><th className="right">Amount</th><th className="no-print"></th></tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="muted">{fmtDate(t.date)}</td>
                    <td><span className="cat"><i style={{ background: PALETTE[namedCategories.indexOf(t.category) === -1 ? 0 : namedCategories.indexOf(t.category) % PALETTE.length] }} />{t.category}</span>{t.item ? <span className="muted small"> · {t.item}</span> : null}</td>
                    <td className="muted">{t.note ?? ""}{t.transfer ? " (transfer)" : ""}{t.cash ? " (cash)" : ""}</td>
                    <td className={`right num ${t.type === "income" ? "pos" : ""}`}>{t.type === "income" ? "+" : "−"}{money(t.amount, currency)}</td>
                    <td className="right no-print"><button className="link danger" onClick={() => remove(t.id)} title="Delete">✕</button></td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={5} className="muted">No transactions match. Log one above or widen the filters.</td></tr> : null}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="muted small">
                    Showing {rows.length} of {monthInMonth.length} in {monthName(month)} · {db.txns.length} rows in the whole log
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <div className="rail">
            <section className="card center">
              <h2 className="rail-label" style={{ textAlign: "left" }}>Categories</h2>
              {split.length ? (
                <>
                  <Donut
                    slices={split.map((s, i) => ({ label: s.category, value: s.amount, color: PALETTE[i % PALETTE.length] }))}
                    centerTop={money(flow.out, currency)}
                    centerBottom="spent"
                  />
                  <table className="table legend">
                    <tbody>
                      {split.slice(0, 6).map((s, i) => (
                        <tr key={s.category}>
                          <td><span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} /> {s.category}</td>
                          <td className="right">{money(s.amount, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="muted">No spending this month.</p>
              )}
            </section>

            <section className="card">
              <h2 className="rail-label">6-month trend</h2>
              <Bars data={trend.map((m) => ({ label: m.label, value: m.value }))} format={(v) => money(v, currency)} />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
