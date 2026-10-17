import { useMemo, useState } from "react";
import { useStore } from "../store";
import { fmtDate, todayISO, uid } from "@core/format";
import type { Trip } from "@core/types";

/** Travel module on desktop (v0.14): journey summaries with a minimal editor. */
export function Travel() {
  const { db, update } = useStore();

  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());

  const rows = useMemo(() => [...db.trips].sort((a, b) => b.start.localeCompare(a.start)), [db.trips]);

  const addTrip = () => {
    if (!name.trim() || !destination.trim()) return;
    const row: Trip = {
      id: uid(),
      name: name.trim().slice(0, 60),
      destination: destination.trim().slice(0, 80),
      start: start || todayISO(),
      end: end || todayISO(),
      travellers: 1,
      budget: 0,
      packing: [],
      itinerary: [],
      docs: [],
      createdAt: todayISO(),
    };
    update((d) => ({ ...d, trips: [row, ...d.trips] }));
    setName("");
    setDestination("");
  };

  return (
    <div className="two-stack">
      <section className="card">
        <div className="row spread">
          <h2>Trips</h2>
          <button className="print-btn small-btn no-print" onClick={() => window.print()}>Print</button>
        </div>
        <div className="add-row no-print">
          <input className="grow" placeholder="Trip name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="grow" placeholder="Destination" value={destination} onChange={(e) => setDestination(e.target.value)} />
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          <button className="primary" onClick={addTrip}>Add</button>
        </div>
        <table className="table wide">
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="muted">{t.destination}</td>
                <td className="muted small">{fmtDate(t.start)} → {fmtDate(t.end)}</td>
                <td className="muted small">{t.packing.length} packed · {t.itinerary.length} planned</td>
                <td className="right"><button className="link danger" onClick={() => update((d) => ({ ...d, trips: d.trips.filter((x) => x.id !== t.id) }))}>✕</button></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={5} className="muted">No trips yet. Add one — packing, itinerary and costs sync from the phone.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
