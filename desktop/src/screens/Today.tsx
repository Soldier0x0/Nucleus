import { useStore } from "../store";
import { SNOOZE_CHOICES, visibleAttention } from "@core/attention";
import { monthTotals, serviceEstimate } from "@core/intelligence";
import { serviceLeftLine } from "@core/vehicleMath";
import { odometerEstimate } from "@core/fuelCapture";
import { addDays, daysBetween, fmtDate, money, monthKey, num, relDays, todayISO } from "@core/format";
import type { AttentionItem } from "@core/intelligence";
import { Ring } from "../components/Charts";

const SEV_LABEL = { urgent: "Urgent", upcoming: "Upcoming", info: "Info" } as const;

function AttentionRow({ item }: { item: AttentionItem }) {
  const { db, update } = useStore();
  const mark = item.key ? db.attention[item.key] : undefined;
  const snoozedUntil = mark?.status === "snoozed" ? mark.until : undefined;

  const markDone = () => update((d) => ({ ...d, attention: { ...d.attention, [item.key]: { status: "done" } } }));
  const snooze = (days: number) => update((d) => ({ ...d, attention: { ...d.attention, [item.key]: { status: "snoozed", until: addDays(todayISO(), days) } } }));
  const restore = () =>
    update((d) => {
      const attention = { ...d.attention };
      delete attention[item.key];
      return { ...d, attention };
    });

  return (
    <div className={`att sev-${item.severity}`}>
      <div className="att-main">
        <div className="att-title">
          <span className={`chip sev-${item.severity}`}>{SEV_LABEL[item.severity]}</span>
          {item.title}
        </div>
        <div className="muted">{item.subtitle}</div>
        <details className="why">
          <summary>Why?</summary>
          <p>{item.why.summary}</p>
          <table className="facts">
            <tbody>
              {item.why.facts.map((f) => (
                <tr key={f.label}>
                  <td>{f.label}</td>
                  <td>{f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">{item.why.rule}</p>
        </details>
      </div>
      {snoozedUntil ? (
        <div className="att-actions">
          <span className="muted small">Snoozed until {fmtDate(snoozedUntil)}</span>
          <button className="link" onClick={restore}>Restore</button>
        </div>
      ) : (
        <div className="att-actions">
          <button className="small-btn" onClick={markDone}>Done</button>
          <select
            className="small-btn"
            value=""
            onChange={(e) => {
              const days = Number(e.target.value);
              if (days > 0) snooze(days);
            }}
          >
            <option value="">Snooze…</option>
            {SNOOZE_CHOICES.map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export function Today() {
  const { db } = useStore();
  const today = todayISO();
  const month = monthKey(today);
  const totals = monthTotals(db, month);
  const items = visibleAttention(db, today);

  const services = db.vehicles.map((v) => ({ vehicle: v, est: serviceEstimate(db, v), odo: odometerEstimate(db, v, today) }));
  const dueServices = services.filter((s) => s.est.remaining <= Math.max(300, s.est.interval * 0.1));
  const renewals = [...db.subscriptions.filter((s) => s.active)].sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal)).slice(0, 4);

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
          <span className="muted small">Open attention</span>
          <strong>{items.length}</strong>
          <span className="muted small">{items.filter((i) => i.severity === "urgent").length} urgent</span>
        </div>
      </div>

      <div className="today-grid">
        <section className="card">
          <h2>Attention</h2>
          {items.length === 0 ? <p className="muted">Nothing needs you right now.</p> : null}
          <div className="att-list">
            {items.map((item) => (
              <AttentionRow key={item.key} item={item} />
            ))}
          </div>
        </section>

        <div className="stack">
          <section className="card center">
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

          <section className="card">
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

          <section className="card">
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
    </div>
  );
}
