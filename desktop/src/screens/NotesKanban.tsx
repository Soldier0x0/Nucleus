import { useEffect, useRef, useState } from "react";
import { ScreenToolbar } from "../components/ScreenToolbar";
import { EmptyState } from "../components/EmptyState";
import { HoldButton } from "../components/HoldButton";
import { undoBus } from "../platform/undo";
import { useStore } from "../store";
import { uid } from "@core/format";
import type { KanbanBoard, KanbanCard, Note } from "@core/types";

type Tab = "notes" | "kanban";

const cardsOf = (b: KanbanBoard, columnId: string) =>
  b.cards.filter((c) => c.columnId === columnId).sort((a, z) => a.order - z.order);

type KanDragSession = {
  colId: string;
  from: number;
  to: number;
  n: number;
  rows: HTMLElement[];
  tops: number[];
  halves: number[];
  step: number;
  startY: number;
  dy: number;
  state: { pos: number; vel: number }[];
  raf: number;
  onMove: (ev: PointerEvent) => void;
  onUp: () => void;
  onCancel: () => void;
};

const REDUCED_MOTION = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The drag-handle reorder core (§4/§7), ref-simulated: React re-renders only
 * once, at commit. Constants are the rebuild's verbatim — per-row spring
 * k=0.18/damp=0.74 toward slot targets for neighbours, the dragged row
 * chasing the cursor by lerp 0.22 with a −7px raise and the independent
 * `scale` property (1.035); the grab shadow is a class swap with NO
 * transition (moving shadows jank). One reorder path afterwards: the drop
 * hands (column, from, to) to the same `reorder` the keyboard uses.
 * Reduced motion keeps reordering but snaps all targets (no springs).
 * Grip-only hit target — the pointer never drags from inputs.
 */
function useBoardDrag(onCommit: React.MutableRefObject<(colId: string, from: number, to: number) => void>) {
  const drag = useRef<KanDragSession | null>(null);

  const clear = () => {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(d.raf);
    d.rows.forEach((el) => {
      el.style.transform = "";
      el.style.scale = "";
      el.classList.remove("dragging");
    });
    window.removeEventListener("pointermove", d.onMove);
    window.removeEventListener("pointerup", d.onUp);
    window.removeEventListener("pointercancel", d.onCancel);
    drag.current = null;
  };

  const start = (e: React.PointerEvent<HTMLButtonElement>, colId: string, cardId: string) => {
    if (drag.current) clear();
    const col = (e.currentTarget as HTMLElement).closest(".kanban-col");
    const rows = Array.from(col?.querySelectorAll<HTMLElement>(".kan-card") ?? []);
    const from = rows.findIndex((el) => el.dataset.id === cardId);
    if (from < 0) return;
    e.preventDefault();

    const rects = rows.map((el) => el.getBoundingClientRect());
    const tops = rects.map((r) => r.top);
    const halves = rects.map((r) => r.height / 2);
    // vertical pitch: the distance to the next row (or previous at the end),
    // card height + the column's 8px gap — neighbours shift by exactly this.
    const step =
      from + 1 < rows.length ? tops[from + 1] - tops[from] : tops[from] - (rects[from - 1]?.top ?? tops[from] - 8);
    const state = rects.map((r) => ({ pos: r.top, vel: 0 }));

    const d: KanDragSession = {
      colId,
      from,
      to: from,
      n: rows.length,
      rows,
      tops,
      halves,
      step,
      startY: e.clientY,
      dy: 0,
      state,
      raf: 0,
      onMove: () => {},
      onUp: () => {},
      onCancel: () => {},
    };

    d.onMove = (ev) => {
      if (drag.current !== d) return;
      d.dy = ev.clientY - d.startY;
      // midpoint crossings commit the slot the row is living in (the visual
      // order updates here; the document commits once, on drop)
      const center = d.tops[d.from] + d.dy + d.halves[d.from];
      let to = d.from;
      for (let j = d.from + 1; j < d.n; j++) {
        if (center > d.tops[j] + d.halves[j]) to = j;
      }
      for (let j = d.from - 1; j >= 0; j--) {
        if (center < d.tops[j] + d.halves[j]) to = j;
      }
      d.to = to;
    };
    d.onUp = () => {
      const dropFrom = d.from;
      const dropTo = d.to;
      const col = d.colId;
      clear();
      if (dropTo !== dropFrom) onCommit.current(col, dropFrom, dropTo);
    };
    d.onCancel = () => clear();

    d.rows[from].classList.add("dragging");
    const run = () => {
      if (drag.current !== d) return;
      const reduced = REDUCED_MOTION();
      // dragged row chases the lifted target (raise folded in)
      const s0 = d.state[d.from];
      const liftTarget = d.tops[d.from] + d.dy - 7;
      s0.pos = reduced ? liftTarget : s0.pos + (liftTarget - s0.pos) * 0.22;
      d.rows[d.from].style.transform = `translateY(${s0.pos - d.tops[d.from]}px)`;
      d.rows[d.from].style.scale = "1.035";
      // neighbours spring toward their (possibly shifted) slots
      for (let i = 0; i < d.n; i++) {
        if (i === d.from) continue;
        const target =
          d.from < d.to
            ? i > d.from && i <= d.to
              ? d.tops[i] - d.step
              : d.tops[i]
            : i < d.from && i >= d.to
              ? d.tops[i] + d.step
              : d.tops[i];
        const s = d.state[i];
        if (reduced) {
          s.pos = target;
          s.vel = 0;
        } else {
          s.vel += (target - s.pos) * 0.18;
          s.vel *= 0.74;
          s.pos += s.vel;
        }
        d.rows[i].style.transform = `translateY(${s.pos - d.tops[i]}px)`;
      }
      d.raf = requestAnimationFrame(run);
    };
    d.raf = requestAnimationFrame(run);
    window.addEventListener("pointermove", d.onMove);
    window.addEventListener("pointerup", d.onUp);
    window.addEventListener("pointercancel", d.onCancel);
  };

  useEffect(() => () => clear(), []);
  return start;
}

