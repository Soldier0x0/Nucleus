import { useMemo, useState } from "react";
import { useStore } from "../store";
import { daysBetween, money, todayISO, uid } from "@core/format";
import type { Appliance, Chore, UtilityBill, UtilityKind } from "@core/types";

const UTILITY_KINDS: UtilityKind[] = ["electricity", "water", "lpg", "internet"];

/** Home module on desktop: appliances, utility bills and chores (v0.14). */
export function Home() {
  const { db, update } = useStore();
  const today = todayISO();

  const [applianceName, setApplianceName] = useState("");
  const [applianceRoom, setApplianceRoom] = useState("Kitchen");
  const [choreName, setChoreName] = useState("");
  const [choreEvery, setChoreEvery] = useState("7");
  const [billKind, setBillKind] = useState<UtilityKind>("electricity");
  const [billDate, setBillDate] = useState(today);
  const [billAmount, setBillAmount] = useState("");

  const bills = useMemo(() => [...db.utilities].sort((a, b) => b.date.localeCompare(a.date)), [db.utilities]);

  const addAppliance = () => {
    if (!applianceName.trim()) return;
    const row: Appliance = { id: uid(), name: applianceName.trim().slice(0, 60), room: applianceRoom, plans: [], createdAt: today };
    update((d) => ({ ...d, appliances: [row, ...d.appliances] }));
    setApplianceName("");
  };
  const addChore = () => {
    if (!choreName.trim()) return;
    const every = Math.max(1, Math.min(365, Number(choreEvery) || 7));
    const row: Chore = { id: uid(), name: choreName.trim().slice(0, 60), everyDays: every, lastDone: today };
    update((d) => ({ ...d, chores: [row, ...d.chores] }));
    setChoreName("");
    setChoreEvery(String(every));
  };
  const addBill = () => {
    const amount = Number.parseFloat(billAmount.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount < 0) return;
    const row: UtilityBill = { id: uid(), kind: billKind, date: billDate || today, amount };
    update((d) => ({ ...d, utilities: [row, ...d.utilities] }));
    setBillAmount("");
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="caption">{db.appliances.length} appliances · {db.chores.length} chores · {bills.length} bills logged</p>
          <h1>Home</h1>
        </div>
        <div className="right no-print">
          <button className="small-btn" onClick={() => window.print()}>Print</button>
        </div>
      </header>
      <div className="workcol">
        <div className="two-stack">
          <section className="card">
            <h2>Appliances</h2>
            <div className="add-row no-print">
              <input className="grow filter" placeholder="Appliance name" value={applianceName} onChange={(e) => setApplianceName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addAppliance()} />
              <select className="filter" value={applianceRoom} onChange={(e) => setApplianceRoom(e.target.value)}>
                {["Kitchen", "Bedroom", "Bathroom", "Living room", "Study", "Other"].map((r) => <option key={r}>{r}</option>)}
              </select>
              <button className="primary" onClick={addAppliance}>Add</button>
            </div>
            <table className="table wide">
              <tbody>
                {db.appliances.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td className="muted">{a.room}</td>
                    {a.warrantyUntil ? <td className="muted small">warranty till {a.warrantyUntil}</td> : <td />}
                    <td className="right no-print"><button className="link danger" onClick={() => update((d) => ({ ...d, appliances: d.appliances.filter((x) => x.id !== a.id) }))}>✕</button></td>
                  </tr>
                ))}
                {db.appliances.length === 0 ? <tr><td colSpan={4} className="muted">No appliances yet.</td></tr> : null}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2>Utility bills</h2>
            <div className="add-row no-print">
              <select className="filter" value={billKind} onChange={(e) => setBillKind(e.target.value as UtilityKind)}>
                {UTILITY_KINDS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
              </select>
              <input type="date" className="filter" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
              <input className="w-amount filter" inputMode="decimal" placeholder="Amount" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} />
              <button className="primary" onClick={addBill}>Add</button>
            </div>
            <table className="table wide">
              <tbody>
                {bills.map((u) => (
                  <tr key={u.id}>
                    <td><span className="cat">{u.kind}</span></td>
                    <td className="muted">{u.date}</td>
                    <td className="right num">{money(u.amount, db.settings.currency)}</td>
                    <td className="right no-print"><button className="link danger" onClick={() => update((d) => ({ ...d, utilities: d.utilities.filter((x) => x.id !== u.id) }))}>✕</button></td>
                  </tr>
                ))}
                {bills.length === 0 ? <tr><td colSpan={4} className="muted">No bills yet.</td></tr> : null}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2>Chores</h2>
            <div className="add-row no-print">
              <input className="grow filter" placeholder="Chore" value={choreName} onChange={(e) => setChoreName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addChore()} />
              <input type="number" min={1} className="w-amount filter" placeholder="Days" value={choreEvery} onChange={(e) => setChoreEvery(e.target.value)} />
              <button className="primary" onClick={addChore}>Add</button>
            </div>
            <table className="table wide">
              <tbody>
                {db.chores.map((c) => {
                  const left = c.everyDays - daysBetween(c.lastDone, today);
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td className="muted">every {c.everyDays} days</td>
                      <td className={left <= 0 ? "error" : "muted"}>{left <= 0 ? `due ${-left}d ago` : `${left}d left`}</td>
                      <td className="right no-print">
                        <button className="small-btn" onClick={() => update((d) => ({ ...d, chores: d.chores.map((x) => (x.id === c.id ? { ...x, lastDone: today } : x)) }))}>Done today</button>
                        <button className="link danger" onClick={() => update((d) => ({ ...d, chores: d.chores.filter((x) => x.id !== c.id) }))}>✕</button>
                      </td>
                    </tr>
                  );
                })}
                {db.chores.length === 0 ? <tr><td colSpan={4} className="muted">No chores yet.</td></tr> : null}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </>
  );
}
