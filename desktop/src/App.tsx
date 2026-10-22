import { useEffect, useState, useCallback, useRef, memo, type ReactNode } from "react";
import { lastSeenLine } from "@core/syncStatus";
import { visibleAttention } from "@core/attention";
import { todayISO } from "@core/format";
import { StoreProvider, useStore } from "./store";
import { LockScreen } from "./LockScreen";
import { SyncBridge } from "./sync/SyncBridge";
import { secureStatus, lockSecure } from "./platform/secure";
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
import { Tools } from "./screens/Tools";
import { Rules } from "./screens/Rules";
import { Dev } from "./screens/Dev";
import { Builder } from "./screens/Builder";
import { Cycle } from "./screens/Cycle";
import { Net } from "./screens/Net";
import { Lab } from "./screens/Lab";
import { Settings } from "./screens/Settings";
import { DevLab } from "./screens/DevLab";
import { CommandPalette } from "./components/CommandPalette";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LookChooser } from "./components/LookChooser";
import { DropLayer } from "./components/DropLayer";
import { SupportNudge } from "./components/SupportNudge";
import { UndoSnackbar } from "./components/UndoSnackbar";
import { ToastStack } from "./components/ToastStack";
import { ScreenToolbar, ToolbarHostProvider } from "./components/ScreenToolbar";
import { VaultPulse } from "./components/VaultPulse";
import { startupAutoUpdate } from "./platform/updater";
import { BMC_URL, openExternal } from "./platform/support";

export type SectionId = "today" | "attention" | "money" | "vehicles" | "health" | "cycle" | "home" | "travel" | "papers" | "notes" | "media" | "tools" | "rules" | "dev" | "builder" | "net" | "lab" | "settings" | "devlab";

/** Bumped per release; also shown as the sidebar chip. */
export const APP_VERSION = "0.16.1";

/** Idle time before the desktop locks itself, like the phone does. */
const IDLE_LOCK_MS = 15 * 60_000;

const IDLE_EVENTS: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "wheel", "touchstart"];

/** Locks the app after IDLE_LOCK_MS without input while it is unlocked. */
function useIdleLock(enabled: boolean, onIdle: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onIdle, IDLE_LOCK_MS);
    };
    for (const event of IDLE_EVENTS) window.addEventListener(event, reset, { passive: true });
    reset();
    return () => {
      clearTimeout(timer);
      for (const event of IDLE_EVENTS) window.removeEventListener(event, reset);
    };
  }, [enabled, onIdle]);
}

type SectionDef = { id: SectionId; label: string; icon: ReactNode; group: "workspace" | "modules" | "foot" };

const ic = (paths: ReactNode) => (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
    {paths}
  </svg>
);

/** The one Support row in the sidebar foot — leaves the app, marks nothing. */
const SupportRow = memo(function SupportRow() {
  return (
    <button
      className="nav nav-support"
      onClick={() => void openExternal(BMC_URL)}
      title="buymeacoffee.com/soldier0x0"
      data-testid="sidebar-support"
    >
      <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
        {/* a small coffee cup: honest, not emoji, and it matches the icon set */}
        <path d="M4 9h11v5.2A4.8 4.8 0 0 1 10.2 19H8.8A4.8 4.8 0 0 1 4 14.2Z" />
        <path d="M15 10.4h2.1a2.4 2.4 0 0 1 0 4.8H15" />
        <path d="M7.5 5.5v1.8M10.5 5.5v1.8" />
      </svg>
      Support Nucleus
      <kbd>free app</kbd>
    </button>
  );
});