export function NotesKanban({ focusId }: { focusId?: string }) {
  const { db } = useStore();
  // A focus from anywhere (sidebar, palette) lands on the tab that owns the record;
  // kanban cards live on the board, not in notes.
  const [tab, setTab] = useState<Tab>(() => (focusId && db.kanban.some((b) => b.cards.some((c) => c.id === focusId)) ? "kanban" : "notes"));
  useEffect(() => {
    if (!focusId) return;
    // Opening a card from outside picks the tab it lives on, every time.
    const ownsCard = db.kanban.some((b) => b.cards.some((c) => c.id === focusId));
    if (ownsCard && tab !== "kanban") setTab("kanban");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);
  return (
    <>
      <ScreenToolbar>
        <div>
          <p className="caption">{tab === "notes" ? `${db.notes.length} notes` : `${db.kanban.length} boards`}</p>
          <h1>{tab === "notes" ? "Notes" : "Kanban"}</h1>
        </div>
      </ScreenToolbar>
      <div className="stack">
        <div className="tabs">
        {(["notes", "kanban"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "tab on" : "tab"} onClick={() => setTab(t)}>
            {t === "notes" ? "Notes" : "Kanban"}
          </button>
        ))}
      </div>
      {tab === "notes" ? <Notes focusId={focusId} /> : null}
      {tab === "kanban" ? <Board focusId={focusId} /> : null}
      </div>
    </>
  );
}

