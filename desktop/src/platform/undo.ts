/**
 * Undo bus (v0.17 §4/§7): the desktop's reversed-destructive layer.
 * A screen deletes a record optimistically and hands the same record's
 * restorer here; the UndoSnackbar (one at a time, never stacked) offers the
 * 6-second window. Anything else that wants the same pattern subscribes to
 * the same bus — Money first, later screens follow unchanged.
 */

export type UndoRequest = {
  /** Festina lente: short, honest — "Deleted ₹240 Groceries, Sun 7 Oct". */
  title: string;
  /** The countdown sub-line; defaults to "Deleting for good soon". */
  sub?: string;
  /** Re-insert the same record. Must be a pure restore, never a re-create. */
  onUndo: () => void;
  /** Destructive flash uses --error under 28% remaining. */
  dangerous?: boolean;
};

type Listener = (r: UndoRequest | null) => void;

const listeners = new Set<Listener>();
let current: UndoRequest | null = null;

export const undoBus = {
  /** Replaces whatever is pending — one window at a time, per the digest. */
  request(r: UndoRequest) {
    current = r;
    for (const l of listeners) l(r);
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    l(current);
    return () => listeners.delete(l);
  },
};
