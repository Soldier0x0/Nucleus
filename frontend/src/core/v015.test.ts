/**
 * v0.15 pins: the Warm Paper pass. The desktop is rebuilt on the design
 * boards (paper light theme, 232 px sidebar, bento screens answered with
 * workcols), the station finder brings the OSM pump index into Vehicles,
 * spreadsheet exports mirror the phone column for column, the Android
 * widgets pick up wallpaper colours, the update feed is signed, and the
 * ships-first bugs from the v0.14 audit get their fixes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emptyDB } from "./defaults.ts";
import { normalizeViews, type SavedView } from "../../../desktop/src/platform/savedViews.ts";
import { exportBody, exportFileName, EXPORT_KINDS } from "../../../desktop/src/platform/exporters.ts";
import { todayISO } from "./format.ts";
import {
  aroundRadiusMeters,
  distanceKm,
  mapsLink,
  mergeStations,
  nominatimRequest,
  overpassRequest,
  parseNominatim,
  parseOverpass,
  type PumpDraft,
} from "../../../desktop/src/platform/stations.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const DESK = "../../../desktop";
const REPO = "../../../.";
const RES = "../../../frontend/modules/nucleus-android/android/src/main/res";

// ---------- Warm Paper design system ----------

test("v015 · styles.css is the Warm Paper board rewrite", () => {
  const css = read(`${DESK}/src/styles.css`);
  assert.ok(css.includes("#f5f1ea"), "paper light background token");
  assert.ok(css.includes("#d8934c"), "paper dark accent");
  assert.ok(css.includes(".topbar") && css.includes(".caption"), "page topbar");
  assert.ok(/\.workcols\s*\{/.test(css), "two-column board grid");
  assert.ok(/\.bento\s*\{/.test(css), "today bento grid on the board");
  assert.ok(css.includes(".tablecard"), "borderless table card");
  assert.ok(css.includes(".stat-row"), "vehicle stats row keeps its four-up layout");
  assert.ok(css.includes(".slabel") || css.includes("Workspace"), "grouped sidebar labels");
});

test("v015 · print keeps the list rows and media status visible", () => {
  const css = read(`${DESK}/src/styles.css`);
  assert.ok(/button\.doc\s*\{/.test(css.match(/@media print[\s\S]*$/)?.[0] ?? ""), "paper rows are buttons and must survive print");
  assert.ok(/\.no-view\s*\{/.test(css.match(/@media print[\s\S]*$/)?.[0] ?? ""), "media status prints");
});

test("v015 · the shell jumps straight from Today and stamps v0.15", () => {
  const app = read(`${DESK}/src/App.tsx`);
  assert.match(app, /APP_VERSION\s*=\s*"0\.15"/, "version export drives the sidebar chip and About");
  assert.ok(app.includes("onJump"), "Today talks back to the shell");
});

// ---------- budget: the desktop export mirror ----------

test("v015 · desktop exports use the phone's exact column plan", () => {
  const phone = read("./exports.ts");
  for (const headers of [
    '["date", "type", "amount", "currency", "category", "note"]',
    '["date", "vehicle", "odometer", "quantity", "price", "total", "note"]',
    '["date", "vehicle", "odometer", "kind", "cost", "details", "note"]',
    '["name", "amount", "cycle", "next renewal", "category", "active"]',
    '["type", "name", "target/original", "saved/balance", "rate %", "monthly", "target date"]',
    '["title", "body", "checklist", "updated"]',
  ]) {
    // the phone's exports.ts writes these header rows too; both sides stay in lockstep
    assert.ok(phone.includes(headers), `header ${headers}`);
  }
  const kinds = EXPORT_KINDS.map((k) => k.kind);
  assert.deepEqual(kinds, ["transactions", "fuel", "services", "subscriptions", "jars", "notes", "calendar"]);
});

test("v015 · exportBody rows stay column-for-column (transactions, jars, notes)", () => {
  const db = emptyDB();
  db.settings.currency = "₹";
  db.txns = [
    { id: "t1", type: "expense", amount: 45, category: "Tea", date: "2026-01-02", note: " PG", cash: true },
    { id: "t2", type: "income", amount: 300, category: "Other", date: "2026-01-03", note: 'odd, "split"' },
  ];
  assert.equal(
    exportBody(db, "transactions"),
    [
      "date,type,amount,currency,category,note",
      "2026-01-02,expense,45,₹,Tea, PG",
      '2026-01-03,income,300,₹,Other,"odd, ""split"""',
    ].join("\n"),
  );
  db.funds = [{ id: "j1", name: "Rainy day", kind: "jar", target: 12000, contributions: [{ amount: 1000, date: "2026-01-01" }], base: 0, ratePct: 0, monthly: 0, targetDate: "", note: "", updatedAt: "" } as never];
  db.debts = [];
  assert.match(exportBody(db, "jars"), /^type,name,target\/original,saved\/balance/);
  assert.match(exportBody(db, "jars"), /jar,Rainy day,12000,1000/);
  assert.match(exportBody(db, "notes"), /^title,body,checklist,updated/);
  db.notes = [{ id: "n1", title: "Milk?", body: "", checklist: [], updatedAt: 0 }] as never;
  assert.match(exportBody(db, "notes"), /Milk\?,/);
  assert.match(exportFileName("transactions"), /^nucleus-transactions-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.equal(exportFileName("calendar"), `nucleus-calendar-${todayISO()}.ics`);
});

// ---------- station finder: pure OSM pieces ----------

test("v015 · the Overpass query asks only for fuel nodes around the city", () => {
  const req = overpassRequest({ lat: 12.9716, lon: 77.5946 });
  assert.equal(req.url, "https://overpass-api.de/api/interpreter");
  assert.match(req.body, /\[out:json\]\[timeout:25\];node\["amenity"="fuel"\]/);
  assert.match(req.body, /around:30000,12\.97160,77\.59460/);
  assert.equal(aroundRadiusMeters(), 30000);
  assert.match(req.body, /;out body 40;/);
  const geo = nominatimRequest("  Mangalore ");
  assert.equal(geo, "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=Mangalore");
});

test("v015 · parseNominatim and parseOverpass read the OSM payloads", () => {
  const place = parseNominatim('[{"display_name":"Mangalore, Karnataka","lat":"12.9141","lon":"74.8560"}]');
  assert.ok(place);
  assert.equal(place?.name, "Mangalore");
  assert.equal(parseNominatim("not json"), null);
  const pumps = parseOverpass(
    JSON.stringify({
      elements: [
        { type: "node", id: 441, lat: 12.9, lon: 74.8, tags: { name: "HP Fuel Station", brand: "HP" } },
        { type: "node", id: 442, lat: 12.9, lon: 74.8, tags: {} },
        { type: "way", id: 443, lat: 12.9, lon: 74.8 },
        { type: "node", id: 444 },
      ],
    }),
  );
  assert.equal(pumps.length, 2);
  assert.equal(pumps[0].osmId, "441");
  assert.equal(pumps[0].brand, "HP");
  assert.equal(pumps[1].name, "");
  assert.deepEqual(parseOverpass("nope"), []);
});

test("v015 · distance, maps link and the favourites-first merge", () => {
  const home = { lat: 12.9716, lon: 77.5946 };
  const far = { lat: 13.0454, lon: 77.6532 };
  const km = distanceKm(home, far);
  assert.ok(km > 9 && km < 13, `${km} km reads like the real hop`);
  assert.equal(distanceKm(home, home), 0);
  assert.equal(
    mapsLink({ lat: 12.9, lon: 74.8 }, { lat: 13, lon: 75 }),
    "https://www.google.com/maps/dir/?api=1&origin=12.9,74.8&destination=13,75",
  );
  const drafts: PumpDraft[] = [
    { osmId: "1", name: "Shell", brand: "Shell", lat: 12.8, lon: 74.7 },
    { osmId: "2", name: "Deja dupe", lat: 12.8, lon: 74.8 },
  ];
  const saved = [
    { id: "s2", name: "Deja dupe" } as never,
    { id: "s1", name: "My pump", favorite: true, lat: 12.9, lon: 74.8 } as never,
  ];
  const merged = mergeStations(home, saved, drafts);
  assert.equal(merged[0].id, "s1", "favourites come first");
  assert.ok(merged[0]?.dist !== undefined);
  assert.ok(!merged.some((s) => s.id === "osm-2"), "saved stations are never duplicated by OSM drafts");
  const unnamed = mergeStations(home, [], [{ osmId: "9", name: "", brand: "IOC", lat: 0, lon: 0 }]);
  assert.equal(unnamed[0].name, "IOC");
});

test("v015 · the station finder wires OSM into the app with the web callers", () => {
  const finder = read(`${DESK}/src/components/StationFinder.tsx`);
  const stations = read(`${DESK}/src/platform/stations.ts`);
  assert.ok(finder.includes('data-testid="station-city"') && finder.includes('data-testid="station-search"'), "city input and button");
  assert.ok(finder.includes('data-testid="station-finder"'), "card testid");
  assert.ok(finder.includes("overpassRequest") && stations.includes("amenity"), "OSM request path");
  assert.ok(finder.includes("plugin-opener") || finder.includes("openUrl"), "Maps opens through the opener plugin");
  assert.ok(!finder.includes("12.9716"), "no silent city fallback: distances need a real place");
  const conf = read(`${DESK}/src-tauri/tauri.conf.json`);
  assert.ok(conf.includes("overpass-api.de") && conf.includes("nominatim.openstreetmap.org"), "CSP lets the OSM hosts through");
  const caps = read(`${DESK}/src-tauri/capabilities/default.json`);
  assert.ok(caps.includes("opener:allow-open-url"), "Maps link capability");
});

// ---------- saved views on Travel + Media ----------

test("v015 · saved views cover travel and media too", () => {
  const view = (over: Partial<SavedView>): SavedView => ({ id: "v", name: "n", section: "money", payload: { query: "" }, ...over });
  const out = normalizeViews([view({ id: "a", section: "travel" }), view({ id: "b", section: "media" }), view({ id: "c", section: "kanban" as never })]);
  assert.deepEqual(out.map((v) => v.section), ["travel", "media", "money"]);
  for (const name of ["travel", "media"]) {
    const src = read(`${DESK}/src/screens/${name === "travel" ? "Travel" : "Media"}.tsx`);
    assert.ok(src.includes('from "../platform/savedViews"'));
    assert.ok(src.includes("Save view"));
  }
  assert.ok(read(`${DESK}/src/screens/Travel.tsx`).includes('data-testid="travel-views"'));
  assert.ok(read(`${DESK}/src/screens/Media.tsx`).includes('data-testid="media-views"'));
});

// ---------- drop a folder ----------

test("v015 · dropping folders walks them without a fake depth option", () => {
  const drop = read(`${DESK}/src/components/DropLayer.tsx`);
  assert.ok(drop.includes("MAX_DROP_FILES"), "folder cap constant");
  assert.ok(drop.includes("walkDir(child, out, cap, 1)"), "folders recurse through the walker");
  assert.ok(drop.includes("join(path, e.name)"), "fs v2 needs explicit path joins");
  assert.ok(drop.includes("await readDir(path)"), "plain readDir — the depth option does not exist");
});

// ---------- money screen answers ----------

test("v015 · money: export button, typed add button, non-empty view guard", () => {
  const money = read(`${DESK}/src/screens/Money.tsx`);
  assert.ok(money.includes('data-testid="money-export-csv"'), "export CSV button");
  assert.ok(money.includes('exportKindFile(db, "transactions")'), "CSV through the pure exporter");
  assert.ok(money.includes('draft.type === "income" ? "Add income" : "Add expense"'), "button names the row it writes");
  assert.ok(money.includes('!query.trim() && catFilter === "all"'), "an untouched filter set is not a view");
});

// ---------- the update feed ----------

test("v015 · the updater is signed, pinned and reachable", () => {
  const conf = read(`${DESK}/src-tauri/tauri.conf.json`);
  assert.ok(conf.includes('"createUpdaterArtifacts": true'), "bundler signs the installers");
  assert.match(conf, /"pubkey":\s*"dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWdu/, "minisign public key");
  assert.ok(conf.includes("/releases/latest/download/latest.json"), "moving manifest on GitHub");
  const cargo = read(`${DESK}/src-tauri/Cargo.toml`);
  assert.ok(cargo.includes('tauri-plugin-updater = "2"'));
  const lib = read(`${DESK}/src-tauri/src/lib.rs`);
  assert.ok(lib.includes("tauri_plugin_updater::Builder"), "plugin initialized");
  const caps = read(`${DESK}/src-tauri/capabilities/default.json`);
  assert.ok(caps.includes("updater:default"));
  const settings = read(`${DESK}/src/screens/Settings.tsx`);
  assert.ok(settings.includes('@tauri-apps/plugin-updater'), "check() flows through the plugin");
  assert.ok(settings.includes('data-testid="settings-check-update"') && settings.includes("Check for updates"), "About card button");
});

test("v015 · CI signs the build and composes the manifest", () => {
  const workflow = read(`${REPO}/.github/workflows/android-apk.yml`);
  assert.ok(workflow.includes("TAURI_SIGNING_PRIVATE_KEY"), "signing env reaches the bundler");
  const stampAt = workflow.indexOf("Stamp the desktop version");
  const testAt = workflow.indexOf("cargo test --locked");
  const buildAt = workflow.indexOf("Build installers");
  assert.ok(testAt !== -1 && stampAt !== -1, "both steps exist");
  assert.ok(testAt < stampAt && stampAt < buildAt, "tests run before the version is stamped, build signs after");
  assert.ok(workflow.includes("nucleus-${TAG}-linux-amd64.AppImage.sig"), "signatures ride along");
  assert.ok(workflow.includes("nucleus-${TAG}-windows-x64-setup.exe.sig"));
  assert.ok(workflow.includes("latest-json.js"), "manifest composer");
  const script = read(`${REPO}/.github/scripts/latest-json.js`);
  assert.ok(script.includes("linux-x86_64") && script.includes("windows-x86_64"), "both update targets");
});

// ---------- widgets: wallpaper colours ----------

test("v015 · Android widgets wear the wallpaper on 12+, paper elsewhere", () => {
  assert.ok(read(`${RES}/values/widget_colors.xml`).includes("#FFFBF2"), "light paper fallback");
  assert.ok(read(`${RES}/values-night/widget_colors.xml`).includes("#0B0D12"), "night fallback keeps the 0.12 look");
  const v31 = read(`${RES}/values-v31/widget_colors.xml`);
  assert.ok(v31.includes("@android:color/system_accent1_50") && v31.includes("@android:color/system_accent1_400"), "Material-You day palette");
  const n31 = read(`${RES}/values-night-v31/widget_colors.xml`);
  assert.ok(n31.includes("@android:color/system_accent1_900") && n31.includes("@android:color/system_accent1_300"), "Material-You night palette");
  for (const name of ["widget_card", "widget_attention", "widget_attention_fuel"]) {
    assert.ok(read(`${RES}/layout/${name}.xml`).includes("@color/widget_"), `${name} uses tokens`);
  }
  assert.ok(read(`${RES}/drawable/widget_bg.xml`).includes("@color/widget_bg"), "background token");
});

// ---------- small fixes from the audit ----------

test("v015 · the audit fixes all landed", () => {
  assert.ok(read("../../app/open.tsx").includes('"/cycle"'), "cycle widget opens the cycle module");
  const lock = read(`${DESK}/src/LockScreen.tsx`);
  assert.ok(lock.includes("readBackoff"), "backoff ticker keeps reading the store");
  const vehicles = read(`${DESK}/src/screens/Vehicles.tsx`);
  assert.ok(vehicles.includes("!Number.isFinite(odometer)"), "a fill needs litres, rate or an odometer");
  const palette = read(`${DESK}/src/components/CommandPalette.tsx`);
  assert.ok(palette.includes("n < 9 ?"), "no lying shortcut labels past Ctrl+9");
});
