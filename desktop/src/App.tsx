import { useEffect, useState, useCallback, useRef, memo, type ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  Car,
  Code,
  Settings as SettingsIcon,
  FlaskConical,
  Flower2,
  Heart as HeartIcon,
  House,
  Images,
  Luggage,
  Notebook,
  PanelLeftClose,
  PanelLeftOpen,
  Plane,
  Search,
  SlidersHorizontal,
  Hammer,
  FileText,
  Wifi,
  Wrench,
  Wallet,
  Coffee,
} from "lucide-react";
import { lastSeenLine } from "@core/syncStatus";
import { visibleAttention } from "@core/attention";
import { todayISO } from "@core/format";
import { StoreProvider, useStore } from "./store";
import { LockScreen } from "./LockScreen";
import { SyncBridge } from "./sync/SyncBridge";
import { WinControls } from "./components/WinControls";
import { secureStatus, lockSecure } from "./platform/secure";
import { localPrefs } from "./platform/storage";
import { storedThemePref, THEME_KEY } from "./platform/theme";
import { isTauri } from "./platform/env";
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
import { BootSkeleton } from "./components/BootSkeleton";
import { ScreenToolbar, ToolbarHostProvider } from "./components/ScreenToolbar";
import { VaultPulse } from "./components/VaultPulse";
import { confirmDialog } from "./components/Dialog";
import { startupAutoUpdate } from "./platform/updater";
import { BMC_URL, openExternal } from "./platform/support";

export type SectionId = "today" | "attention" | "money" | "vehicles" | "health" | "cycle" | "home" | "travel" | "papers" | "notes" | "media" | "tools" | "rules" | "dev" | "builder" | "net" | "lab" | "settings" | "devlab";

/** Bumped per release; also shown as the sidebar chip. */
export const APP_VERSION = "0.17.0";

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

const ic = (Icon: React.ComponentType<{ size?: number | string; strokeWidth?: number; className?: string }>) => {
  const Glyph = memo(function Glyph() {
    return <Icon className="ic" size={17} strokeWidth={1.65} aria-hidden="true" />;
  });
  return <Glyph />;
};

type SectionDef = { id: SectionId; label: string; icon: ReactNode; group: "workspace" | "modules" | "foot" };

/** The one Support row in the sidebar foot — leaves the app, marks nothing. */
const SupportRow = memo(function SupportRow() {
  return (
    <button
      className="nav nav-support"
      onClick={() => void openExternal(BMC_URL)}
      title="buymeacoffee.com/soldier0x0"
      data-testid="sidebar-support"
    >
      {ic(Coffee)}
      <span className="nav-label">Support Nucleus</span>
      <kbd>free app</kbd>
    </button>
  );
});

const SECTIONS: SectionDef[] = [
  {
    id: "today",
    label: "Today",
    group: "workspace",
    icon: ic(CalendarDays),
  },
  {
    id: "attention",
    label: "Attention",
    group: "workspace",
    icon: ic(Bell),
  },
  {
    id: "money",
    label: "Money",
    group: "modules",
    icon: ic(Wallet),
  },
  {
    id: "vehicles",
    label: "Vehicles",
    group: "modules",
    icon: ic(Car),
  },
  {
    id: "health",
    label: "Health",
    group: "modules",
    icon: ic(HeartIcon),
  },
  {
    id: "cycle",
    label: "Cycle",
    group: "modules",
    icon: ic(Flower2),
  },
  {
    id: "home",
    label: "Home",
    group: "modules",
    icon: ic(House),
  },
  {
    id: "travel",
    label: "Travel",
    group: "modules",
    icon: ic(Luggage),
  },
  {
    id: "papers",
    label: "Papers",
    group: "modules",
    icon: ic(FileText),
  },
  {
    id: "notes",
    label: "Notes",
    group: "modules",
    icon: ic(Notebook),
  },
  {
    id: "media",
    label: "Media",
    group: "modules",
    icon: ic(Images),
  },
  {
    id: "tools",
    label: "Tools",
    group: "modules",
    icon: ic(Wrench),
  },
  {
    id: "rules",
    label: "Rules",
    group: "modules",
    icon: ic(SlidersHorizontal),
  },
  {
    id: "dev",
    label: "Dev Tools",
    group: "modules",
    icon: ic(Code),
  },
  {
    id: "builder",
    label: "Tool Builder",
    group: "modules",
    icon: ic(Hammer),
  },
  {
    id: "net",
    label: "Network",
    group: "modules",
    icon: ic(Wifi),
  },
  {
    id: "lab",
    label: "Lab",
    group: "modules",
    icon: ic(FlaskConical),
  },
  {
    id: "settings",
    label: "Settings",
    group: "foot",
    icon: ic(SettingsIcon),
  },
];

