# Nucleus Design System

Version 1.0 — planning-phase draft (October 2026). Companion to `v012-v014-plan.md`.

Mockups live in `plan/design/*.html`, rendered shots in `plan/design/shots/`.
Shared tokens live in `plan/design/mockup.css`.

---

## 1. Palette — "Warm Paper"

**Recommendation (user to confirm from `shots/palette-options.png`): keep Warm Paper.**

| token          | light    | dark (warm charcoal) |
|----------------|----------|----------------------|
| `--bg`         | #f6f1e7  | #171412              |
| `--bg-soft`    | #efe7db  | #1e1a16              |
| `--card`       | #fffdf8  | #241f1a              |
| `--ink`        | #262019  | #f1e9dd              |
| `--muted`      | #6d6154  | #a89a89              |
| `--faint`      | #9b8f7f  | #6e6255              |
| `--border`     | #e7dfd0  | #2e2822              |
| `--accent`     | #c98f37  | #c98f37              |
| `--accent-strong` | #b57a26 | #d9a43a            |
| `--accent-soft`| rgba(201,143,55,.14) | rgba(201,143,55,.16) |
| `--good`       | #3e8e58  | #4c9a67              |
| `--good-soft`  | rgba(62,142,88,.12) | rgba(76,154,103,.14) |
| `--warn`       | #d29a2b  | #d9a43a              |
| `--warn-soft`  | rgba(210,154,43,.14) | rgba(217,164,58,.15) |
| `--bad`        | #c05c50  | #d06a5d              |
| `--bad-soft`   | rgba(192,92,80,.12) | rgba(208,106,93,.15) |

Runner-up palettes (user decides, see `shots/palette-options.png`):
- **Graphite & Amber** — cool grays (#f1f2f4 / #fff / #1b1d21), Linear/Arc vibe, same amber.
- **Clay & Sand** — terracotta accent (#c05f3c) on sand (#f6efe6), earthiest.

## 2. Type & numerics
- `Inter` for UI (fallback system-ui); native `monospace` for hash/SQL/Dev Lab only.
- `[tabular-nums]` on every money/odometer/time figure (class `.num`).
- H1 24/800 desktop, 20/800 phone; tile numerals 26–32/800 with -0.02em tracking.

## 3. Shape, elevation, motion (bento rules from research)
- Radius scale: 10 (chips/buttons) · 14 (tiles/cards small) · 20+ (big bento tiles).
- Flat surfaces: at most one shadow level (0 18px 40px -22px); prefer background/border.
- One accent per screen max; accents unify money + "attention" semantics.
- Motion: 150–300ms ease-out, no bounce; hover scale 1.02 (max) with shadow rise.
- Size encodes importance (bento asymmetry with intent), generous gaps (14–18px),
  never three equal columns of filler.
- z-index contract: base < nav < overlay < modal < toast.

## 4. Bento grid (desktop), token values
- Sidebar 240–260px; content gap 14px; bento rows `minmax(118px, 1fr)`.
- Standard tile spans on 12-col: KPI row 3×4; Attention card span-7-rows-2; a column span-5
  "pick up where you left off"; bottom 4/4/4.
- Every bento tile is actionable; none is pure chrome.

## 5. Phone IA (v0.12) — reference `shots/phone-nav.png`
- 4 tabs: **Favorites · Today · Attention · Settings**. Cold start = Favorites.
- Warm resume keeps the last screen (ReopenOnce machinery deleted).
- Drawer (open by tapping the hamburger — never edge-swipe; close via drag-right/
  tap-outside/Back): grouped board with 9 module groups, dots, profile on top.
- Collections inside Today: sections with count badges; bulk bar at bottom appears
  when >1 selected.
- No toasts anywhere. Silent failure states live in the sync pill only.

## 6. Attention (desktop) — reference `shots/desktop-attention.png`
- Sections by severity: Overdue · Due soon · Upcoming (dot-coded red/amber/green).
- Right rail: Your week (7-column dot strip), Snoozed, "Physically done" explainer.
- Bulk bar floats bottom-center when ≥1 checked: Mark paid · Snooze · Delete.
- Segmented Open / Done & history.

## 7. Money (desktop) — reference `shots/desktop-money.png`
- KPI bento row (Spent · Earned · Top category · Safe to spend) above the table.
- Filter chips row (This month / category / method) + inline search.
- Table: DATE DESCRIPTION CATEGORY METHOD AMOUNT; fuel rows carry a sub-line
  ("· Activa · 2.21 L · partial"); category color chips; income rows green `+`.
- Footer "11 of 214 entries · View everything >".

## 8. Bento Today (desktop) — reference `shots/desktop-light.png`
Tiles: Weather · Spent (mini 7-bar spark) · Fuel cycle · Service countdown ·
Attention (span-7) · "Pick up where you left off" (span-5) · Recent documents ·
Upcoming bills · With your phone (sync card, Sync now ghost button).

## 9. Palette / theme choice (first-run)
Desktop first-launch = **follow system and ask the user to choose** (Light / Dark / System),
remembered per machine. The three candidates remain the only sanctioned surfaces
until user picks (then tokens are single-sourced).
(shots: `desktop-palette.png` shows the Ctrl+K overlay; `palette-options.png` the candidates.)

## 10. Android widgets (v0.12) — reference `shots/android-widgets.png`
- Library: **react-native-android-widget 0.22.1** (JSX-driven; Expo config plugin).
- expo-widgets is iOS-only alpha (WidgetKit, @expo/ui, Expo blog Mar 2026) — not our path;
  GlanceKit/glance-widget too experimental. Avoid.
- Delivered: 2×2 Attention · 4×2 Attention+Fuel. Layouts follow `android-widgets.html`.
- Light/dark follow system. Material-You dynamic color = follow-up (not v0.12).
- Tap targets ≥ 32dp; tapping opens the matching screen deep-link.
- Glance rules: render on wall-clock ticks, no heavy work, cold-start budget <50ms.

## 11. Dev Lab (desktop, v0.14) — reference p. 12 of plan doc
- Universal (JSON/Base64/JWT/regex/diff/UUID/timestamps/hashes/color/counts) + desktop-native:
  file hasher + QR generator, data inspector, sync console (batches, envelope inspector,
  retry, port/mDNS), conflict viewer, error console + live log tail, keys/pairing panel,
  migrations/schema viewer, sample-data generator, feature flags, redacted diagnostics bundle.
- **SQL box, three layers**: (1) named template queries (Category speeds, Jar misses,
  fuel calculator open cycles), (2) visual query builder (friendly field names, generates SQL
  live, runnable), (3) true read-only SQL (SELECT-only enforced, row cap 500).
- Hidden behind a developer toggle; time machine too (requires user's thumbs-up to ideas).

## 12. Sync pill reference `shots/phone-nav.png` strip
green Synced · 2m — amber Off network · 3h — red Not synced · 26h.
Only when paired. No toasts in any state (locked decision).

## 13. Sources / reference apps
- Shape-of-work inspiration: **Apple** (primary), Linear, Arc, Amie; user's own: Wintoys, Zen.
- Widgets: Google Pay/Paytm sizes for trustworthy Glance layouts.
- Bento: DESIGN.md brief (see research summary — the next app should feel inevitable).
