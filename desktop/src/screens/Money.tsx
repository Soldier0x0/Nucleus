import { useMemo, useState } from "react";
import { useStore } from "../store";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@core/defaults";
import { categorySplit, monthFlow } from "@core/moneyDesk";
import { monthSeries } from "@core/intelligence";
import { money, monthKey, todayISO, uid } from "@core/format";
import type { Txn } from "@core/types";
import { Bars, Donut, PALETTE } from "../components/Charts";

const blank = { type: "expense" as Txn["type"], amount: "", category: "Food", date: todayISO(), note: "" };

export function Money() {
  const { db, update, setSettings } = useStore();
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(blank);

  const flow = monthFlow(db.txns, month);
  const split = useMemo(() => categorySplit(db.txns, month), [db.txns, month]);
  const trend = useMemo(() => monthSeries(db, 6), [db.txns]);
  const currency = db.settings.currency;
  const namedCategories = [...new Set([...db.settings.moneyNames, ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])].sort();

  const rows = db.txns
    .filter((t) => t.date.slice(0, 7) === month)
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

  return (
    <div className="stack">
      <div className="toolbar card">
        <label className="field inline">
          <span>Month</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value || monthKey(todayISO()))} />
        </label>
        <label className="field inline grow">
          <span>Search</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="category, item or note" />
        </label>
        <label className="field inline">
          <span>Currency</span>
          <select value={currency} onChange={(e) => setSettings({ currency: e.target.value })}>
            {["INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "SGD", "JPY"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="stat-row">
        <div className="stat card"><span className="muted small">In</span><strong>{money(flow.in, currency)}</strong></div>
        <div className="stat card"><span className="muted small">Out</span><strong>{money(flow.out, currency)}</strong></div>
        <div className="stat card"><span className="muted small">Net</span><strong>{money(flow.in - flow.out, currency)}</strong></div>
        <div className="stat card"><span className="muted small">Rows</span><strong>{rows.length}</strong></div>
      </div>

      <div className="money-grid">
        <section className="card">
          <h2>Transactions</h2>
          <div className="add-row">
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Txn["type"] })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <input className="w-amount" inputMode="decimal" placeholder="Amount" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            <input list="money-categories" className="w-cat" placeholder="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            <datalist id="money-categories">
              {namedCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
            <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            <input className="grow" placeholder="Note (optional)" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            <button className="primary" onClick={add}>Add</button>
          </div>
          <table className="table wide">
            <thead>
              <tr><th>Date</th><th>Category</th><th>Note</th><th className="right">Amount</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>{t.category}{t.item ? <span className="muted small"> · {t.item}</span> : null}</td>
                  <td className="muted">{t.note ?? ""}{t.transfer ? " (transfer)" : ""}{t.cash ? " (cash)" : ""}</td>
                  <td className={`right ${t.type === "income" ? "pos" : ""}`}>{t.type === "income" ? "+" : "−"}{money(t.amount, currency)}</td>
                  <td className="right"><button className="link danger" onClick={() => remove(t.id)} title="Delete">✕</button></td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={5} className="muted">No transactions this month.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <div className="stack">
          <section className="card center">
            <h2>Categories</h2>
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
            <h2>6-month trend</h2>
            <Bars data={trend.map((m) => ({ label: m.label, value: m.value }))} format={(v) => money(v, currency)} />
          </section>
        </div>
      </div>
    </div>
  );
}
