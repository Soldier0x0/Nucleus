import { useState } from "react";
import { Select } from "../components/Select";
import { ScreenToolbar } from "../components/ScreenToolbar";
import { useStore } from "../store";
import { fmtDate, todayISO, uid } from "@core/format";
import type { CycleDay, CycleFlow, Medicine, WaterTime } from "@core/types";

const FLOWS: CycleFlow[] = ["light", "medium", "heavy"];

/** Health module on desktop: cycle sits under Health per the IA decision (v0.14). */
export function Health() {
  const { db, update } = useStore();
  const today = todayISO();

  const [flow, setFlow] = useState<CycleFlow>("medium");
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [waterHour, setWaterHour] = useState("9");
  const [waterMinute, setWaterMinute] = useState("0");

  const days = [...db.cycle.days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  const loggedToday = db.cycle.days.find((d) => d.date === today);
  const medicines = [...db.medicines].sort((a, b) => a.name.localeCompare(b.name));

  const logToday = () => {
    if (loggedToday) return;
    const row: CycleDay = { id: uid(), date: today, bleeding: "flow", flow };
    update((d) => ({ ...d, cycle: { ...d.cycle, days: [...d.cycle.days, row] } }));
  };
  const addMedicine = () => {
    if (!medName.trim()) return;
    const row: Medicine = {
      id: uid(),
      name: medName.trim().slice(0, 60),
      times: [{ hour: 8, minute: 0 }],
      dose: medDose.trim().slice(0, 60) || undefined,
      active: true,
      log: [],
      createdAt: today,
    };
    update((d) => ({ ...d, medicines: [row, ...d.medicines] }));
    setMedName("");
    setMedDose("");
  };
  const addWaterTime = () => {
    const hour = Math.min(23, Math.max(0, Number(waterHour) || 0));
    const minute = Math.min(59, Math.max(0, Number(waterMinute) || 0));
    const row: WaterTime = { id: uid(), hour, minute };
    update((d) => ({ ...d, water: { ...d.water, times: [...d.water.times, row] } }));
  };

  return (
    <>
      <ScreenToolbar>
        <div>
          <p className="caption">{db.cycle.days.length} cycle days · {medicines.length} medicines · {db.water.times.length} water times</p>
          <h1>Health</h1>
        </div>
        <div className="right no-print">
          <button className="small-btn" onClick={() => window.print()}>Print</button>
        </div>
      </ScreenToolbar>
      <div className="workcol">
        <div className="two-stack">
          <section className="card">
            <h2>Cycle</h2>
            {loggedToday ? (
              <p className="muted small no-print">Today is already logged as {loggedToday.flow ?? loggedToday.bleeding ?? "noted"}.</p>
            ) : (
              <div className="add-row no-print">
                <Select value={flow} onChange={(f) => setFlow(f as CycleFlow)} ariaLabel="Flow" options={FLOWS.map((f) => ({ value: f, label: f }))} />
                <button className="primary" onClick={logToday}>Log flow today</button>
              </div>
            )}
            <table className="table wide">
              <tbody>
                {days.map((d) => (
                  <tr key={d.id}>
                    <td>{fmtDate(d.date)}</td>
                    <td>{d.bleeding === "flow" ? (d.flow ?? "flow") : d.bleeding === "spotting" ? "spotting" : "—"}</td>
                    {d.symptom ? <td className="muted small">{d.symptoms?.join(", ") || d.symptom}</td> : <td className="muted small">{d.ended && !d.bleeding ? "ended" : ""}</td>}
                    <td className="right no-print"><button className="link danger" onClick={() => update((s) => ({ ...s, cycle: { ...s.cycle, days: s.cycle.days.filter((x) => x.id !== d.id) } }))}>✕</button></td>
                  </tr>
                ))}
                {days.length === 0 ? <tr><td colSpan={4} className="muted">No cycle days yet.</td></tr> : null}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2>Medicines</h2>
            <div className="add-row no-print">
              <input className="grow filter" placeholder="Medicine name" value={medName} onChange={(e) => setMedName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMedicine()} />
              <input className="grow filter" placeholder="Dose (optional)" value={medDose} onChange={(e) => setMedDose(e.target.value)} />
              <button className="primary" onClick={addMedicine}>Add</button>
            </div>
            <table className="table wide">
              <tbody>
                {medicines.map((m) => (
                  <tr key={m.id} className={m.active ? "" : "muted"}>
                    <td>{m.name}</td>
                    <td className="muted small">{m.dose ?? "—"} · {m.times.length}× daily</td>
                    <td className="right no-print">
                      <button className="small-btn" onClick={() => update((d) => ({ ...d, medicines: d.medicines.map((x) => (x.id === m.id ? { ...x, active: !x.active } : x)) }))}>{m.active ? "Pause" : "Resume"}</button>
                      <button className="link danger" onClick={() => update((d) => ({ ...d, medicines: d.medicines.filter((x) => x.id !== m.id) }))}>✕</button>
                    </td>
                  </tr>
                ))}
                {medicines.length === 0 ? <tr><td colSpan={3} className="muted">No medicines yet.</td></tr> : null}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2>Water</h2>
            <div className="add-row no-print">
              <input type="number" min={0} max={23} className="w-amount filter" value={waterHour} onChange={(e) => setWaterHour(e.target.value)} />
              <span className="muted">:</span>
              <input type="number" min={0} max={59} className="w-amount filter" value={waterMinute} onChange={(e) => setWaterMinute(e.target.value)} />
              <button className="primary" onClick={addWaterTime}>Add reminder time</button>
            </div>
            <table className="table wide">
              <tbody>
                {db.water.times.map((t) => (
                  <tr key={t.id}>
                    <td>{String(t.hour).padStart(2, "0")}:{String(t.minute).padStart(2, "0")}</td>
                    <td className="right no-print"><button className="link danger" onClick={() => update((d) => ({ ...d, water: { ...d.water, times: d.water.times.filter((x) => x.id !== t.id) } }))}>✕</button></td>
                  </tr>
                ))}
                {db.water.times.length === 0 ? <tr><td className="muted">No water reminder times yet.</td></tr> : null}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </>
  );
}
