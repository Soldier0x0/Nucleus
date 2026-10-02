# Tessera — Product & Architecture Design Document (Part 2 of 2)

Technical architecture, local intelligence, security, performance, roadmap and extensibility.

---

## E. Technical architecture (target: Android-native)

### E.1 Technology choices

| Concern | Choice | Why |
|---|---|---|
| Language | Kotlin 2.x | Standard, coroutines, multiplatform-ready core. |
| UI | Jetpack Compose + Material 3 *foundation* (custom design system on top) | Declarative UI fits the component/template engine. Adaptive layouts via `WindowSizeClass`. |
| Architecture | MVVM / UDF (ViewModel + immutable `UiState` + `StateFlow`) | The established pattern. No custom framework. |
| DI | Hilt (or Koin for lighter builds) | Scoped graphs per module and per profile. |
| Modularization | Gradle multi-module: `:core:*`, `:feature:*` with a `:feature-api` contract per module | Build isolation, enforced boundaries, lazy init. |
| Database | Room on **SQLite + SQLCipher** (one DB per profile), FTS5 for search | Mature, migrations, Flow queries, indexes. |
| Preferences | Proto DataStore | Typed, transactional. |
| Background | WorkManager (periodic ≥ 15 min, expedited for user actions), `AlarmManager.setExactAndAllowWhileIdle` only for user-set reminders | Battery-friendly and Doze-aware. |
| Widgets | Jetpack **Glance** | Compose-like widgets, `updateAll` on events. |
| Crypto | Android Keystore (StrongBox when available) + Tink (AEAD, streaming AEAD for backups) | Hardware-backed keys, audited primitives. |
| Auth | `BiometricPrompt` (Class 3) with `CryptoObject` | Biometric actually unwraps keys, not just a UI gate. |
| Serialization | kotlinx.serialization | Backup/export, pack manifests. |
| Charts | Custom Compose `Canvas` primitives (ring, gauge, line, bars, timeline) | Small, themeable, fast; avoids heavy chart libs. |

*MVP mapping:* the MVP is Expo/React Native with the same shape: typed collections (`src/core/types.ts`), a document store persisted locally (`store.tsx`), pure actions + event reactors (`actions.ts`), a module registry (`modules.ts`), an intelligence engine (`intelligence.ts`), search (`search.ts`), SVG chart primitives (`charts.tsx`), SecureStore (Keystore-backed) for the PIN hash, `expo-local-authentication`, `expo-screen-capture` (FLAG_SECURE). The architecture below is the migration target when data volume or native-only features (Glance widgets, SQLCipher, sensors) demand it.

### E.2 Layered structure

```
┌──────────────────────── App shell ────────────────────────┐
│ Navigation · Lock gate · Theme · Today board · Search UI  │
├───────────────────── Feature modules ─────────────────────┤
│ vehicles · money · tools · travel · home · media · lab …  │
│  each: data (DAO, entities) · domain (use cases) · ui     │
│  exposes: ModuleDescriptor (feature-api)                  │
├────────────────────── Platform core ──────────────────────┤
│ registry · events · relations · rules · workflows ·       │
│ intelligence · attention · search · boards/widgets ·      │
│ capabilities · backup/io · profiles · security · diag     │
├──────────────────────── Foundation ───────────────────────┤
│ database (Room+SQLCipher) · crypto · scheduler · designsys│
└───────────────────────────────────────────────────────────┘
```
Feature modules depend on `core` APIs only, never on each other. Gradle enforces this.

### E.3 Module runtime & registry

Each module ships a `ModuleDescriptor`:
```kotlin
interface ModuleDescriptor {
  val id: ModuleId; val version: Int
  val entities: List<EntityType<*>>          // registers with relations/search/backup
  val events: EventSchema                    // emits / consumes
  val tiles: List<TileProvider>              // Today/Board tiles + widget sizes
  val attentionRules: List<AttentionRule>    // deterministic rules
  val capabilities: Set<Capability>          // required grants
  val migrations: List<Migration>
  fun routes(): NavGraphContribution
  suspend fun onActivate(ctx: ModuleContext) // lazy; called on first use
}
```
Descriptors are tiny and discovered at compile time (KSP-generated index) — **no reflection, no class loading of feature code until needed**.