const SECTIONS: SectionDef[] = [
  {
    id: "today",
    label: "Today",
    group: "workspace",
    icon: ic(<path d="M3 10.8 12 4l9 6.8M5.5 9.6V20h13V9.6M9.8 20v-5.4h4.4V20" />),
  },
  {
    id: "attention",
    label: "Attention",
    group: "workspace",
    icon: ic(
      <>
        <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </>,
    ),
  },
  {
    id: "money",
    label: "Money",
    group: "modules",
    icon: ic(
      <>
        <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
        <path d="M15.5 12h5.5M12.2 12h.01" />
      </>,
    ),
  },
  {
    id: "vehicles",
    label: "Vehicles",
    group: "modules",
    icon: ic(
      <>
        <path d="M4.5 13.5 6.2 8.4a2 2 0 0 1 1.9-1.4h7.8a2 2 0 0 1 1.9 1.4l1.7 5.1" />
        <path d="M4.5 13.5h15M4.5 13.5V17h3v-1.3h9V17h3v-3.5M7.6 13.5h.01M16.4 13.5h.01" />
      </>,
    ),
  },
  {
    id: "health",
    label: "Health",
    group: "modules",
    icon: ic(<path d="M12 19s-6.6-4.2-8.4-8A4.65 4.65 0 0 1 12 7.7 4.65 4.65 0 0 1 20.4 11c-1.8 3.8-8.4 8-8.4 8Z" />),
  },
  {
    id: "cycle",
    label: "Cycle",
    group: "modules",
    icon: ic(
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      </>,
    ),
  },
  {
    id: "home",
    label: "Home",
    group: "modules",
    icon: ic(<path d="M4 11 12 5l8 6M6.5 9.8V19h11V9.8M9.6 19v-4.2h4.8V19" />),
  },
  {
    id: "travel",
    label: "Travel",
    group: "modules",
    icon: ic(<path d="M3.5 12 20 4l-2.2 16-6-6.2-7.6-1.6ZM18.6 5.4 11.8 13.8" />),
  },
  {
    id: "papers",
    label: "Papers",
    group: "modules",
    icon: ic(
      <>
        <path d="M7 3h7l4 4v14H7ZM14 3.5V8h4.5M9.5 12h5M9.5 15.5h5" />
      </>,
    ),
  },
  {
    id: "notes",
    label: "Notes",
    group: "modules",
    icon: ic(
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 9h8M8 12.5h8M8 16h5" />
      </>,
    ),
  },
  {
    id: "media",
    label: "Media",
    group: "modules",
    icon: ic(
      <>
        <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
        <path d="M3.5 8.5h17M7.5 5.5v3M16.5 5.5v3M8 16h4" />
      </>,
    ),
  },
  {
    id: "tools",
    label: "Tools",
    group: "modules",
    icon: ic(
      <>
        <rect x="5" y="3.5" width="14" height="17" rx="2" />
        <path d="M8.5 8h7M8 11.5h8M9 15h6" />
      </>,),
  },
  {
    id: "rules",
    label: "Rules",
    group: "modules",
    icon: ic(
      <>
        <circle cx="6" cy="6" r="2.2" />
        <circle cx="6" cy="18" r="2.2" />
        <circle cx="17" cy="7" r="2.2" />
        <path d="M6 8.2v7.6M13 6.5a8.5 8.5 0 0 1-5.4 8" />
      </>,
    ),
  },
  {
    id: "dev",
    label: "Dev Tools",
    group: "modules",
    icon: ic(<path d="m9 8-4 4 4 4M15 8l4 4-4 4" />),
  },
  {
    id: "builder",
    label: "Tool Builder",
    group: "modules",
    icon: ic(
      <>
        <rect x="3.5" y="8" width="17" height="11" rx="2" />
        <path d="M8 8V5.5h8V8M9.5 12.5h5" />
      </>,
    ),
  },
  {
    id: "net",
    label: "Network",
    group: "modules",
    icon: ic(
      <>
        <path d="M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0" />
        <circle cx="12" cy="18.5" r="1.3" />
      </>,
    ),
  },
  {
    id: "lab",
    label: "Lab",
    group: "modules",
    icon: ic(
      <>
        <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
        <path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" />
      </>,
    ),
  },
  {
    id: "settings",
    label: "Settings",
    group: "foot",
    icon: ic(
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3.5v2.6M12 17.9v2.6M3.5 12h2.6M17.9 12h2.6M6 6l1.9 1.9M16.1 16.1 18 18M6 18l1.9-1.9M16.1 7.9 18 6" />
      </>,
    ),
  },
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

  // 15 idle minutes send the app back to the lock screen, like the phone.
  const idleLock = useCallback(() => {
    lockSecure();
    setUnlocked(false);
  }, []);
  useIdleLock(unlocked, idleLock);

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

  // A module switched off in Settings takes its section with it: the sidebar row,
  // the palette entry and (if it was the open screen) this very panel.
  const moduleOn = (id: SectionId): boolean => {
    if (id === "today" || id === "attention" || id === "settings" || id === "devlab") return true;
    if (id === "notes") return !["notes", "kanban"].every((mid) => db.settings.modules.find((m) => m.id === mid)?.enabled === false);
    const state = db.settings.modules.find((m) => m.id === id);
    return state ? state.enabled : true;
  };
  useEffect(() => {
    if (!moduleOn(section)) setSection("today");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.settings.modules, section]);

  // Spotlight hover (§6): one delegated pointermove writes --mx/--my onto the
  // hovered tile; rects are cached per card and lazily re-read only after a
  // scroll/resize (the rebuild's layout-cost rule — never per move).
  useEffect(() => {
    const rects = new WeakMap<HTMLElement, { top: number; left: number; epoch: number }>();
    let epoch = 0;
    const bump = () => {
      epoch++;
    };
    window.addEventListener("scroll", bump, { capture: true, passive: true });
    window.addEventListener("resize", bump, { passive: true });
    const rectOf = (t: HTMLElement) => {
      const hit = rects.get(t);
      if (hit && hit.epoch === epoch) return hit;
      const r = t.getBoundingClientRect();
      const next = { top: r.top, left: r.left, epoch };
      rects.set(t, next);
      return next;
    };
    const onMove = (e: PointerEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(".tile, .kpi");
      if (!t) return;
      const r = rectOf(t);
      t.style.setProperty("--mx", `${e.clientX - r.left}px`);
      t.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", bump, { capture: true });
      window.removeEventListener("resize", bump);
    };
  }, []);

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

  // Self-update at launch: once the shell has settled, the updater
  // quietly checks, downloads and installs, then relaunches into the new
  // version. Failures stay in the console — the app keeps working.
  useEffect(() => {
    const t = setTimeout(() => {
      void startupAutoUpdate();
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  // Hooks BEFORE any early return (React rules-of-hooks: the boot and
  // lock screens render fewer nodes but must run the same hook count).
  // Scroll-edge cue: the toolbar hairline appears once content passes beneath
  // it (§1). Written straight onto the element so it does not re-render the app.
  const mainRef = useRef<HTMLElement | null>(null);
  const onMainScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const next = el.scrollTop > 2 ? "true" : "false";
    if (el.dataset.scrolled !== next) el.dataset.scrolled = next;
  }, []);
  useEffect(() => {
    const el = mainRef.current;
    if (el) el.dataset.scrolled = el.scrollTop > 2 ? "true" : "false";
  }, [section]);
  // The sticky toolbar's portal host: screens render titles/actions through it.
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);

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
                if (window.confirm("Start fresh without the old document? The unreadable copy is kept on disk as a backup first.")) void discardUnreadable();
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

  const navBtn = (s: SectionDef) => {
    const i = SECTIONS.findIndex((x) => x.id === s.id);
    return (
      <button
        key={s.id}
        className={s.id === section ? "nav on" : "nav"}
        onClick={() => jump(s.id)}
        title={i < 9 ? `Ctrl+${i + 1}` : undefined}
        data-testid={`nav-${s.id}`}
      >
        {s.icon}
        {s.label}
        {s.id === "attention" && attentionCount > 0 ? <span className="nav-badge" data-testid="attention-badge">{attentionCount}</span> : null}
      </button>
    );
  };
  const seenTxt = lastSeenLine(lastDeviceSync, new Date().toISOString());
  const whenTxt = seenTxt.startsWith("Phone last seen ") ? seenTxt.slice("Phone last seen ".length) : seenTxt;
  const seenMins = lastDeviceSync ? Math.round((Date.now() - Date.parse(lastDeviceSync)) / 60000) : null;
  const dotCls = !lastDeviceSync || seenMins === null || !Number.isFinite(seenMins) ? "" : seenMins < 1440 ? "good" : "warn";

  return (
    <div className="shell" data-app-theme={savedTheme}>
      <SyncBridge />
      <SupportNudge />
      <UndoSnackbar />
      <ToastStack />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <nav className="side no-print" aria-label="Sections">
        <div className="brand">
          <span className="logo" aria-hidden="true"></span>
          <b>Nucleus</b>
          <span className="ver">v{APP_VERSION}</span>
        </div>
        <button
          className="nav-search"
          onClick={() => setPalette(true)}
          title="Ctrl+K"
          data-testid="open-palette"
          aria-haspopup="dialog"
          aria-expanded={palette || undefined}
        >
          <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <span className="grow">Search anything</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="slabel">Workspace</div>
        {SECTIONS.filter((s) => s.group === "workspace" && moduleOn(s.id)).map(navBtn)}
        <div className="slabel">Modules</div>
        {SECTIONS.filter((s) => s.group === "modules" && moduleOn(s.id)).map(navBtn)}
        <div className="side-foot">
          {SECTIONS.filter((s) => s.group === "foot").map(navBtn)}
          <SupportRow />
          <VaultPulse db={db} />
          <div className="syncfoot">
            <div className="grow">
              <div className="who">Phone</div>
              <div className="when" data-testid="sidebar-sync-status">
                {whenTxt}
              </div>
            </div>
            <span className={`dot ${dotCls}`} data-testid="sidebar-sync-dot"></span>
          </div>
          <p className="side-note">Your data stays on this computer.</p>
        </div>
      </nav>
      <main className="main" id="main-content" tabIndex={-1} data-scrolled="false" ref={mainRef} onScroll={onMainScroll}>
        <DropLayer />
        {/* One sticky title bar for every screen; each screen fills it by portal (§1). */}
        <ToolbarHostProvider value={toolbarHost}>
          <div
            className="toolbar-shell"
            ref={setToolbarHost}
            data-testid="screen-toolbar"
          />
          <ErrorBoundary key={section} screenLabel={SECTIONS.find((s) => s.id === section)?.label ?? section}>
          {section === "today" ? <Today onJump={(sec, id) => jump(sec, id)} /> : null}
          {section === "attention" ? <Attention /> : null}
          {section === "money" ? <Money /> : null}
          {section === "vehicles" ? <Vehicles focusId={focus?.id} /> : null}
          {section === "health" ? <Health /> : null}
          {section === "home" ? <HomeScreen /> : null}
          {section === "travel" ? <Travel /> : null}
          {section === "papers" ? <Papers focusId={focus?.id} /> : null}
          {section === "notes" ? <NotesKanban focusId={focus?.id} /> : null}
          {section === "media" ? <Media /> : null}
          {section === "tools" ? <Tools focusId={focus?.id} /> : null}
          {section === "rules" ? <Rules /> : null}
          {section === "dev" ? <Dev /> : null}
          {section === "builder" ? <Builder onJump={(sec, id) => jump(sec, id)} /> : null}
          {section === "cycle" ? <Cycle /> : null}
          {section === "net" ? <Net /> : null}
          {section === "lab" ? <Lab /> : null}
          {section === "settings" ? <Settings /> : null}
          {section === "devlab" ? <DevLab /> : null}
          </ErrorBoundary>
        </ToolbarHostProvider>
      </main>
      {palette ? <CommandPalette onClose={() => setPalette(false)} onJump={jump} includeDev /> : null}
    </div>
  );
}
