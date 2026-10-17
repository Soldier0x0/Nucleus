import { useMemo, useState } from "react";
import { useStore } from "../store";
import { visibleAttention } from "@core/attention";
import { todayISO } from "@core/format";
import { AttentionRow } from "../components/AttentionRow";

const FILTERS = ["Open", "Urgent", "Upcoming", "Info", "Done"] as const;

/** The whole of Attention, first-class since v0.14. */
export function Attention() {
  const { db } = useStore();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Open");

  const counts = useMemo(() => {
    const open = visibleAttention(db, todayISO());
    const done = Object.entries(db.attention).filter(([, mark]) => mark.status === "done");
    return {
      open,
      urgent: open.filter((i) => i.severity === "urgent"),
      upcoming: open.filter((i) => i.severity === "upcoming"),
      info: open.filter((i) => i.severity === "info"),
      done,
    };
  }, [db]);

  const rows = filter === "Open" ? counts.open : counts[filter.toLowerCase() as "urgent" | "upcoming" | "info"] ?? counts.open;

  return (
    <div className="attention-screen">
      <div className="row no-print">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "chip on" : "chip"} onClick={() => setFilter(f)}>
            {f}
            {f !== "Open" ? <span className="muted small"> {f === "Done" ? counts.done.length : counts[f.toLowerCase() as "urgent" | "upcoming" | "info"]?.length ?? 0}</span> : null}
          </button>
        ))}
      </div>
      {rows.length === 0 ? <section className="card"><p className="muted">Nothing here. {filter === "Open" ? "Nothing needs you right now." : ""}</p></section> : null}
      <div className="att-list">
        {filter === "Done"
          ? counts.done.map(([key]) => (
              <div key={key} className="att">
                <div className="att-main"><div className="att-title muted">{key}</div></div>
              </div>
            ))
          : rows.map((item) => <AttentionRow key={item.key} item={item} />)}
      </div>
    </div>
  );
}
