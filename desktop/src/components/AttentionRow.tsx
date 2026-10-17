import { useStore } from "../store";
import { SNOOZE_CHOICES } from "@core/attention";
import { addDays, fmtDate, todayISO } from "@core/format";
import type { AttentionItem } from "@core/intelligence";

const SEV_LABEL = { urgent: "Urgent", upcoming: "Upcoming", info: "Info" } as const;

/** One attention card with Done / Snooze, shared by Today and the Attention section. */
export function AttentionRow({ item }: { item: AttentionItem }) {
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
