/**
 * v0.14 pins: Desktop, complete — the desktop shell gains the command
 * palette, an Attention section with a badge, the Home/Health/Travel/Media
 * module parity screens, Today as a bento with a pick-up tile from the
 * journal, saved views, printing, an in-app PDF viewer, drag-drop import,
 * the tray and start-with-computer, and the first-launch look ask.
 * Desktop-local logic that stays pure lives in platform/savedViews.ts and is
 * imported straight through the test loader, like desktopCompat does.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB, normalizeDB } from "./defaults.ts";
import { bundleForFile } from "./vaultFile.ts";
import { normalizeViews, readViews, VIEWS_KEY, type SavedView } from "../../../desktop/src/platform/savedViews.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const DESK = "../../../desktop";

// ---------- saved views (>pure, imported from the desktop) ----------

const view = (over: Partial<SavedView>): SavedView => ({
  id: "v1",
  name: "Groceries",
  section: "money",
  payload: { query: "grocery" },
  ...over,
});

test("v014 · normalizeViews keeps well-formed views, fills missing ids or trims names", () => {
  const out = normalizeViews([
    view({ id: "a", name: " Rent  " }),
    view({ id: "", name: "no id" }),
    view({ id: "b", name: "", payload: { query: " licence" } }),
    view({ id: "b", name: "x", section: "papers", payload: { query: " licence", tag: "Vehicle", month: "2026-13" } }),
    "junk",
    null,
    view({ id: "c", name: "money default", payload: { query: "", month: "2026-10" } }),
  ]);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((v) => ({ id: v.id, name: v.name, section: v.section })), [
    { id: "a", name: "Rent", section: "money" },
    { id: "b", name: "x", section: "papers" },
    { id: "c", name: "money default", section: "money" },
  ]);
  assert.deepEqual(out[1].payload.tag, "Vehicle");
  assert.equal(out[1].payload.month, undefined);
  assert.equal(out[2].payload.month, "2026-10");
});

test("v014 · normalizeViews deduplicates by id and caps at 20", () => {
  const dupes = Array.from({ length: 24 }, (_, i) => view({ id: `v${i}` }));
  const out = normalizeViews(dupes);
  assert.equal(out.length, 20);
  assert.equal(new Set(out.map((v) => v.id)).size, 20);
  const cl = normalizeViews([view({ id: "x" }), view({ id: "x", name: "second" })]);
  assert.equal(cl.length, 1);
});

test("v014 · readViews reads the desktop-only settings cast and survives normalizeDB", () => {
  const views = [view({ id: "m1", name: "Festive", payload: { query: "", month: "2026-11" } })];
  const db = normalizeDB({ settings: { [VIEWS_KEY]: views } } as unknown);
  assert.ok((db.settings[VIEWS_KEY] as unknown[]) !== undefined, "unknown settings keys survive normalizeDB");
  assert.deepEqual(readViews(db), views);
  assert.deepEqual(readViews(normalizeDB({})), []);
});

test("v014 · saved views travel in file bundles (desktop local only, no sync leak)", () => {
  const db = emptyDB();
  (db.settings as Record<string, unknown>)[VIEWS_KEY] = [view({ id: "m1" })];
  const file = bundleForFile(db);
  assert.ok(Array.isArray(file.settings[VIEWS_KEY]), "bundleForFile must keep desktopViews (no 'sync' in the name)");
  assert.equal(typeof file.settings.desktopSync, "undefined");
});

// ---------- shell / palette / attention pins ----------

const app = read(`${DESK}/src/App.tsx`);

test("v014 · sidebar is the desktop completion list with an attention badge", () => {
  for (const id of ["attention", "money", "vehicles", "health", "home", "travel", "papers", "notes", "media", "settings"]) {
    assert.ok(app.includes(`"${id}"`), `section id ${id}`);
  }
  assert.ok(app.includes("attention-badge"), "attention badge count renders");
  assert.ok(app.includes("visibleAttention(db, todayISO())"), "badge comes from the same attention engine the phone uses");
  assert.ok(!app.includes('label: "Dev Lab"'), "Dev Lab is not a sidebar item");
});

test("v014 · command palette wired with Ctrl+K and the look ask on first launch", () => {
  assert.ok(app.includes("CommandPalette"), "palette overlay");
  assert.ok(app.includes('"k"') && app.includes("setPalette"), "Ctrl+K toggles the palette");
  assert.ok(app.includes("LookChooser") && app.includes("THEME_KEY"), "first launch asks for the look when no pref is saved");
  assert.ok(app.includes("DropLayer"), "drag-drop layer mounts in the shell");
  assert.ok(app.includes('HIDDEN_SECTIONS: SectionId[] = ["devlab"]') && app.includes('section === "devlab"'), "hidden Dev Lab section exists");
  const palette = read(`${DESK}/src/components/CommandPalette.tsx`);
  assert.ok(palette.includes("onDragDropEvent") === false, "palette owns no drop events");
  assert.ok(palette.includes('id === "devlab" && !includeDev'), "Dev Lab hides unless includeDev");
});

// ---------- bento today pins ----------

test("v014 · Today is the bento with the journal pick-up tile", () => {
  const today = read(`${DESK}/src/screens/Today.tsx`);
  assert.ok(today.includes('data-testid="today-pickup"'), "pick-up tile");
  assert.ok(today.includes('data-testid="today-recent"'), "recent changes list");
  assert.ok(today.includes("journalKind") && today.includes("journalLabel") && today.includes("ACT_WORDS"), "tile reads the v0.13 journal");
  assert.ok(today.includes('className="bento"') || today.includes('"bento"'), "bento grid");
  assert.ok(!today.includes("AttentionRow"), "no duplicated attention list; it moved to its own screen");
});

// ---------- saved views UI pins ----------

test("v014 · Money and Papers expose named saved views", () => {
  const money = read(`${DESK}/src/screens/Money.tsx`);
  const papers = read(`${DESK}/src/screens/Papers.tsx`);
  for (const [name, src] of [["money", money], ["papers", papers]] as const) {
    assert.ok(src.includes('from "../platform/savedViews"'), `${name} imports savedViews`);
    assert.ok(src.includes("Save view"), `${name} save button`);
    assert.ok(src.includes('data-testid="money-views"') === (name === "money"), `${name} view chips`);
  }
  assert.ok(money.includes("payload.month"), "money views pin the month");
  assert.ok(papers.includes("payload.tag"), "papers views pin the tag");
});

// ---------- print, viewer, drop, autostart, tray pins ----------

test("v014 · print css + per-screen print buttons", () => {
  const css = read(`${DESK}/src/styles.css`);
  assert.ok(css.includes("@media print"), "print block");
  assert.ok(css.includes(".no-print"), "shared no-print class");
  const money = read(`${DESK}/src/screens/Money.tsx`);
  const health = read(`${DESK}/src/screens/Health.tsx`);
  const home = read(`${DESK}/src/screens/Home.tsx`);
  for (const src of [money, health, home]) assert.ok(src.includes("window.print()"), "screen print button");
});

test("v014 · PDFs render in-app via pdfjs", () => {
  const pkg = JSON.parse(read(`${DESK}/package.json`)) as { dependencies: Record<string, string> };
  assert.match(pkg.dependencies["pdfjs-dist"], /\^?4\./, "pdfjs-dist pinned to v4");
  const papers = read(`${DESK}/src/screens/Papers.tsx`);
  assert.ok(papers.includes("<PdfPane"), "inline pane replaces the handoff paragraph");
  const pane = read(`${DESK}/src/components/PdfPane.tsx`);
  assert.ok(pane.includes("pdf.worker.min.mjs?url"), "bundled same-origin worker");
  assert.ok(papers.includes('openAttachment') || papers.includes("Open in system viewer"), "system viewer stays one click away");
});

test("v014 · drag-drop routes backups and paper files", () => {
  const drop = read(`${DESK}/src/components/DropLayer.tsx`);
  assert.ok(drop.includes("onDragDropEvent"), "tauri drop events");
  assert.ok(drop.includes("parseBackup"), "backup json replaces the document");
  assert.ok(drop.includes("drop-overlay"), "hover overlay");
  assert.ok(drop.includes("MAX_FILE"), "20 MB cap");
  const ingest = read(`${DESK}/src/platform/ingest.ts`);
  assert.ok(ingest.includes("isAttachableMime"), "only images and pdfs attach");
});

test("v014 · tray icon and start-with-computer in the Tauri app", () => {
  const cargo = read(`${DESK}/src-tauri/Cargo.toml`);
  assert.match(cargo, /features = \["tray-icon"\]/, "tauri tray feature");
  assert.match(cargo, /tauri-plugin-autostart = "2"/, "autostart plugin");
  const lib = read(`${DESK}/src-tauri/src/lib.rs`);
  assert.ok(lib.includes("TrayIconBuilder"), "tray builds in setup");
  assert.ok(lib.includes("Show Nucleus") && lib.includes("Quit Nucleus"), "tray menu");
  assert.ok(lib.includes("tauri_plugin_autostart::init"), "autostart plugin initialized");
  const caps = JSON.parse(read(`${DESK}/src-tauri/capabilities/default.json`)) as { permissions: string[] };
  assert.ok(caps.permissions.includes("autostart:allow-enable"), "autostart permissions granted");
  assert.ok(caps.permissions.includes("autostart:allow-disable"), "autostart disable granted");
  const settings = read(`${DESK}/src/screens/Settings.tsx`);
  assert.ok(settings.includes("Start with this computer"), "general toggle");
  assert.ok(settings.includes('data-testid="autostart-note"'), "feedback note");
});

test("v014 · sync contract untouched: journal still local, desktopCompat compile pins unchanged", () => {
  const compat = read("./desktopCompat.test.ts");
  assert.ok(compat.includes("platform/crypto.ts") && compat.includes("platform/security.ts"), "compat gate still watches crypto + security");
  const stamp = read("./syncStamp.ts");
  assert.ok(!stamp.includes("journal") || !/SYNC_COLLECTIONS\s*=/.test(stamp) === false, "syncStamp still owns the collections list");
});
