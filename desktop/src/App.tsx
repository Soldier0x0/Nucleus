import { useState } from "react";
import { countsOf } from "@core/merge";
import type { DB } from "@core/types";

const SECTIONS = ["Today", "Money", "Vehicles", "Papers", "Notes", "Settings"] as const;

/**
 * Groundwork shell. It opens a plain (unencrypted) phone backup and shows what's
 * inside using the phone's own core code. Encrypted files, editing and sync come
 * in phases D1–D2 (plan/desktop-plan.md).
 */
export function App() {
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("Today");
  const [db, setDb] = useState<DB | null>(null);
  const [error, setError] = useState("");

  const open = async (file: File) => {
    setError("");
    try {
      const parsed = JSON.parse(await file.text());
      const data = (parsed?.data ?? parsed) as DB;
      if (!Array.isArray(data?.txns)) throw new Error("not a Nucleus file");
      setDb(data);
    } catch {
      setDb(null);
      setError("This isn't a plain Nucleus backup. Password-protected files open in a later version.");
    }
  };

  return (
    <div className="shell">
      <nav className="side" aria-label="Sections">
        <div className="brand">Nucleus</div>
        {SECTIONS.map((s) => (
          <button key={s} className={s === section ? "nav on" : "nav"} onClick={() => setSection(s)} data-testid={`nav-${s.toLowerCase()}`}>
            {s}
          </button>
        ))}
      </nav>
      <main className="main">
        <h1>{section}</h1>
        <p className="muted">Desktop preview. Your data stays on this computer.</p>
        <label className="open" data-testid="open-backup">
          Open a phone backup (.json)
          <input type="file" accept=".json,application/json" onChange={(e) => e.target.files?.[0] && open(e.target.files[0])} hidden />
        </label>
        {error ? <p className="error">{error}</p> : null}
        {db ? (
          <table className="counts" data-testid="backup-counts">
            <tbody>
              {Object.entries(countsOf(db)).map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </main>
    </div>
  );
}
