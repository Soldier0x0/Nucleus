import { useMemo, useState } from "react";
import { useStore } from "../store";
import { todayISO, uid } from "@core/format";
import type { MediaItem, MediaKind, MediaStatus } from "@core/types";

const KINDS: MediaKind[] = ["movie", "series", "book", "game", "other"];
const STATUSES: MediaStatus[] = ["backlog", "active", "done", "dropped"];

/** Media module on desktop (v0.14): what to watch, read and play. */
export function Media() {
  const { db, update } = useStore();

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<MediaKind>("movie");
  const [filter, setFilter] = useState<MediaStatus | "All">("All");

  const rows = useMemo(
    () => [...db.media].filter((m) => (filter === "All" ? true : m.status === filter)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [db.media, filter],
  );

  const addItem = () => {
    if (!title.trim()) return;
    const row: MediaItem = {
      id: uid(),
      kind,
      title: title.trim().slice(0, 120),
      status: "backlog",
      progress: 0,
      rating: 0,
      tags: [],
      createdAt: todayISO(),
      updatedAt: todayISO(),
    };
    update((d) => ({ ...d, media: [row, ...d.media] }));
    setTitle("");
  };

  return (
    <div className="two-stack">
      <section className="card">
        <div className="row spread">
          <h2>Media</h2>
          <button className="print-btn small-btn no-print" onClick={() => window.print()}>Print</button>
        </div>
        <div className="add-row no-print">
          <input className="grow" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
          <select value={kind} onChange={(e) => setKind(e.target.value as MediaKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <button className="primary" onClick={addItem}>Add</button>
        </div>
        <div className="row no-print" style={{ marginBottom: 0 }}>
          {(["All", ...STATUSES] as const).map((s) => (
            <button key={s} className={filter === s ? "chip on" : "chip"} onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>
      </section>
      <section className="card">
        <table className="table wide">
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{m.title}</td>
                <td className="muted small">{m.kind}</td>
                <td>
                  <select
                    className="no-print"
                    value={m.status}
                    onChange={(e) =>
                      update((d) => ({
                        ...d,
                        media: d.media.map((x) => (x.id === m.id ? { ...x, status: e.target.value as MediaStatus, updatedAt: todayISO() } : x)),
                      }))
                    }
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="no-view">{m.status}</span>
                </td>
                {m.review ? <td className="muted small">{m.review}</td> : <td />}
                <td className="right"><button className="link danger no-print" onClick={() => update((d) => ({ ...d, media: d.media.filter((x) => x.id !== m.id) }))}>✕</button></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={5} className="muted">Nothing here yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
