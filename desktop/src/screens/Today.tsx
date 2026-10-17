import { useStore } from "../store";
import { monthTotals, serviceEstimate } from "@core/intelligence";
import { serviceLeftLine } from "@core/vehicleMath";
import { odometerEstimate } from "@core/fuelCapture";
import { ACT_WORDS, journalKind, journalLabel } from "@core/journal";
import { daysBetween, fmtDate, money, monthKey, num, relDays, todayISO } from "@core/format";
import { Ring } from "../components/Charts";

/** Today as a bento dashboard (v0.14); Attention moved to its own section. */
export function Today() {
  const { db } = useStore();
  const today = todayISO();
  const month = monthKey(today);
  const totals = monthTotals(db, month);

  const services = db.vehicles.map((v) => ({ vehicle: v, est: serviceEstimate(db, v), odo: odometerEstimate(db, v, today) }));
  const dueServices = services.filter((s) => s.est.remaining <= Math.max(300, s.est.interval * 0.1));
  const renewals = [...db.subscriptions.filter((s) => s.active)].sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal)).slice(0, 4);

  const recent = (db.journal ?? []).slice(-6).reverse();
  const pickup = recent[0];

  return (
    <div className="stack">
      <div className="stat-row">
        <div className="stat card">
          <span className="muted small">Spent in {month}</span>
          <strong>{money(totals.spent, db.settings.currency)}</strong>
          <span className="muted small">of {db.budget.monthly > 0 ? money(db.budget.monthly, db.settings.currency) : "no budget set"}</span>
        </div>
        <div className="stat card">
          <span className="muted small">Income in {month}</span>
          <strong>{money(totals.income, db.settings.currency)}</strong>
          <span className="muted small">{num(totals.spent - totals.income, 0)} net spend</span>
        </div>
        <div className="stat card">
          <span className="muted small">Service due</span>
          <strong>{dueServices.length}</strong>
          <span className="muted small">{dueServices.length === 1 ? "vehicle needs attention" : "vehicles need attention"}</span>
        </div>
        <div className="stat card">
          <span className="muted small">Recently changed</span>
          <strong>{(db.journal ?? []).length}</strong>
          <span className="muted small">changes in 120 days</span>
        </div>
      </div>

      <div className="bento">
        <section className="card center b2">
          <h2>Monthly budget</h2>
          {db.budget.monthly > 0 ? (
            <Ring
              value={totals.spent}
              max={db.budget.monthly}
              label={`${num((totals.spent / db.budget.monthly) * 100, 0)}%`}
              sub={`${money(totals.spent, db.settings.currency)} of ${money(db.budget.monthly, db.settings.currency)}`}
            />
          ) : (
            <p className="muted">Set a monthly budget in Settings later — the ring fills as you spend.</p>
          )}
        </section>

        <section className="card b2" data-testid="today-pickup">
          <h2>Pick up where you left</h2>
          {pickup ? (
            <>
              <div className="pickup-line">
                <strong>{ACT_WORDS[pickup.act]}</strong> {journalLabel(pickup)}
              </div>
              <div className="muted small">{journalKind(pickup)} · {fmtDate(pickup.at.slice(0, 10))}</div>
            </>
          ) : (
            <p className="muted">Your latest change will appear here.</p>
          )}
          {recent.length > 1 ? (
            <table className="table" data-testid="today-recent">
              <tbody>
                {recent.slice(1, 5).map((entry) => (
                  <tr key={entry.id}>
                    <td className="muted small">{ACT_WORDS[entry.act]}</td>
                    <td>{journalLabel(entry)}</td>
                    <td className="muted small">{journalKind(entry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section className="card b2">
          <h2>Service left</h2>
          {services.length === 0 ? <p className="muted">No vehicles yet.</p> : null}
          <table className="table">
            <tbody>
              {services.map(({ vehicle, est, odo }) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.name}</td>
                  <td>{serviceLeftLine(est.remaining)}</td>
                  <td className="muted small">
                    {num(odo.value, 0)} {db.settings.distanceUnit}
                    {odo.estimated ? " (est.)" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card b2">
          <h2>Renewals</h2>
          {renewals.length === 0 ? <p className="muted">No subscriptions.</p> : null}
          <table className="table">
            <tbody>
              {renewals.map((s) => {
                const d = daysBetween(today, s.nextRenewal);
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{money(s.amount, db.settings.currency)}</td>
                    <td className={d < 0 ? "error" : "muted small"}>{d < 0 ? `${-d} days late` : relDays(d)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
