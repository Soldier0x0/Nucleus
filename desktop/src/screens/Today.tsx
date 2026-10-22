import { useStore } from "../store";
import { CountUp } from "../components/CountUp";
import { ScreenToolbar } from "../components/ScreenToolbar";
import { monthTotals, serviceEstimate } from "@core/intelligence";
import { serviceLeftLine } from "@core/vehicleMath";
import { odometerEstimate } from "@core/fuelCapture";
import { visibleAttention } from "@core/attention";
import { lastSeenLine, phoneSeenFresh } from "@core/syncStatus";
import { ACT_WORDS, journalKind, journalLabel } from "@core/journal";
import { daysBetween, fmtDate, money, monthKey, num, relDays, todayISO } from "@core/format";

const SEV_WORD = { urgent: "Urgent", upcoming: "Upcoming", info: "Info" } as const;

/** Today as the 12-column bento from the design boards; Attention moved to its own section (v0.14). */
export function Today({ onJump }: { onJump?: (section: "papers" | "attention" | "settings" | "money" | "vehicles", id?: string) => void }) {
  const { db } = useStore();
  const today = todayISO();
  const month = monthKey(today);
  const totals = monthTotals(db, month);

  const services = db.vehicles.map((v) => ({ vehicle: v, est: serviceEstimate(db, v), odo: odometerEstimate(db, v, today) }));
  const dueServices = services.filter((s) => s.est.remaining <= Math.max(300, s.est.interval * 0.1));
  const renewals = [...db.subscriptions.filter((s) => s.active)].sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal)).slice(0, 4);
  const wants = visibleAttention(db, today);
  const recent = (db.journal ?? []).slice(-6).reverse();
  const pickup = recent[0];
  const lastFill = [...db.fuel].sort((a, b) => b.date.localeCompare(a.date))[0];
  const fillVehicle = lastFill ? db.vehicles.find((v) => v.id === lastFill.vehicleId) : undefined;
  const recentPapers = [...db.papers].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 4);
  const lastDeviceSync = (db.settings.pairedDevices ?? []).map((d) => d.lastSyncAt).filter(Boolean).sort().pop() ?? db.settings.lastSyncAt;
  const seen = lastSeenLine(lastDeviceSync, new Date().toISOString());
  const seenFresh = phoneSeenFresh(lastDeviceSync, new Date().toISOString());
  const when = seen.startsWith("Phone last seen ") ? seen.slice("Phone last seen ".length) : seen;
  const budgetPct = db.budget.monthly > 0 ? Math.min(100, Math.round((totals.spent / db.budget.monthly) * 100)) : null;

  return (
    <>
      <ScreenToolbar>
        <div>
          <p className="caption">{wants.length} things want you · {fmtDate(today)}</p>
          <h1>Today</h1>
        </div>
        <div className="right"></div>
      </ScreenToolbar>
      <div className="workcol">
        <div className="bento">
          <section className="card tile s3" data-testid="today-spent">
            <span className="tile-lab">Spent this month</span>
            <div className="tile-val num">
              <CountUp to={totals.spent} format={(n) => money(n, db.settings.currency)} testid="today-spent-value" />
            </div>
            <div className="tile-note">
              {budgetPct === null ? (
                <span>No budget set yet.</span>
              ) : (
                <>
                  <span className="prog grow"><i style={{ width: `${budgetPct}%` }} /></span>
                  <span>{budgetPct}% of {money(db.budget.monthly, db.settings.currency)}</span>
                </>
              )}
            </div>
          </section>

          <section className="card tile s3" data-testid="today-income">
            <span className="tile-lab">Income this month</span>
            <div className="tile-val num">{money(totals.income, db.settings.currency)}</div>
            <div className="tile-note">
              <span className={`delta ${totals.income - totals.spent >= 0 ? "good" : "bad"}`}>
                {totals.income - totals.spent >= 0 ? "Comfortable" : "Over"}
              </span>
              <span>net {money(Math.abs(totals.spent - totals.income), db.settings.currency)}</span>
            </div>
          </section>

          <section className="card tile s3" data-testid="today-fuel">
            <span className="tile-lab">{fillVehicle ? `Fuel · ${fillVehicle.name}` : "Fuel"}</span>
            {lastFill ? (
              <>
                <div className="tile-val num">{num(lastFill.litres, 1)} <small>L</small></div>
                <div className="tile-note">
                  <span>{money(lastFill.total, db.settings.currency)} · {fmtDate(lastFill.date)}</span>
                </div>
              </>
            ) : (
              <div className="tile-note"><span>No fills logged yet.</span></div>
            )}
          </section>

          <section className="card tile s3" data-testid="today-service">
            <span className="tile-lab">Service due</span>
            {dueServices.length === 0 ? (
              <div className="tile-note"><span>Nothing close.</span></div>
            ) : (
              <div className="mini-list">
                {dueServices.slice(0, 2).map(({ vehicle, est, odo }) => (
                  <button key={vehicle.id} className="mini-row pal-row" onClick={() => onJump?.("vehicles", vehicle.id)} data-testid={`today-service-${vehicle.id}`}>
                    <span>
                      <span className="t">{vehicle.name}</span>
                      <span className="m" style={{ display: "block" }}>{serviceLeftLine(est.remaining)} · {num(odo.value, 0)} {db.settings.distanceUnit}{odo.estimated ? " est." : ""}</span>
                    </span>
                    <span className="prog grow" style={{ maxWidth: 70 }}><i style={{ width: `${Math.min(100, Math.round(((est.interval - est.remaining) / est.interval) * 100))}%` }} /></span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card tile s7 row2" data-testid="today-attention">
            <span className="tile-lab">Attention</span>
            {wants.length === 0 ? (
              <div className="tile-note"><span>Nothing needs you right now.</span></div>
            ) : (
              <>
                <div className="mini-list">
                  {wants.slice(0, 3).map((item) => (
                    <button key={item.key} className="mini-row pal-row" onClick={() => onJump?.("attention")}>
                      <span className={`dot ${item.severity === "urgent" ? "bad" : item.severity === "upcoming" ? "warn" : ""}`}></span>
                      <span>
                        <span className="t">{item.title}</span>
                        <span className="m" style={{ display: "block" }}>{item.subtitle}</span>
                      </span>
                      <span className="small muted" style={{ marginLeft: "auto" }}>{SEV_WORD[item.severity]}</span>
                    </button>
                  ))}
                </div>
                {wants.length > 3 ? (
                  <div className="tile-note"><button className="link" onClick={() => onJump?.("attention")}>Open Attention · {wants.length} open</button></div>
                ) : null}
              </>
            )}
          </section>

          <section className="card tile s5 row2" data-testid="today-pickup">
            <span className="tile-lab">Pick up where you left</span>
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
              <div className="mini-list" data-testid="today-recent">
                {recent.slice(1, 5).map((entry) => (
                  <div key={entry.id} className="mini-row">
                    <span className="t small">{ACT_WORDS[entry.act]}</span>
                    <span className="m grow muted">{journalLabel(entry)}</span>
                    <span className="m small">{journalKind(entry)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="card tile s4">
            <span className="tile-lab">Upcoming renewals</span>
            {renewals.length === 0 ? (
              <div className="tile-note"><span>No subscriptions.</span></div>
            ) : (
              <div className="mini-list">
                {renewals.map((s) => {
                  const d = daysBetween(today, s.nextRenewal);
                  return (
                    <div key={s.id} className="mini-row">
                      <span className="t small grow">{s.name}</span>
                      <span className="m small num">{money(s.amount, db.settings.currency)}</span>
                      <span className={`m small ${d < 0 ? "error" : ""}`}>{d < 0 ? `${-d} days late` : relDays(d)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {renewals.length > 0 ? <div className="tile-note"><button className="link" onClick={() => onJump?.("money")}>Open Money</button></div> : null}
          </section>

          <section className="card tile s5">
            <span className="tile-lab">Recent documents</span>
            {recentPapers.length === 0 ? (
              <div className="tile-note"><span>Nothing filed yet. Drop files anywhere to add them.</span></div>
            ) : (
              <div className="mini-list">
                {recentPapers.map((p) => (
                  <button key={p.id} className="mini-row pal-row" onClick={() => onJump?.("papers", p.id)}>
                    <span className="t small grow">{p.title}</span>
                    <span className="m small">{p.kind.replace("_", " ")}</span>
                    <span className="m small">{fmtDate(p.createdAt.slice(0, 10))}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card tile s3" data-testid="today-freshness">
            <span className="tile-lab">With your phone</span>
            <div style={{ marginTop: 6 }}>
              {/* Reverse freshness (v0.12): the pill states the contract —
                  what the phone sent is already on this machine. Fresh rides
                  the --ok dot; stale turns --warn; ink keeps AA on either. */}
              {lastDeviceSync ? (
                <span className={`fresh-pill ${seenFresh ? "fresh" : "stale"}`} data-testid="today-fresh-pill">
                  <i className="dot" aria-hidden="true"></i>
                  <span>{seenFresh ? "Already here" : "Not since"}</span>
                  <b>{when}</b>
                </span>
              ) : (
                <span className="fresh-pill stale" data-testid="today-fresh-pill">
                  <i className="dot" aria-hidden="true"></i>
                  <span>No phone yet</span>
                  <b>pairing lives in Settings</b>
                </span>
              )}
            </div>
            <div className="tile-note">
              <button className="link" onClick={() => onJump?.("settings")}>Pairing lives in Settings</button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
