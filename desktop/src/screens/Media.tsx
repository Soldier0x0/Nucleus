import { useMemo, useState } from "react";
import { ScreenToolbar } from "../components/ScreenToolbar";
import { useStore } from "../store";
import { todayISO, uid } from "@core/format";
import type { MediaItem, MediaKind, MediaStatus, Settings } from "@core/types";
import { readViews, type SavedView } from "../platform/savedViews";

const KINDS: MediaKind[] = ["movie", "series", "book", "game", "other"];
const STATUSES: MediaStatus[] = ["backlog", "active", "done", "dropped"];

/** Media module on desktop: what to watch, read and play, with status chips and saved views (v0.15). */
export function Media() {
  const { db, update, setSettings } = useStore();

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<MediaKind>("movie");
  const [filter, setFilter] = useState<MediaStatus | "All">("All");
  const [query, setQuery] = useState("");
  const views = useMemo(() => readViews(db).filter((v) => v.section === "media"), [db]);

  const rows = useMemo(
    () =>
      [...db.media]
        .filter((m) => (filter === "All" ? true : m.status === filter))
        .filter((m) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return [m.title, ...m.tags].some((v) => v?.toLowerCase().includes(q));
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [db.media, filter, query],
  );

  const writeViews = (views: SavedView[]) => setSettings({ ...db.settings, desktopViews: [...readViews(db).filter((v) => v.section !== "media"), ...views] } as Partial<Settings>);
  const saveView = () => {
    if (!query.trim() && filter === "All") return;
    const label = window.prompt("Name this view");
    if (!label?.trim()) return;
    const view: SavedView = { id: uid(), name: label.trim(), section: "media", payload: { query: query.trim(), tag: filter === "All" ? undefined : filter } };
    writeViews([...readViews(db).filter((v) => v.section === "media"), view]);
  };
  const dropView = (id: string) => writeViews(readViews(db).filter((v) => v.section === "media" && v.id !== id));
  const applyView = (view: SavedView) => {
    setQuery(view.payload.query);
    setFilter((view.payload.tag as MediaStatus | undefined) ?? "All");
  };

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
    <>
      <ScreenToolbar>
        <div>
          <p className="caption">{db.media.length} titles on the shelf · {rows.length} shown</p>
          <h1>Media</h1>
        </div>
        <div className="right no-print">
          <button className="small-btn" onClick={saveView}>Save view</button>
          <button className="small-btn" onClick={() => window.print()}>Print</button>
        </div>
      </ScreenToolbar>
      <div className="workcol">
        <div className="filters no-print">
          <div className="seg">
            {(["All", ...STATUSES] as const).map((s) => (
              <button key={s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>{s}</button>
            ))}
          </div>
          <div className="filter grow" style={{ maxWidth: 240 }}>
            <input className="grow" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles" style={{ border: 0, background: "none", padding: 0 }} />
          </div>
          <div className="row saved-view-row" data-testid="media-views" style={{ marginLeft: "auto" }}>
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
            <input className="grow filter" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
            <select className="filter" value={kind} onChange={(e) => setKind(e.target.value as MediaKind)}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <button className="primary" onClick={addItem}>Add</button>
          </div>
          <table className="table wide">
            <thead>
              <tr><th>Title</th><th>Kind</th><th>Status</th><th>Review</th><th className="no-print"></th></tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="bold-text">{m.title}</td>
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
                  <td className="right no-print"><button className="link danger no-print" onClick={() => update((d) => ({ ...d, media: d.media.filter((x) => x.id !== m.id) }))}>✕</button></td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={5} className="muted">Nothing here yet.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