function Notes({ focusId }: { focusId?: string }) {
  const { db, update } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(db.notes[0]?.id ?? null);
  const [itemDraft, setItemDraft] = useState("");
  const note = db.notes.find((n) => n.id === selectedId) ?? db.notes[0] ?? null;
  const now = () => new Date().toISOString();

  useEffect(() => {
    if (focusId && db.notes.some((n) => n.id === focusId)) {
      setSelectedId(focusId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const sorted = [...db.notes].sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) || b.updatedAt.localeCompare(a.updatedAt));
  const patch = (n: Note, changes: Partial<Note>) => update((d) => ({ ...d, notes: d.notes.map((x) => (x.id === n.id ? { ...x, ...changes, updatedAt: now() } : x)) }));

  const addNote = () => {
    const row: Note = { id: uid(), title: "Untitled", body: "", checklist: [], createdAt: now(), updatedAt: now() };
    update((d) => ({ ...d, notes: [row, ...d.notes] }));
    setSelectedId(row.id);
  };

  const removeNote = (n: Note) => {
    // common destructive action → the forgiving undo path (the hold is for
    // the costly ones: board/column deletes). The tombstone re-inserts whole.
    update((d) => ({ ...d, notes: d.notes.filter((x) => x.id !== n.id) }));
    undoBus.request({
      title: `Deleted note "${n.title.slice(0, 40)}"`,
      onUndo: () => update((d) => ({ ...d, notes: [...d.notes, n] })),
    });
    setSelectedId(null);
  };

  return (
    <>
      {db.notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          hint="A private place for anything — plain text, checklists, pinned sometime-soons."
          action={<button className="primary" onClick={addNote} data-testid="notes-empty-new">New note</button>}
          testid="notes-empty"
        />
      ) : (
      <div className="notes-grid">
      <aside className="card p-list">
        <div className="row spread"><h2>Notes</h2><button className="small-btn" onClick={addNote}>New</button></div>
        <div className="doc-list">
          {sorted.map((n) => (
            <button key={n.id} className={n.id === note?.id ? "doc on" : "doc"} onClick={() => setSelectedId(n.id)}>
              <span className="doc-title">{n.title}</span>
              <span className="muted small">{n.body.slice(0, 60) || (n.checklist.length ? `${n.checklist.filter((c) => c.done).length}/${n.checklist.length} done` : "empty")}</span>
            </button>
          ))}
          {sorted.length === 0 ? <p className="muted">No notes yet.</p> : null}
        </div>
      </aside>
      <div className="stack">
        {note ? (
          <section className="card">
            <div className="row spread">
              <input className="title-input" value={note.title} onChange={(e) => patch(note, { title: e.target.value })} />
              <div className="row">
                <button className={note.pinned ? "chip on" : "chip"} onClick={() => patch(note, { pinned: !note.pinned })}>Pin</button>
                <button className="link danger" onClick={() => removeNote(note)}>Delete</button>
              </div>
            </div>
            <textarea rows={8} value={note.body} onChange={(e) => patch(note, { body: e.target.value })} placeholder="Write anything…" />
            <h3>Checklist</h3>
            {note.checklist.map((item) => (
              <div className="row" key={item.id}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => patch(note, { checklist: note.checklist.map((c) => (c.id === item.id ? { ...c, done: e.target.checked } : c)) })}
                />
                <input
                  className="grow"
                  value={item.text}
                  onChange={(e) => patch(note, { checklist: note.checklist.map((c) => (c.id === item.id ? { ...c, text: e.target.value } : c)) })}
                />
                <button className="link danger" onClick={() => patch(note, { checklist: note.checklist.filter((c) => c.id !== item.id) })}>✕</button>
              </div>
            ))}
            <div className="row">
              <input className="grow" placeholder="New checklist item" value={itemDraft} onChange={(e) => setItemDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && itemDraft.trim()) { patch(note, { checklist: [...note.checklist, { id: uid(), text: itemDraft.trim(), done: false }] }); setItemDraft(""); } }} />
              <button className="small-btn" disabled={!itemDraft.trim()} onClick={() => { patch(note, { checklist: [...note.checklist, { id: uid(), text: itemDraft.trim(), done: false }] }); setItemDraft(""); }}>Add</button>
            </div>
          </section>
        ) : (
          <section className="card"><p className="muted">Pick a note, or create one.</p></section>
        )}
      </div>
      </div>
      )}
    </>
  );
}

