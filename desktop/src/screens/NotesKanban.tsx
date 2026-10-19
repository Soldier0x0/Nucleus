import { useEffect, useState } from "react";
import { useStore } from "../store";
import { uid } from "@core/format";
import type { KanbanBoard, KanbanCard, Note } from "@core/types";

type Tab = "notes" | "kanban";

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
    if (!window.confirm(`Delete note "${n.title}"?`)) return;
    update((d) => ({ ...d, notes: d.notes.filter((x) => x.id !== n.id) }));
    setSelectedId(null);
  };

  return (
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
    if (!window.confirm(`Delete board "${b.name}"?`)) return;
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
        <button className="link danger" onClick={() => removeBoard(board)}>Delete board</button>
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
              <button
                className="link danger"
                title="Delete column"
                onClick={() => {
                  if (!window.confirm(`Delete column "${col.name}" and its cards?`)) return;
                  patchBoard(board, (x) => ({ ...x, columns: x.columns.filter((c) => c.id !== col.id), cards: x.cards.filter((c) => c.columnId !== col.id) }));
                }}
              >
                ✕
              </button>
            </div>
            {board.cards
              .filter((c) => c.columnId === col.id)
              .sort((a, b) => a.order - b.order)
              .map((card) => (
                <div className={`kan-card ${card.id === focusId ? "kan-card on" : ""}`} key={card.id} data-testid={`kan-card-${card.id}`}>
                  <input
                    value={card.title}
                    onChange={(e) => patchBoard(board, (x) => ({ ...x, cards: x.cards.map((c) => (c.id === card.id ? { ...c, title: e.target.value } : c)) }))}
                  />
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
                    <button className="link danger" onClick={() => patchBoard(board, (x) => ({ ...x, cards: x.cards.filter((c) => c.id !== card.id) }))}>✕</button>
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
