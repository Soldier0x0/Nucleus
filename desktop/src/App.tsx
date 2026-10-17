import { useEffect, useState } from "react";
import { lastSeenLine } from "@core/syncStatus";
import { visibleAttention } from "@core/attention";
import { todayISO } from "@core/format";
import { StoreProvider, useStore } from "./store";
import { LockScreen } from "./LockScreen";
import { SyncBridge } from "./sync/SyncBridge";
import { secureStatus } from "./platform/secure";
import { localPrefs } from "./platform/storage";
import { storedThemePref, THEME_KEY } from "./platform/theme";
import { Today } from "./screens/Today";
import { Attention } from "./screens/Attention";
import { Money } from "./screens/Money";
import { Vehicles } from "./screens/Vehicles";
import { Health } from "./screens/Health";
import { Home as HomeScreen } from "./screens/Home";
import { Travel } from "./screens/Travel";
import { Papers } from "./screens/Papers";
import { NotesKanban } from "./screens/NotesKanban";
import { Media } from "./screens/Media";
import { Settings } from "./screens/Settings";
import { DevLab } from "./screens/DevLab";
import { CommandPalette } from "./components/CommandPalette";
import { LookChooser } from "./components/LookChooser";
import { DropLayer } from "./components/DropLayer";

export type SectionId = "today" | "attention" | "money" | "vehicles" | "health" | "home" | "travel" | "papers" | "notes" | "media" | "settings" | "devlab";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "attention", label: "Attention" },
  { id: "money", label: "Money" },
  { id: "vehicles", label: "Vehicles" },
  { id: "health", label: "Health" },
  { id: "home", label: "Home" },
  { id: "travel", label: "Travel" },
  { id: "papers", label: "Papers" },
  { id: "notes", label: "Notes" },
  { id: "media", label: "Media" },
  { id: "settings", label: "Settings" },
];

/** Dev Lab stays out of the sidebar; the palette and Ctrl+Alt+D reach it. */
const HIDDEN_SECTIONS: SectionId[] = ["devlab"];

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
  const [focus, setFocus] = useState<{ id?: string } | null>(null);
  const [palette, setPalette] = useState(false);
  const [themeAsk, setThemeAsk] = useState(!localPrefs.get(THEME_KEY));
  const lastDeviceSync = (db.settings.pairedDevices ?? []).map((d) => d.lastSyncAt).filter(Boolean).sort().pop() ?? db.settings.lastSyncAt;
  const attentionCount = visibleAttention(db, todayISO()).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        setSection("devlab");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
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

  const jump = (next: SectionId, focusId?: string) => {
    setFocus(focusId ? { id: focusId } : null);
    setSection(next);
  };

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

  if (themeAsk) {
    return (
      <>
        <LookChooser onChosen={() => setThemeAsk(false)} />
      </>
    );
  }

  const savedTheme = storedThemePref();

  return (
    <div className="shell" data-app-theme={savedTheme}>
      <SyncBridge />
      <nav className="side no-print" aria-label="Sections">
        <div className="brand">Nucleus</div>
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            className={s.id === section ? "nav on" : "nav"}
            onClick={() => jump(s.id)}
            title={`Ctrl+${i + 1}`}
            data-testid={`nav-${s.id}`}
          >
            {s.label}
            {s.id === "attention" && attentionCount > 0 ? <span className="nav-badge" data-testid="attention-badge">{attentionCount}</span> : null}
          </button>
        ))}
        <button className="nav nav-palette" onClick={() => setPalette(true)} title="Ctrl+K" data-testid="open-palette">
          Search ⌘K
        </button>
        <div className="side-foot">
          <div className="sync" data-testid="sidebar-sync-status">{lastSeenLine(lastDeviceSync, new Date().toISOString())}</div>
          <p className="muted small">Your data stays on this computer.</p>
        </div>
      </nav>
      <main className="main">
        <DropLayer />
        {section === "today" ? <Today /> : null}
        {section === "attention" ? <Attention /> : null}
        {section === "money" ? <Money /> : null}
        {section === "vehicles" ? <Vehicles focusId={focus?.id} /> : null}
        {section === "health" ? <Health /> : null}
        {section === "home" ? <HomeScreen /> : null}
        {section === "travel" ? <Travel /> : null}
        {section === "papers" ? <Papers focusId={focus?.id} /> : null}
        {section === "notes" ? <NotesKanban focusId={focus?.id} /> : null}
        {section === "media" ? <Media /> : null}
        {section === "settings" ? <Settings /> : null}
        {section === "devlab" ? <DevLab /> : null}
      </main>
      {palette ? <CommandPalette onClose={() => setPalette(false)} onJump={jump} includeDev /> : null}
    </div>
  );
}