function Board({ focusId }: { focusId?: string }) {
  const { db, update } = useStore();
  const owner = focusId ? db.kanban.find((b) => b.cards.some((c) => c.id === focusId)) : undefined;
  const [boardId, setBoardId] = useState<string | null>(owner?.id ?? db.kanban[0]?.id ?? null);
  // The same trick as the tab above: a fresh focus on a card in another board
  // must move the board picker over, not leave it on the old board.
  useEffect(() => {
    if (owner?.id && owner.id !== boardId) setBoardId(owner.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);
  const [cardDrafts, setCardDrafts] = useState<Record<string, string>>({});
  const board = db.kanban.find((b) => b.id === boardId) ?? db.kanban[0] ?? null;

  const patchBoard = (b: KanbanBoard, change: (x: KanbanBoard) => KanbanBoard) =>
    update((d) => ({ ...d, kanban: d.kanban.map((x) => (x.id === b.id ? change(x) : x)) }));

  const addBoard = () => {
    const row: KanbanBoard = {
      id: uid(),
      name: "New board",
      columns: [
        { id: uid(), name: "Todo", order: 0 },
        { id: uid(), name: "Doing", order: 1 },
        { id: uid(), name: "Done", order: 2 },
      ],
      cards: [],
      createdAt: new Date().toISOString(),
    };
    update((d) => ({ ...d, kanban: [...d.kanban, row] }));
    setBoardId(row.id);
  };

  const removeBoard = (b: KanbanBoard) => {
    update((d) => ({ ...d, kanban: d.kanban.filter((x) => x.id !== b.id) }));
    setBoardId(null);
  };

  const addCard = (columnId: string) => {
    if (!board) return;
    const title = (cardDrafts[columnId] ?? "").trim();
    if (!title) return;
    const card: KanbanCard = { id: uid(), columnId, title, order: board.cards.filter((c) => c.columnId === columnId).length };
    patchBoard(board, (x) => ({ ...x, cards: [...x.cards, card] }));
    setCardDrafts({ ...cardDrafts, [columnId]: "" });
  };

  const move = (card: KanbanCard, dir: -1 | 1) => {
    if (!board) return;
    const columns = [...board.columns].sort((a, b) => a.order - b.order);
    const idx = columns.findIndex((c) => c.id === card.columnId);
    const target = columns[idx + dir];
    if (!target) return;
    patchBoard(board, (x) => ({ ...x, cards: x.cards.map((c) => (c.id === card.id ? { ...c, columnId: target.id, order: x.cards.filter((o) => o.columnId === target.id).length } : c)) }));
  };

  // ---- drag-handle: ONE reorder path for the board (§4) ----
  const boardRef = useRef(board);
  boardRef.current = board;
  const [say, setSay] = useState("");
  const commitRef = useRef<(colId: string, from: number, to: number) => void>(() => {});
  commitRef.current = (colId, from, to) => {
    const b = boardRef.current;
    const list = cardsOf(b, colId);
    const to2 = Math.max(0, Math.min(list.length - 1, to));
    if (to2 === from) return;
    const next = list.map((c) => c.id);
    const [movedId] = next.splice(from, 1);
    next.splice(to2, 0, movedId);
    const movedTitle = list.find((c) => c.id === movedId)?.title ?? "Card";
    patchBoard(b, (x) => ({
      ...x,
      cards: x.cards.map((c) => {
        const slot = next.indexOf(c.id);
        return c.columnId === colId && slot >= 0 ? { ...c, order: slot } : c;
      }),
    }));
    setSay(`${movedTitle} — position ${to2 + 1} of ${next.length}`);
  };
  const onGripDown = useBoardDrag(commitRef);
  const onGripKey = (e: React.KeyboardEvent, colId: string, idx: number, n: number) => {
    if (e.key === "ArrowUp" && idx > 0) {
      e.preventDefault();
      commitRef.current(colId, idx, idx - 1);
    } else if (e.key === "ArrowDown" && idx < n - 1) {
      e.preventDefault();
      commitRef.current(colId, idx, idx + 1);
    }
  };

  if (!board) {
    return (
      <section className="card">
        <p className="muted">No kanban boards yet.</p>
        <button className="primary" onClick={addBoard}>New board</button>
      </section>
    );
  }

  const columns = [...board.columns].sort((a, b) => a.order - b.order);

  return (
    <div className="stack">
      <p className="sr-only" role="status" aria-live="polite" data-testid="kan-order-say">{say}</p>
      <div className="toolbar card">
        <select value={board.id} onChange={(e) => setBoardId(e.target.value)}>
          {db.kanban.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input
          value={board.name}
          onChange={(e) => patchBoard(board, (x) => ({ ...x, name: e.target.value }))}
        />
        <button className="small-btn" onClick={addBoard}>New board</button>
        <button className="small-btn" onClick={() => patchBoard(board, (x) => ({ ...x, columns: [...x.columns, { id: uid(), name: `Column ${x.columns.length + 1}`, order: x.columns.length }] }))}>
          Add column
        </button>
        <HoldButton
          label="Delete board"
          confirmHint={`Holding — deletes ${board.name}`}
          onConfirm={() => removeBoard(board)}
          testid="kan-delete-board"
        />
      </div>
      <div className="kanban">
        {columns.map((col) => (
          <div className="card kanban-col" key={col.id}>
            <div className="row spread">
              <input
                className="col-name"
                value={col.name}
                onChange={(e) => patchBoard(board, (x) => ({ ...x, columns: x.columns.map((c) => (c.id === col.id ? { ...c, name: e.target.value } : c)) }))}
              />
              <HoldButton
                label="Delete column"
                confirmHint={`Holding — deletes ${col.name} and its cards`}
                onConfirm={() => patchBoard(board, (x) => ({ ...x, columns: x.columns.filter((c) => c.id !== col.id), cards: x.cards.filter((c) => c.columnId !== col.id) }))}
                testid={`kan-delete-col-${col.id}`}
              />
            </div>
            {cardsOf(board, col.id).map((card, idx, all) => (
              <div
                className={`kan-card ${card.id === focusId ? "kan-card on" : ""}`}
                key={card.id}
                data-id={card.id}
                data-testid={`kan-card-${card.id}`}
              >
                <div className="kan-head">
                  <button
                    className="kan-grip"
                    aria-label={`Reorder: position ${idx + 1} of ${all.length} in ${col.name}. Arrow keys move it.`}
                    title="Drag to reorder"
                    onPointerDown={(e) => onGripDown(e, col.id, card.id)}
                    onKeyDown={(e) => onGripKey(e, col.id, idx, all.length)}
                    data-testid={`kan-grip-${card.id}`}
                  >
                    <svg viewBox="0 0 10 14" aria-hidden="true">
                      <circle cx="3" cy="2.5" r="1.25" />
                      <circle cx="7" cy="2.5" r="1.25" />
                      <circle cx="3" cy="7" r="1.25" />
                      <circle cx="7" cy="7" r="1.25" />
                      <circle cx="3" cy="11.5" r="1.25" />
                      <circle cx="7" cy="11.5" r="1.25" />
                    </svg>
                  </button>
                  <input
                    value={card.title}
                    onChange={(e) => patchBoard(board, (x) => ({ ...x, cards: x.cards.map((c) => (c.id === card.id ? { ...c, title: e.target.value } : c)) }))}
                  />
                </div>
                  <textarea
                    rows={2}
                    placeholder="Note (optional)"
                    value={card.note ?? ""}
                    onChange={(e) => patchBoard(board, (x) => ({ ...x, cards: x.cards.map((c) => (c.id === card.id ? { ...c, note: e.target.value || undefined } : c)) }))}
                  />
                  <div className="row spread">
                    <div className="row">
                      <button className="small-btn" disabled={col.id === columns[0]?.id} onClick={() => move(card, -1)}>←</button>
                      <button className="small-btn" disabled={col.id === columns[columns.length - 1]?.id} onClick={() => move(card, 1)}>→</button>
                    </div>
                    <button
                      className="link danger"
                      title="Delete card"
                      data-testid={`kan-del-${card.id}`}
                      onClick={() => {
                        patchBoard(board, (x) => ({ ...x, cards: x.cards.filter((c) => c.id !== card.id) }));
                        undoBus.request({
                          title: `Deleted card "${card.title.slice(0, 40)}"`,
                          onUndo: () => {
                            const b = boardRef.current;
                            const maxOrder = Math.max(-1, ...b.cards.filter((c) => c.columnId === card.columnId).map((c) => c.order));
                            patchBoard(b, (x) => ({ ...x, cards: [...x.cards, { ...card, order: maxOrder + 1 }] }));
                          },
                        });
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            <div className="row">
              <input
                placeholder="Add card"
                value={cardDrafts[col.id] ?? ""}
                onChange={(e) => setCardDrafts({ ...cardDrafts, [col.id]: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addCard(col.id)}
              />
              <button className="small-btn" onClick={() => addCard(col.id)}>+</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