Lifecycle: `Installed → Enabled → Activated (DAOs opened, reactors subscribed) → Active (UI on screen) → Suspended (UI gone; reactors still subscribed but idle) → Disabled (reactors unsubscribed, excluded from search/attention/tiles)`. A disabled module costs zero CPU and only its rows on disk. (MVP: disabling a module removes it from Today, search, Attention and reactors.)

### E.4 Data layer: typed tables + shared spine

Each module owns typed tables (`vehicle`, `fuel_entry`, `service_entry`, `txn`, `subscription`…). The **shared spine** is four tables:

```sql
entity_registry(uid TEXT PK, kind TEXT, module TEXT, title TEXT, zone INT, created_at, updated_at, deleted_at)
link(id PK, from_uid, to_uid, rel TEXT, created_at, UNIQUE(from_uid,to_uid,rel))   -- indexes on both ends
event_log(seq INTEGER PK, type TEXT, subject_uid, payload BLOB, at)               -- append-only, pruned
search_fts(uid, kind, title, body)  -- FTS5, contentless, updated in the same transaction
```
Rules: every typed row has a `uid` registered in `entity_registry` (same transaction). Soft-delete with tombstones for safe undo and for backups/merge. Money stored as `Long` minor units + ISO currency. Dates as epoch-day `Int`; timestamps UTC millis + zone id.

**Derived/aggregate tables** (incrementally maintained by reactors): `month_category_total(profile, ym, category, sum, count)`, `vehicle_stats(vehicle_uid, odometer, avg_kmpl, cost_per_km, last_service_odo, est_interval)`. Dashboards read these, never raw rows.

### E.5 Relationship layer

- Links are typed (`rel`: `expense`, `payment`, `attachment`, `part_of`, `warranty_for`, …) and directional, navigable both ways.
- **Implicit** relations (foreign keys like `fuel.vehicle_id`) are surfaced through the same API so the UI's *Linked* section is uniform (MVP does this in `linkedRefs`).
- "Show me everything related to Goa 2027" = bounded BFS (depth ≤ 2) over `link` + implicit edges, grouped by kind, with per-kind aggregators (sum amounts, count items, sum distance). MVP search already aggregates per vehicle ("12 fuel entries · ₹8,420 spent · service in ~450 km").

### E.6 Event bus

- In-process, typed, `SharedFlow`-based. Events are **facts** in past tense (`fuel.added`, `service.added`, `subscription.paid`, `entity.deleted`).
- Delivery: synchronous reactors run **inside the write transaction** (to keep aggregates consistent); asynchronous subscribers (widgets, notifications) run after commit.
- Every event is appended to `event_log` (pruned to 180 days / 50k rows) — this powers rule dry-runs, diagnostics and the Timeline.
- Device events (`battery.low`, `charging.started`) are produced only by explicit, registered system broadcast receivers (`ACTION_BATTERY_LOW`, `ACTION_POWER_CONNECTED`) — no polling.

MVP: `dispatch(db, events)` with a reactor table — `fuel.added → create linked expense`, `subscription.paid → create linked payment`, `entity.deleted → cascade links & auto-expenses`.

### E.7 Rule engine (When / If / Then)

```
Rule { id, enabled, trigger: Trigger, conditions: List<Condition>, actions: List<Action>, cooldown, quietHours }
Trigger   = EventTrigger(type, filter) | TimeTrigger(daily@HH:mm | relative to date field) | ThresholdTrigger(metric, op, value)
Condition = Compare(path, op, value) | Exists(path) | All/Any(list)   // over a typed context, no scripting
Action    = Notify(template, severity) | AddAttention(...) | CreateEntity(kind, fields) | Link(...) | OpenBoard(id) | SetField(...)
```
- Paths are resolved against a **typed context schema** published by modules (e.g., `trip.daysToStart`, `trip.packing.pct`). The builder only offers valid paths → no runtime type errors.
- Evaluation: event → candidate rules by index on trigger type → conditions → actions. Max chain depth 4; per-rule idempotency key `(ruleId, subjectUid, period)`; cycle detection when saving (actions that emit events which trigger the same rule).
- Time triggers are compiled into the *next* fire instant and scheduled as a single WorkManager job (the "next due" job), not a timer per rule.

### E.8 Workflow engine

Workflows are ordered action lists that pass a typed payload between steps ("Recipe → Shopping list": map ingredients → checklist items). Implemented as composable `Action<I,O>` functions registered by modules (contracts in `feature-api`). In the MVP this appears as "Send to module" buttons (EMI → recurring subscription; GST/Split → expense).

