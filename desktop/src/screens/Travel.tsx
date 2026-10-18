import { useMemo, useState } from "react";
import { useStore } from "../store";
import { fmtDate, todayISO, uid } from "@core/format";
import type { Settings, Trip } from "@core/types";
import { readViews, type SavedView } from "../platform/savedViews";
import { exportKindFile } from "../platform/exporters";

/** Travel module on desktop: journey summaries with a minimal editor + saved views (v0.15). */
export function Travel() {
  const { db, update, setSettings } = useStore();

  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [query, setQuery] = useState("");
  const views = useMemo(() => readViews(db).filter((v) => v.section === "travel"), [db]);

  const rows = useMemo(
    () =>
      [...db.trips]
        .filter((t) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return [t.name, t.destination].some((v) => v?.toLowerCase().includes(q));
        })
        .sort((a, b) => b.start.localeCompare(a.start)),
    [db.trips, query],
  );

  const writeViews = (views: SavedView[]) => setSettings({ ...db.settings, desktopViews: [...readViews(db).filter((v) => v.section !== "travel"), ...views] } as Partial<Settings>);
  const saveView = () => {
    if (!query.trim()) return;
    const label = window.prompt("Name this view");
    if (!label?.trim()) return;
    const view: SavedView = { id: uid(), name: label.trim(), section: "travel", payload: { query: query.trim() } };
    writeViews([...readViews(db).filter((v) => v.section === "travel"), view]);
  };
  const dropView = (id: string) => writeViews(readViews(db).filter((v) => v.section === "travel" && v.id !== id));
  const applyView = (view: SavedView) => setQuery(view.payload.query);

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
    <>
      <header className="topbar">
        <div>
          <p className="caption">{db.trips.length} trips · {rows.length} shown</p>
          <h1>Travel</h1>
        </div>
        <div className="right no-print">
          <button className="small-btn" onClick={saveView}>Save view</button>
          <button className="small-btn" onClick={() => window.print()}>Print</button>
          <button className="small-btn" onClick={() => void exportKindFile(db, "calendar")}>Calendar (.ics)</button>
        </div>
      </header>
      <div className="workcol">
        <div className="filters no-print">
          <div className="filter grow" style={{ maxWidth: 300 }}>
            <input className="grow" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or destination" style={{ border: 0, background: "none", padding: 0 }} />
          </div>
          <div className="row saved-view-row" data-testid="travel-views" style={{ marginLeft: "auto" }}>
            {views.map((v) => (
              <span key={v.id} className="chip-view">
                <button className="chip" onClick={() => applyView(v)}>{v.name}</button>
                <button className="link danger" title="Remove view" onClick={() => dropView(v.id)}>✕</button>
              </span>
            ))}
          </div>
        </div>
        <section className="card tablecard" style={{ padding: 0, overflow: "hidden" }}>
          <div className="add-row no-print" style={{ padding: "14px 16px" }}>
            <input className="grow filter" placeholder="Trip name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="grow filter" placeholder="Destination" value={destination} onChange={(e) => setDestination(e.target.value)} />
            <input type="date" className="filter" value={start} onChange={(e) => setStart(e.target.value)} />
            <input type="date" className="filter" value={end} onChange={(e) => setEnd(e.target.value)} />
            <button className="primary" onClick={addTrip}>Add trip</button>
          </div>
          <table className="table wide">
            <thead>
              <tr><th>Trip</th><th>Destination</th><th>Dates</th><th>Progress</th><th className="no-print"></th></tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="bold-text">{t.name}</td>
                  <td className="muted">{t.destination}</td>
                  <td className="muted small">{fmtDate(t.start)} → {fmtDate(t.end)}</td>
                  <td className="muted small">{t.packing.length} packed · {t.itinerary.length} planned</td>
                  <td className="right no-print"><button className="link danger" onClick={() => update((d) => ({ ...d, trips: d.trips.filter((x) => x.id !== t.id) }))}>✕</button></td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={5} className="muted">No trips yet. Add one — packing, itinerary and costs sync from the phone.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