/** Dev Lab stays out of the sidebar; the palette and Ctrl+Alt+D reach it. */
const HIDDEN_SECTIONS: SectionId[] = ["devlab"];

const RAIL_KEY = "nucleus.desktop.rail";

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
        <WinControls overlay />
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

/** What the sidebar foot adds up to: a glanceable sync line, not a panel. */
function Shell() {
  const { db, ready, unreadable, retryLoad, discardUnreadable } = useStore();
  const [section, setSection] = useState<SectionId>(() => {
    const h = window.location.hash.replace("#/", "");
    return SECTIONS.some((s) => s.id === h) ? (h as SectionId) : "today";
  });
  const [focus, setFocus] = useState<{ id?: string } | null>(null);
  const [palette, setPalette] = useState(false);
  const [themeAsk, setThemeAsk] = useState(!localPrefs.get(THEME_KEY));
  const [rail, setRail] = useState(localPrefs.get(RAIL_KEY) === "true");
  const [maxed, setMaxed] = useState(false);
  const lastDeviceSync = (db.settings.pairedDevices ?? []).map((d) => d.lastSyncAt).filter(Boolean).sort().pop() ?? db.settings.lastSyncAt;
  const attentionCount = visibleAttention(db, todayISO()).length;

  // Hash deep-links: #/money opens Money (also how external docs link, and a
  // no-mouse route to any screen). Keys raised to the same ids SECTIONS uses.
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace("#/", "");
      if (SECTIONS.some((s) => s.id === h)) setSection(h as SectionId);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    const want = `#/${section}`;
    if (window.location.hash !== want) window.history.replaceState(null, "", want);
  }, [section]);


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

  const toggleRail = useCallback(() => {
    setRail((p) => {
      localPrefs.set(RAIL_KEY, String(!p));
      return !p;
    });
  }, []);

  // Self-update at launch: once the shell has settled, the updater
  // quietly checks, downloads and installs, then relaunches into the new
  // version. Failures stay in the console — the app keeps working.
  useEffect(() => {
    const t = setTimeout(() => {
      void startupAutoUpdate();
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  // Window lifestyle: keep the zoom glyph state in sync so the double-click
  // zoom affordance stays truthful. Browser preview ignores the whole cluster.
  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    let unlisten: (() => void) | null = null;
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      void win.isMaximized().then((m) => alive && setMaxed(m));
      void win
        .onResized(() => {
          void win.isMaximized().then((m) => alive && setMaxed(m));
        })
        .then((fn) => {
          unlisten = fn;
          if (!alive) fn();
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
      unlisten?.();
    };
  }, []);
  // The window header drags from anywhere non-interactive; double-click zooms.
  // Handled here (not via data-tauri-drag-region) so every screen's portalled
  // title inherits the behaviour without touching twenty screen files.
  const onHeaderMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!isTauri() || e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, select, textarea, label, [role='listbox'], kbd")) return;
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().startDragging());
  }, []);
  const onHeaderDoubleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!isTauri()) return;
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, select, textarea, label, [role='listbox'], kbd")) return;
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().toggleMaximize());
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
        <WinControls overlay />
        <div className="card wide-card">
          <h2>The document could not be opened</h2>
          <p className="muted">
            A saved document exists on this computer, but it did not decrypt or parse. Nothing has been written over it.
          </p>
          <div className="row">
            <button className="primary" onClick={retryLoad}>Try again</button>
            <button
              className="danger-btn"
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: "Start fresh?",
                    body: "Without the old document. The unreadable copy is kept on disk as a backup first.",
                    confirmLabel: "Start fresh",
                    danger: true,
                  })
                )
                  void discardUnreadable();
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
    return <BootSkeleton />;
  }

  if (themeAsk) {
    return (
      <>
        <WinControls overlay />
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
        title={rail ? s.label : i < 9 ? `Ctrl+${i + 1}` : undefined}
        data-testid={`nav-${s.id}`}
        aria-current={s.id === section ? "true" : undefined}
      >
        {s.icon}
        <span className="nav-label">{s.label}</span>
        {s.id === "attention" && attentionCount > 0 ? <span className="nav-badge" data-testid="attention-badge">{attentionCount}</span> : null}
        {rail && s.id === section ? <span className="nav-rail-dot" aria-hidden="true" /> : null}
      </button>
    );
  };
  const seenTxt = lastSeenLine(lastDeviceSync, new Date().toISOString());
  const whenTxt = seenTxt.startsWith("Phone last seen ") ? seenTxt.slice("Phone last seen ".length) : seenTxt;
  const seenMins = lastDeviceSync ? Math.round((Date.now() - Date.parse(lastDeviceSync)) / 60000) : null;
  const dotCls = !lastDeviceSync || seenMins === null || !Number.isFinite(seenMins) ? "" : seenMins < 1440 ? "good" : "warn";

  return (
    <div className="shell" data-app-theme={savedTheme} data-rail={rail ? "true" : "false"}>
      <SyncBridge />
      <SupportNudge />
      <UndoSnackbar />
      <ToastStack />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <nav className="side no-print" aria-label="Sections">
        <div className="brand">
          <span className="logo" aria-hidden="true"></span>
          {!rail && <b>Nucleus</b>}
          {!rail && <span className="ver">v{APP_VERSION}</span>}
          <button
            className="collapse-btn"
            onClick={toggleRail}
            title={rail ? "Expand sidebar" : "Collapse to icons"}
            data-testid="sidebar-collapse"
            aria-label={rail ? "Expand sidebar" : "Collapse sidebar to icons"}
            aria-pressed={rail}
          >
            {rail ? <PanelLeftOpen size={15} strokeWidth={1.8} /> : <PanelLeftClose size={15} strokeWidth={1.8} />}
          </button>
        </div>
        {!rail && (
          <button
            className="nav-search"
            onClick={() => setPalette(true)}
            title="Ctrl+K"
            data-testid="open-palette"
            aria-haspopup="dialog"
            aria-expanded={palette || undefined}
          >
            {ic(Search)}
            <span className="grow">Search anything</span>
            <kbd>Ctrl K</kbd>
          </button>
        )}
        {rail && (
          <button className="nav" title="Search (Ctrl+K)" onClick={() => setPalette(true)} aria-haspopup="dialog" data-testid="open-palette-rail">
            {ic(Search)}
          </button>
        )}
        {!rail && <div className="slabel">Workspace</div>}
        {SECTIONS.filter((s) => s.group === "workspace" && moduleOn(s.id)).map(navBtn)}
        {!rail && <div className="slabel">Modules</div>}
        {SECTIONS.filter((s) => s.group === "modules" && moduleOn(s.id)).map(navBtn)}
        <div className="side-foot">
          {SECTIONS.filter((s) => s.group === "foot").map(navBtn)}
          <SupportRow />
          <VaultPulse db={db} />
          {!rail && (
            <>
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
            </>
          )}
        </div>
      </nav>
      <main className="main" id="main-content" tabIndex={-1} data-scrolled="false" ref={mainRef} onScroll={onMainScroll}>
        <DropLayer />
        {/* One sticky title bar for every screen; each screen fills it by portal (§1).
            It is also the window header: drag + double-click zoom live here, the
            traffic lights sit on the left edge. */}
        <ToolbarHostProvider value={toolbarHost}>
          <div
            className="toolbar-shell"
            ref={setToolbarHost}
            data-testid="screen-toolbar"
            onMouseDown={onHeaderMouseDown}
            onDoubleClick={onHeaderDoubleClick}
          >
            <WinControls />
          </div>
          <div className="screen-body" key={section} data-testid="screen-body">
            <ErrorBoundary screenLabel={SECTIONS.find((s) => s.id === section)?.label ?? section}>
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
          </div>
        </ToolbarHostProvider>
      </main>
      {palette ? <CommandPalette onClose={() => setPalette(false)} onJump={jump} includeDev /> : null}
    </div>
  );
}