### E.9 Attention system

`AttentionRule`s are pure functions `(ModuleState, today) -> List<AttentionItem>` contributed by modules; the core merges, ranks, filters by user marks (done/snoozed/dismissed keyed by **occurrence**: `insurance:<vehicle>:<expiryDate>` so a renewed policy re-alerts next year) and projects to notifications. Implemented in MVP (`intelligence.ts`).

### E.10 Search & indexing

- FTS5 table updated in the same transaction as the write (no background re-index). Tokenizer: `unicode61 remove_diacritics 2` + prefix indexes for type-ahead.
- Query pipeline: parse → FTS candidates (limit 200) → group by kind → per-group aggregate (relationship summary) → rank (exact title > prefix > body; recent > old; enabled modules only).
- Modules and tools are indexed as static entries, so "gst" finds the GST tool.

### E.11 UI engine

A design-system library (`:core:designsystem`) with primitives: Text roles, Card, Button, Chip/ChipRow, Segmented, Field-with-unit, DatePicker sheet, NumberPad, Ring, Gauge, LineChart, MonthBars, Bar, Countdown, Timeline, StatusBadge, WhySheet, LinkedSection, EmptyState. Five **layout templates**: *Tool* (inputs → result → actions), *Dashboard* (tiles), *Record* (fields + linked), *List* (filters + rows), *Timeline*. Declarative packs pick a template and bind fields; they cannot draw arbitrary UI.

### E.12 Boards (dashboards) & widgets

- A Board is `List<TilePlacement(tileId, size: S|M|L, config)>` on a 4-column grid (phone: 2 cols, tablet: 4–6). Drag to reorder, tap to resize (3 sizes) — free-form resizing is not worth its complexity.
- Tiles declare the aggregates they read. The board subscribes to *those* aggregate flows only; a tile recomposes only when its aggregate changes.
- **Widgets** (Glance) reuse tile providers with the same S/M/L sizes. Updated via `GlanceAppWidget.update` from the post-commit event subscriber; plus one `updatePeriodMillis` ≥ 30 min for date-relative text ("in 3 days"). Widgets of Zone ≥ 1 data show redacted values when the device is locked (configurable).

### E.13 Plugin / pack system (declarative, capability-scoped)

