import { useMemo, useState } from "react";
import { ScreenToolbar } from "../components/ScreenToolbar";
import { useStore } from "../store";
import { allAttention, visibleAttention } from "@core/attention";
import { fmtDate, todayISO } from "@core/format";
import type { AttentionItem } from "@core/intelligence";
import type { DB } from "@core/types";
import { AttentionRow } from "../components/AttentionRow";

const GROUPS: { sev: AttentionItem["severity"]; name: string; dot: string }[] = [
  { sev: "urgent", name: "Overdue & urgent", dot: "bad" },
  { sev: "upcoming", name: "Upcoming", dot: "warn" },
  { sev: "info", name: "Info", dot: "good" },
];

/** The same engine the phone and the sidebar badge use. */
const titleOf = (db: DB, key: string) => {
  const live = allAttention(db, todayISO()).find((i) => i.key === key);
  if (live) return live;
  const prefix = key.split(":")[0] ?? "";
  return null;
};

const FALLBACK: Record<string, string> = { cycle: "Cycle", money: "Money", vehicle: "Vehicle", home: "Home", paper: "Papers", sub: "Subscription", bill: "Bill" };

/** Attention, two columns: grouped open items + the rail with snoozed and history (v0.15 design pass). */
export function Attention() {
  const { db } = useStore();
  const [view, setView] = useState<"open" | "done">("open");
  const today = todayISO();

  const open = useMemo(() => visibleAttention(db, today), [db, today]);
  const marks = useMemo(() => ({
    snoozed: Object.entries(db.attention).filter(([, m]) => m.status === "snoozed"),
    done: Object.entries(db.attention).filter(([, m]) => m.status === "done"),
  }), [db]);

  const doneLabel = (key: string) => {
    const live = titleOf(db, key);
    if (live) return live.title;
    const prefix = key.split(":")[0] ?? "";
    return `${FALLBACK[prefix] ?? prefix} · done earlier`;
  };
  const snoozedItem = (key: string) => titleOf(db, key);

  const groups = GROUPS.map((g) => ({ ...g, items: open.filter((i) => i.severity === g.sev) })).filter((g) => g.items.length > 0);

  return (
    <>
      <ScreenToolbar>
        <div>
          <p className="caption">{open.length === 0 ? "All clear" : `${open.length} things want you · ${marks.done.length} done so far`}</p>
          <h1>Attention</h1>
        </div>
        <div className="right no-print">
          <div className="seg" data-testid="attention-view-seg">
            <button className={view === "open" ? "on" : ""} onClick={() => setView("open")}>Open</button>
            <button className={view === "done" ? "on" : ""} onClick={() => setView("done")}>Done &amp; history</button>
          </div>
        </div>
      </ScreenToolbar>

      <div className="workcols">
        <div className="stack">
          {view === "open" ? (
            groups.length === 0 ? (
              <section className="card">
                <p>Nothing needs you right now.</p>
                <p className="muted small">Open items appear here as budgets run close, service comes due, papers approach expiry and the phone syncs.</p>
              </section>
            ) : (
              groups.map((g) => (
                <section className="group" key={g.sev}>
                  <div className="ghead">
                    <span className={`dot ${g.dot}`}></span>
                    <span className="gname">{g.name}</span>
                    <span className="num">{g.items.length} item{g.items.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="att-list">
                    {g.items.map((item) => (
                      <AttentionRow key={item.key} item={item} />
                    ))}
                  </div>
                </section>
              ))
            )
          ) : (
            <section className="card" data-testid="attention-done">
              <h2>Acted on</h2>
              {marks.done.length === 0 ? (
                <p className="muted">Nothing marked done yet. Press Done on an open item and it is remembered here.</p>
              ) : (
                <div className="mini-list">
                  {marks.done.map(([key, mark]) => (
                    <div className="mini-row" key={key}>
                      <span className="dot good"></span>
                      <span className="t small grow">{doneLabel(key)}</span>
                      <span className="m small">{mark.status}</span>
                    </div>
                  ))}
                </div>
              )}
              {marks.done.length > 0 ? <p className="muted small" style={{ marginTop: 10 }}>Marks stay in this document; the underlying record may have changed since.</p> : null}
            </section>
          )}
        </div>

        <div className="rail">
          <section className="card">
            <h2 className="rail-label">Overview</h2>
            <div className="mini-list">
              <div className="mini-row"><span className="t small grow">Open items</span><span className="num">{open.length}</span></div>
              {groups.map((g) => (
                <div className="mini-row" key={g.sev}>
                  <span className={`dot ${g.dot}`}></span>
                  <span className="m small grow">{g.name}</span>
                  <span className="m small num">{g.items.length}</span>
                </div>
              ))}
              <div className="mini-row"><span className="t small grow">Snoozed</span><span className="num">{marks.snoozed.length}</span></div>
              <div className="mini-row"><span className="t small grow">Done</span><span className="num">{marks.done.length}</span></div>
            </div>
          </section>
          <section className="card">
            <h2 className="rail-label">Snoozed</h2>
            {marks.snoozed.length === 0 ? (
              <p className="muted small">Nothing snoozed. Snoozed items return on their day.</p>
            ) : (
              marks.snoozed.map(([key, mark]) => {
                const item = snoozedItem(key);
                return (
                  <div className="snoze" key={key}>
                    <div>
                      <div className="t">{item?.title ?? `${FALLBACK[key.split(":")[0] ?? ""] ?? key.split(":")[0]} · snoozed`}</div>
                      <div className="m">until {mark.until ? fmtDate(mark.until) : "later"}</div>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </div>
    </>
  );
}
