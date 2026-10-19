import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import { PART_LABEL, serviceSchedule } from "@core/serviceCatalog";
import { vehicleStats } from "@core/intelligence";
import { fuelMileagePoints, serviceLeftLine } from "@core/vehicleMath";
import { odometerEstimate, odometerEstimateLabel } from "@core/fuelCapture";
import { fmtDate, money, num, todayISO, uid } from "@core/format";
import type { FuelEntry, FuelFillKind, OdometerLog, Vehicle } from "@core/types";
import { StationFinder } from "../components/StationFinder";

export function Vehicles({ focusId }: { focusId?: string }) {
  const { db, update } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(db.vehicles[0]?.id ?? null);
  const vehicle = db.vehicles.find((v) => v.id === selectedId) ?? db.vehicles[0] ?? null;

  useEffect(() => {
    if (focusId && db.vehicles.some((v) => v.id === focusId)) setSelectedId(focusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  return (
    <>
      <header className="topbar">
        <div>
          <p className="caption">{db.fuel.length} fills logged · {db.services.length} services · {db.settings.distanceUnit}</p>
          <h1>Vehicles</h1>
        </div>
      </header>
      <div className="workcol" style={{ padding: "18px 28px 40px" }}>
        <div className="vehicles-grid">
          <aside className="card v-list">
            <h2>Garage</h2>
            {db.vehicles.length === 0 ? <p className="muted">No vehicles yet. Import a phone backup to see them.</p> : null}
            {db.vehicles.map((v) => (
              <button key={v.id} className={v.id === vehicle?.id ? "nav on" : "nav"} onClick={() => setSelectedId(v.id)}>
                {v.name}
                <span className="muted small"> {v.plate ? `· ${v.plate}` : ""}</span>
              </button>
            ))}
          </aside>
          <div className="stack">
            {vehicle ? <VehicleDetail vehicle={vehicle} /> : null}
            <StationFinder />
          </div>
        </div>
      </div>
    </>
  );
}

function VehicleDetail({ vehicle }: { vehicle: Vehicle }) {
  const { db, update } = useStore();
  const today = todayISO();
  const stats = useMemo(() => vehicleStats(db, vehicle), [db, vehicle]);
  const schedule = useMemo(() => serviceSchedule(db, vehicle, today), [db, vehicle, today]);
  const odo = useMemo(() => odometerEstimate(db, vehicle, today), [db, vehicle, today]);
  const fuels = [...db.fuel.filter((f) => f.vehicleId === vehicle.id)].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const services = [...db.services.filter((s) => s.vehicleId === vehicle.id)].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const logs = [...db.odometerLogs.filter((l) => l.vehicleId === vehicle.id)].sort((a, b) => b.at.localeCompare(a.at));

  const [fuelDraft, setFuelDraft] = useState({ date: todayISO(), odometer: "", litres: "", rate: "", station: "", fillKind: "full" as FuelFillKind });
  const [logDraft, setLogDraft] = useState({ date: todayISO(), odometer: "" });

  const addFuel = () => {
    const litres = Number.parseFloat(fuelDraft.litres.replace(/,/g, ""));
    const rate = Number.parseFloat(fuelDraft.rate.replace(/,/g, ""));
    const odometer = Number.parseFloat(fuelDraft.odometer.replace(/,/g, ""));
    if (!Number.isFinite(litres) && !Number.isFinite(rate) && !Number.isFinite(odometer)) return;
    const price = Number.isFinite(rate) ? rate : 0;
    const volume = Number.isFinite(litres) ? litres : 0;
    const row: FuelEntry = {
      id: uid(),
      vehicleId: vehicle.id,
      date: fuelDraft.date || todayISO(),
      odometer: Number.isFinite(odometer) ? Math.round(odometer) : odo.value,
      ...(Number.isFinite(odometer) ? {} : { odometerEstimated: true }),
      litres: volume,
      price,
      total: Math.round(volume * price * 100) / 100,
      fillKind: fuelDraft.fillKind,
    };
    if (fuelDraft.station.trim()) row.station = fuelDraft.station.trim().slice(0, 80);
    update((d) => ({ ...d, fuel: [row, ...d.fuel] }));
    setFuelDraft({ date: row.date, odometer: "", litres: "", rate: "", station: "", fillKind: "full" });
  };

  const addLog = () => {
    const value = Number.parseFloat(logDraft.odometer.replace(/,/g, ""));
    if (!Number.isFinite(value)) return;
    // Plain date, like fuel rows: parsing into an ISO instant lets timezones
    // move the reading onto the neighbouring calendar day (UTC+13 back a day).
    const at = logDraft.date || todayISO();
    const row: OdometerLog = { id: uid(), vehicleId: vehicle.id, at, odometer: Math.round(value) };
    update((d) => ({ ...d, odometerLogs: [row, ...d.odometerLogs] }));
    setLogDraft({ date: at, odometer: "" });
  };

  const removeFuel = (id: string) => update((d) => ({ ...d, fuel: d.fuel.filter((f) => f.id !== id) }));
  const removeLog = (id: string) => update((d) => ({ ...d, odometerLogs: d.odometerLogs.filter((l) => l.id !== id) }));
  const removeService = (id: string) => update((d) => ({ ...d, services: d.services.filter((s) => s.id !== id) }));

  const unit = db.settings.distanceUnit;

  return (
    <>
      <section className="card">
        <div className="row spread">
          <h2>{vehicle.name}</h2>
          <span className="muted">{vehicle.make} {vehicle.model} · {vehicle.plate ?? "no plate"}</span>
        </div>
        <div className="stat-row">
          <div className="stat card">
            <span className="muted small">Odometer</span>
            <strong>{odometerEstimateLabel(odo)} {unit}</strong>
            <span className="muted small">{odo.estimated ? `estimated · last reading ${odo.daysAgo}d ago` : odo.stale ? `last reading ${odo.daysAgo}d ago` : "typed reading"}</span>
          </div>
          <div className="stat card"><span className="muted small">Avg mileage</span><strong>{Number.isFinite(stats.avgMileage) ? num(stats.avgMileage, 1) : "—"}</strong><span className="muted small">{unit}/L</span></div>
          <div className="stat card"><span className="muted small">Cost / {unit}</span><strong>{Number.isFinite(stats.costPerKm) ? num(stats.costPerKm, 2) : "—"}</strong><span className="muted small">fuel, tracked distance</span></div>
          <div className="stat card"><span className="muted small">Fuel this month</span><strong>{money(stats.monthFuel, db.settings.currency)}</strong><span className="muted small">{services.length} services logged</span></div>
        </div>
      </section>

      <section className="card">
        <h2>Service due per part</h2>
        <table className="table wide">
          <thead><tr><th>Part</th><th className="right">Last at</th><th className="right">Due at</th><th className="right">Left</th><th>Due date</th><th>State</th></tr></thead>
          <tbody>
            {schedule.map((d) => (
              <tr key={d.part.id}>
                <td>{PART_LABEL[d.part.id]}</td>
                <td className="right">{num(d.lastOdo, 0)}</td>
                <td className="right">{num(d.dueOdo, 0)}</td>
                <td className="right">{d.kmLeft <= 0 ? `${num(-d.kmLeft, 0)} over` : `${num(d.kmLeft, 0)} ${unit}`}</td>
                <td>{fmtDate(d.dueDate)}{d.daysLeft <= 0 ? <span className="muted small"> ({-d.daysLeft}d ago)</span> : null}</td>
                <td><span className={`chip state-${d.state}`}>{d.state}</span></td>
              </tr>
            ))}
            {schedule.length === 0 ? <tr><td colSpan={6} className="muted">No parts are tracked for this vehicle.</td></tr> : null}
          </tbody>
        </table>
        <p className="muted small">{serviceLeftLine(stats.service.remaining)} · interval {num(stats.service.interval, 0)} {unit}</p>
      </section>

      <section className="card">
        <h2>Fuel log</h2>
        <div className="add-row">
          <input type="date" value={fuelDraft.date} onChange={(e) => setFuelDraft({ ...fuelDraft, date: e.target.value })} />
          <input className="w-amount" inputMode="decimal" placeholder="Odometer" value={fuelDraft.odometer} onChange={(e) => setFuelDraft({ ...fuelDraft, odometer: e.target.value })} />
          <input className="w-amount" inputMode="decimal" placeholder="Litres" value={fuelDraft.litres} onChange={(e) => setFuelDraft({ ...fuelDraft, litres: e.target.value })} />
          <input className="w-amount" inputMode="decimal" placeholder="Rate" value={fuelDraft.rate} onChange={(e) => setFuelDraft({ ...fuelDraft, rate: e.target.value })} />
          <input className="w-cat" placeholder="Station" value={fuelDraft.station} onChange={(e) => setFuelDraft({ ...fuelDraft, station: e.target.value })} />
          <select value={fuelDraft.fillKind} onChange={(e) => setFuelDraft({ ...fuelDraft, fillKind: e.target.value as FuelFillKind })}>
            <option value="full">Full tank</option>
            <option value="partial">Partial</option>
          </select>
          <button className="primary" onClick={addFuel}>Add</button>
        </div>
        <table className="table wide">
          <thead><tr><th>Date</th><th className="right">Odometer</th><th className="right">Litres</th><th className="right">Rate</th><th className="right">Total</th><th>Station</th><th /></tr></thead>
          <tbody>
            {fuels.map((f) => (
              <tr key={f.id}>
                <td>{f.date}</td>
                <td className="right">{num(f.odometer, 0)}{f.odometerEstimated ? " (est.)" : ""}</td>
                <td className="right">{num(f.litres, 2)}</td>
                <td className="right">{num(f.price, 2)}</td>
                <td className="right">{money(f.total, db.settings.currency)}</td>
                <td className="muted">{f.station ?? ""}{f.fillKind === "partial" ? " · partial" : ""}</td>
                <td className="right"><button className="link danger" onClick={() => removeFuel(f.id)} title="Delete">✕</button></td>
              </tr>
            ))}
            {fuels.length === 0 ? <tr><td colSpan={7} className="muted">No fills yet.</td></tr> : null}
          </tbody>
        </table>
        {stats.mileage.length > 1 ? <p className="muted small">Mileage points: {stats.mileage.length} · last {num(stats.lastMileage, 1)} {unit}/L</p> : null}
      </section>

      <section className="card">
        <h2>Odometer readings</h2>
        <div className="add-row">
          <input type="date" value={logDraft.date} onChange={(e) => setLogDraft({ ...logDraft, date: e.target.value })} />
          <input className="w-amount" inputMode="decimal" placeholder="Odometer" value={logDraft.odometer} onChange={(e) => setLogDraft({ ...logDraft, odometer: e.target.value })} />
          <button className="primary" onClick={addLog}>Add reading</button>
        </div>
        <table className="table">
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.at.slice(0, 10)}</td>
                <td className="right">{num(l.odometer, 0)} {unit}</td>
                <td className="right"><button className="link danger" onClick={() => removeLog(l.id)} title="Delete">✕</button></td>
              </tr>
            ))}
            {logs.length === 0 ? <tr><td className="muted">No extra readings.</td></tr> : null}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Service history</h2>
        <table className="table wide">
          <thead><tr><th>Date</th><th className="right">Odometer</th><th>Kind</th><th>Details</th><th className="right">Cost</th><th /></tr></thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>{s.date}</td>
                <td className="right">{num(s.odometer, 0)}</td>
                <td>{s.kind}</td>
                <td className="muted">{Object.values(s.details ?? {}).filter(Boolean).join(" · ") || s.note || ""}</td>
                <td className="right">{money(s.cost, db.settings.currency)}</td>
                <td className="right"><button className="link danger" onClick={() => removeService(s.id)} title="Delete">✕</button></td>
              </tr>
            ))}
            {services.length === 0 ? <tr><td colSpan={6} className="muted">No services logged.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