```yaml
pack: com.example.electricity
version: 1
requires: { core: ">=2.0" }
capabilities: [ "money.txn.create" ]          # shown to user, granted individually
entities:
  - id: meter_reading
    fields: { date: date, units: number(kWh), note: text? }
tools:
  - id: bill
    template: tool
    inputs: { units: number(kWh), rate: money/kWh, fixed: money }
    output: { bill: money = "units * rate + fixed" }
    actions: [ { send: money.txn.create, map: { amount: bill, category: "Electricity" } } ]
attention:
  - when: "daysSince(last(meter_reading).date) > 35"
    severity: info
    title: "Read your electricity meter"
```
- Formulas use a tiny, total expression language (arithmetic, comparison, `min/max/round/if`, aggregates over the pack's own entities). No loops, no I/O, guaranteed termination, evaluated by the core.
- A pack can only read/write its own entities plus explicitly granted capabilities (`money.txn.create` ≠ `money.txn.read`). The capability broker checks every call.
- Packs are signed (Ed25519); unsigned packs are allowed but labelled "Unverified" and require an extra confirmation.
- Executable extensions (Phase 4, if ever): separate APKs, bound service + custom signature-level permission + the same capability broker. Never `DexClassLoader` into the core.

### E.14 Capability / permission system

Two layers: **Android runtime permissions** (requested contextually: camera when scanning, mic for pitch, etc.; never at launch) and **Tessera capabilities** (internal grants between modules/packs and data). Grants are stored per profile, revocable in Settings → Capabilities, and every use is logged to the event log ("Electricity pack created 1 expense").

### E.15 Profiles

One SQLCipher database **per profile** with its own data key. Profile switch closes the DB and DI scope and opens another — strong isolation, simple reasoning. Profile metadata (name, colour, lock policy) lives in a small unencrypted index DB. Each profile can have its own modules, boards, theme and notification policy.

### E.16 Backup / restore / import / export

**Backup format** `tessera-backup-YYYY-MM-DD.tess` = ZIP:
```
manifest.json          {format, app_version, created_at, profiles:[…], modules:{id:schemaVersion}, counts, sha256 per file}
profiles/<id>/data.jsonl.zst     one line per row: {kind, uid, v, fields}
profiles/<id>/links.jsonl.zst
profiles/<id>/boards.json, settings.json, packs/
attachments/<sha256>             content-addressed, deduplicated
```
Encrypted variant: the whole ZIP is wrapped with Tink streaming AEAD; key = Argon2id(passphrase, salt, m=64MB,t=3) → AES-256-GCM-HKDF. Restore shows a preview (counts, date, modules), runs per-module migrations, and supports **Replace** or **Merge** (merge by uid with last-writer-wins on `updated_at`, tombstones respected).

Exports: per record/module/board → JSON, CSV (one file per entity kind), Markdown (notes/wiki), ICS (renewals, expiries, itineraries), PDF (via Android print framework, user-initiated). Imports: CSV with a column-mapping sheet and dry-run preview; ICS; Tessera packs.

MVP: single JSON backup with format tag, counts preview and replace-restore; PIN never exported.

### E.17 Diagnostics (self-monitoring)

`Settings → Diagnostics`: DB size per profile & per table, row counts, aggregate freshness, event-log size, active modules and their lifecycle state, scheduled jobs (WorkManager `getWorkInfos`), active sensor sessions, cache size, recent errors (local ring buffer, scrubbed), estimated wake-ups/day. Exportable as a scrubbed text report the user can choose to share.

---

## F. Local intelligence system

### F.1 Components and how they talk

```
 write ─► Event bus ─► Reactors ─► Aggregates (stats tables)
                        │                    │
                        ▼                    ▼
                 Event log ◄──────── Statistics engine ──► Forecast / Anomaly / Interval learners
                        │                                      │
                        ▼                                      ▼
                 Rules engine ──► Actions        Attention rules (per module) ──► Prioritizer ──► Attention / Notifications / Tiles
                        ▲                                      ▲
                 Context engine (date, profile, device state, upcoming entities)
```
All components are pure functions over local data except the scheduler. Every output carries a `Why { summary, facts[], rule, ranking }` — implemented in MVP.

### F.2 Techniques (and when each is allowed)

| Need | Method | Minimum data | Explanation shown |
|---|---|---|---|
| Typical interval (service, refill, purchase) | Mean of gaps; median shown alongside; outliers beyond 1.5×IQR excluded (with note) | 3 events (2 gaps) | List of gaps, mean, median |
| Trend | Last N complete periods strictly increasing/decreasing, or Theil–Sen slope with sign test | 4 periods | Period values + direction |
| Anomaly | Current vs mean of prior k periods (ratio ≥ 1.3 and absolute delta floor) or robust z-score (MAD) ≥ 3 | 3 periods | Prior values, average, deviation |
| Forecast (bills, fuel spend) | Seasonal-naïve or 3-period moving average; band = min/max residual | 3–12 periods | Method, inputs, band |
| Budget run-rate | Spent / elapsed fraction of month → projected month-end | current month | Spent, % month elapsed, projection |
| Mileage | Distance between fills / litres at fill (full-tank method) | 2 fills | Odometer deltas and litres |
| Cost of ownership | Σ linked expenses / distance or / months | any | Linked expense list |
| Readiness | Weighted checklist (documents, packing, budget) | entity config | Items done/total per section |
| Smart defaults | Last value / mode of last 10 / frequency ordering | 1 | "Last used" label |
| Reuse suggestion | Same-kind entity with highest Jaccard tag/category similarity, or most recent | 1 | "Based on Goa 2025 (same tags)" |

Rules for honesty: if the minimum data is not met, show **what's needed**, not a guess (MVP: "Log 2 more services and Tessera will learn your real interval").

### F.3 Prioritization

Deterministic score = `severityWeight (urgent 300 / upcoming 200 / info 100) + urgency (bounded by days or distance remaining) + user weight (pinned modules +20)`. Severity always dominates (a 200-band item can never outrank a 300-band item). The ranking rationale is printed in Why? (MVP).

### F.4 Context engine

A cached `Context` snapshot: today, time-of-day bucket, active profile/board, charging/battery bucket (from broadcasts), upcoming entities within 14 days, last-opened module. Used by Today to order tiles *only if the user enables "Adaptive Today"* (e.g., Travel tile floats to top when a trip starts in ≤ 3 days), always with a "why is this here?" affordance.

---

## G. Security model

### G.1 Threat model

| Adversary | Capability | Mitigations |
|---|---|---|
| Casual physical access (friend, family, shoulder-surfing) | Unlocked phone in hand | App lock (PIN + Class-3 biometric), per-module locks (Phase 2), privacy mode masking, re-lock timeout, recents hiding. |
| Lost/stolen locked device | Offline disk access, no screen unlock | Android FBE + SQLCipher DB keyed by Keystore-wrapped key; key requires user auth for Zone ≥ 2. |
| Malicious app on device | Normal permissions, IPC probing | No exported components except launcher/widgets; FileProvider for shares only; signature-level permission for companion APK; no world-readable files; `allowBackup=false` / data-extraction rules exclude DB. |
| Backup file leak (cloud drive, email) | Full copy of backup | Encrypted backups (Argon2id + AEAD); unencrypted export requires explicit confirmation and warning (MVP warns). |
| Screen capture / screen-sharing apps | Screenshots, overlays | FLAG_SECURE (configurable; on by default for Zone ≥ 1 screens), `setRecentsScreenshotEnabled(false)`, hide sensitive content in `onPause` (MVP). |
| Malicious pack | Declarative content | No code execution; capability broker; signed packs; per-capability consent; audit log. |
| Developer / supply chain | Library telemetry | No INTERNET permission in core → libraries physically cannot phone home; dependency allowlist; reproducible builds. |

Out of scope: rooted devices with live memory inspection, nation-state forensics.

### G.2 Data zones

| Zone | Examples | Protection |
|---|---|---|
| 0 Normal | Tools history, media shelf | DB encryption at rest only. |
| 1 Private | Vehicles, trips, home | + app lock, notification redaction. |
| 2 Sensitive | Money, documents, net worth | + optional module lock, FLAG_SECURE, masked values by default in widgets, clipboard auto-clear, field-level AEAD for document numbers. |
| 3 Secret | Passwords/secrets vault (future) | + separate key requiring biometric `CryptoObject` per unlock, no widgets, no search indexing of values, no notifications. |

### G.3 Keys

```
KEK_profile  (Android Keystore, AES-256, StrongBox if present, non-exportable,
              setUserAuthenticationRequired for Zone≥2 with 0–300 s validity)
   └─ wraps DEK_db (random 256-bit) → SQLCipher key
   └─ wraps DEK_zone3 (auth-per-use) → field-level AEAD
PIN → Argon2id → unwrap path when biometrics unavailable (PIN-derived key also wraps DEK_db)
```
PIN attempts: exponential back-off after 5 failures; optional wipe after 15 (off by default). There is **no recovery** by design; restore from backup is the recovery path (MVP explains this in "Forgot PIN?").

MVP: PIN stored as salted, iterated SHA-256 in SecureStore (Keystore-backed on Android); biometric via `expo-local-authentication`. Moving to Argon2id + DB encryption is a Phase 2 task.

### G.4 Other surfaces

- **Clipboard:** mark sensitive (`ClipDescription.EXTRA_IS_SENSITIVE`), auto-clear 60 s for Zone ≥ 2.
- **Notifications:** `VISIBILITY_PRIVATE` with public redacted version ("Money: 1 item needs attention").
- **Files:** attachments imported via SAF/photo picker into app-private storage; shares through `FileProvider` with temporary URI grants; temp files deleted on completion.
- **Crash logs:** local only, PII-scrubbed (no field values, only stack + module id), user-initiated export.
- **Debug builds:** separate applicationId; release builds strip logging (`-assumenosideeffects` for `Log`), no StrictMode leaks.
- **Optional network (Tessera Link APK):** currency rates, map tiles. Separate APK with INTERNET, receives *requests* from core containing only what's needed (currency codes), never user data. Each request logged in core.

---

## H. Performance & battery

- **Startup** (target < 400 ms cold to first frame on mid-range): App Startup library only initializes DB *opening* (not queries), theme and lock state. Feature modules are not initialized. Today reads ≤ 6 aggregate rows. Baseline Profiles shipped.
- **Lazy loading:** module DAOs/ViewModels created on first navigation; reactors registered for enabled modules only (cheap closures); heavy modules (Phone Lab, charts with >1k points) in dynamic feature modules if APK size matters.
- **Memory:** paging (Paging 3) for every list > 100 rows; no full-table loads; images via Coil with size-bounded caches; charts downsample to ≤ 200 points (LTTB).
- **Database:** WAL mode; indexes on `(vehicle_id, odometer)`, `(date)`, `(category, date)`, link ends; `ANALYZE` after migrations; incremental aggregates updated in-transaction; monthly `VACUUM` via WorkManager when charging + idle.
- **Incremental recomputation:** each aggregate has an update function `apply(event)`; full rebuild only on restore/migration (background, with progress).
- **Background work:** one "next-due" job (earliest of all scheduled rule/attention instants) + one daily maintenance job (charging/idle constraint). No foreground services except explicit sensor/recording sessions (with notification and Stop).
- **Sensors:** registered only while a session screen is visible or a recording session is active; `SENSOR_DELAY_UI` default; batch mode (`maxReportLatencyUs`) for recordings; auto-stop after user-set duration.
- **Widgets:** event-pushed updates; no `updatePeriodMillis` < 30 min; widgets read aggregates, never raw tables.
- **Search:** FTS updates in-write; queries limited and debounced 120 ms.
- **Large data:** event log pruned; attachments content-addressed with storage quota warnings; years of data (e.g., 50k transactions) remain fast because UI reads aggregates + paged queries.
- MVP note: the MVP stores a single JSON document (fine for thousands of records); migrating to SQLite is the Phase 2 data task before Travel/Home multiply volume.

---

## J. Roadmap

| Phase | Scope | Platform work it forces |
|---|---|---|
| **1 · MVP (built)** | Today, Attention + Why, Vehicles, Money + Subscriptions, Quick Tools (5), module library, Today layout, links, grouped search, lock/biometric/privacy, backup/restore, sample data | Registry, event reactors, links, attention rules, why-model, design system |
| **2 · Broaden** | SQLite/SQLCipher migration · Travel (trips, packing templates, itinerary timeline, trip expenses, readiness) · Home (appliances, warranties, maintenance plans, utilities) · Rules builder + local notifications · Boards & profiles · Encrypted backups, CSV/ICS · Dev Tools · per-module lock · Capture bar · Timeline | Recurring/Expiring/Maintenance/Checklist primitives, rule engine, scheduler, notification projection |
| **3 · Advanced** | Custom tool builder · Declarative packs + capability broker · Widgets & shortcuts (native build) · Phone Lab · Media · Diagnostics · Tablet/landscape layouts · Data health · Year in review | Expression language, pack loader/signing, Glance widgets, sensor sessions |
| **4 · Ecosystem** | Pack sharing (file/QR), Tessera Link companion APK (rates, maps), merge-restore across devices (manual sync via file), optional on-device OCR module | IPC contracts, merge semantics |

Dependency order: data spine → events → links → attention → (rules ← scheduler) → boards/widgets → packs.

---

## K. Extensibility: building "XYZ Module"

A developer creates `:feature:xyz` and implements `ModuleDescriptor`. By declaring:
- `entities` → automatically gets storage registration, uid, soft-delete, **search indexing** (via `title/body` projections), **Linked** section, **backup/export** (JSONL + CSV via serializers), and the generic **Record** screen.
- `events` → its events appear in the **rule builder** trigger list and the **Timeline**.
- `attentionRules` → items show in **Attention**, notifications and the Attention tile, with **Why?**.
- `tiles` → available in **Boards** and as **widgets** in S/M/L.
- `capabilities` → shown in **Settings → Capabilities**, enforced by the broker.
- `migrations` → run on upgrade and on restore.
- Theming, density, accessibility and privacy masking come free from the design-system components.

In the MVP this contract is visible in miniature: adding a module = add a manifest to `modules.ts`, an entity kind to `types.ts`, reactors in `actions.ts`, attention rules in `intelligence.ts`, a search block in `search.ts`, and a screen; Record detail, Linked, Why?, backup and module toggling work without further changes.

---

## Appendix: MVP assumptions recap
INR/km/L/°C/12h defaults (changeable) · single profile · single currency · manual entry only · in-app reminders only (no push) · unencrypted JSON backup with warning · PIN-only recovery via erase + restore · English only · screenshot blocking and recents hiding effective only in installed builds.
