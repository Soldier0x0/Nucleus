import { useEffect, useState } from "react";
import { syncStatusLine } from "@core/syncStatus";
import { StoreProvider, useStore } from "./store";
import { LockScreen } from "./LockScreen";
import { secureStatus } from "./platform/secure";
import { Today } from "./screens/Today";
import { Money } from "./screens/Money";
import { Vehicles } from "./screens/Vehicles";
import { Papers } from "./screens/Papers";
import { NotesWikiKanban } from "./screens/NotesWikiKanban";
import { Settings } from "./screens/Settings";

type SectionId = "today" | "money" | "vehicles" | "papers" | "notes" | "settings";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "money", label: "Money" },
  { id: "vehicles", label: "Vehicles" },
  { id: "papers", label: "Papers" },
  { id: "notes", label: "Notes" },
  { id: "settings", label: "Settings" },
];

/**
 * Desktop shell. The PIN opens the key store first; only then is the
 * encrypted document read. Every section is a real editor over the phone's
 * core rules, so imports merge back cleanly in phase D2.
 */
export function App() {
  const [lockMode, setLockMode] = useState<"create" | "unlock" | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    let alive = true;
    secureStatus()
      .then(({ initialized }) => alive && setLockMode(initialized ? "unlock" : "create"))
      .catch(() => alive && setLockMode("create"));
    return () => {
      alive = false;
    };
  }, []);

  if (!lockMode) {
    return (
      <div className="boot">
        <div className="lock-brand">Nucleus</div>
        <p className="muted">Starting…</p>
      </div>
    );
  }
  if (!unlocked) return <LockScreen mode={lockMode} onUnlocked={() => setUnlocked(true)} />;
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { db, ready, unreadable, retryLoad, discardUnreadable } = useStore();
  const [section, setSection] = useState<SectionId>("today");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const target = SECTIONS[Number(e.key) - 1]?.id;
      if (target) {
        e.preventDefault();
        setSection(target);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (unreadable) {
    return (
      <div className="boot">
        <div className="card wide-card">
          <h2>The document could not be opened</h2>
          <p className="muted">
            A saved document exists on this computer, but it did not decrypt or parse. Nothing has been written over it.
          </p>
          <div className="row">
            <button className="primary" onClick={retryLoad}>Try again</button>
            <button
              className="danger-btn"
              onClick={() => {
                if (window.confirm("Start fresh without the old document? The saved file is left untouched on disk.")) void discardUnreadable();
              }}
            >
              Start fresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="boot">
        <p className="muted">Opening your document…</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <nav className="side" aria-label="Sections">
        <div className="brand">Nucleus</div>
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            className={s.id === section ? "nav on" : "nav"}
            onClick={() => setSection(s.id)}
            title={`Ctrl+${i + 1}`}
            data-testid={`nav-${s.id}`}
          >
            {s.label}
          </button>
        ))}
        <div className="side-foot">
          <div className="sync" data-testid="sidebar-sync-status">{syncStatusLine(db.settings.lastSyncAt, new Date().toISOString())}</div>
          <p className="muted small">Your data stays on this computer.</p>
        </div>
      </nav>
      <main className="main">
        {section === "today" ? <Today /> : null}
        {section === "money" ? <Money /> : null}
        {section === "vehicles" ? <Vehicles /> : null}
        {section === "papers" ? <Papers /> : null}
        {section === "notes" ? <NotesWikiKanban /> : null}
        {section === "settings" ? <Settings /> : null}
      </main>
    </div>
  );
}
