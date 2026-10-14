# Tessera — PRD

## Original problem statement
A highly modular, local-first personal utility platform for Android: fully offline, no account, no cloud, no AI. Users assemble modules (vehicles, money, tools, travel, home…) that link together; deterministic "intelligence" (rules, statistics, trends, anomalies) with explainability; visual-first information design; strong security & privacy; resource efficiency. Deliver a critique, refined vision, architecture, security model, performance strategy and roadmap, plus an MVP.

## Approved plan (user)
Product name **Tessera**. MVP = Today, Attention Center with "Why?", Vehicles, Money + subscriptions, cross-module links, grouped search, 5 quick tools, module library, theme/accent/density/defaults, PIN/biometric lock, privacy mode, backup export/restore, design document. Phase 2/3 roadmap per plan.

## Architecture (MVP)
- Expo SDK 57 / expo-router. All data on-device (AsyncStorage JSON document `tessera.db.v1`); PIN hash in SecureStore (Keystore-backed). Backend is a stub health endpoint only.
- `src/core`: types, store (debounced persistence), actions + event reactors (fuel.added / service.added / subscription.paid / entity.deleted), intelligence (service interval learner, mileage, budgets, trends, anomalies, attention ranking with Why), search (grouped + relationship summaries), modules registry, backup, security, sample data.
- `src/components`: design system (ui, charts via react-native-svg, Sheet, Toast, inputs w/ attached units + calendar sheet, WhySheet, LinkedSection, PinPad, LockGate, module forms, tools).
- Routes: onboarding, (tabs) Today/Modules/Attention/Settings, search, vehicles, vehicles/[id], money, tools, record/[kind]/[id].
- Design docs: `/app/docs/TESSERA_DESIGN.md`, `/app/docs/TESSERA_DESIGN_PART2.md`.

## Implemented (2026-06)
- Onboarding (units, modules, PIN, sample data) · Today tiles (attention, budget ring, service gauge, renewals, tools) · Attention (Urgent/Upcoming/Info, Why, done/snooze/dismiss/restore; subscription "Paid" logs payment)
- Vehicles: add/edit/delete, default vehicle, fuel log with auto-calc, adaptive service form, learned interval + Why, insurance/PUC countdowns, mileage chart, service timeline
- Money: overview ring/category bars/6-month bars/insights, activity w/ filters, subscriptions, numpad quick entry, budgets
- Links: auto-linked expenses, Linked section on every record; grouped search
- Tools: Units, GST/%/discount/change, Tip & split, Dates, EMI (send to Money)
- Settings: theme/accent/density, defaults, auto-link toggle, PIN lock + biometric + timeout, privacy mode, screenshot block, export/restore, sample data, erase
- Tested: iteration_1 passed core flows; PIN pad fast-typing fix applied after.

## v2 — Nucleus (2026-06, session 2)
➡️ Detailed, ordered implementation plan for the remaining v2 features: `/app/memory/NEXT_STEPS.md`
Approved plan: "Nucleus v2" full platform. Implemented this session:
- Rename Tessera → Nucleus everywhere (app.json name/slug/scheme, com.nucleus.app); v1 storage + PIN migrate automatically
- Themes Midnight (default)/AMOLED/Graphite/Dune/Paper/System × 6 accents (onboarding + settings)
- Online switch (Today header + Settings, off by default), network log, home-city weather (Open-Meteo, AQI, sunrise/sunset), live FX rates (Frankfurter), holidays (Nager.Date), country facts (REST Countries), offline cache
- Travel module: trips, readiness ring + Why, packing templates/reuse/category bars, day itinerary timeline, documents with expiry, multi-currency trip expenses (linked to Money), destination weather/holidays/facts
- Home module: appliances (room, brand, model, serial, price, warranty), warranty countdowns, maintenance plans w/ 90-day timeline, "Done" logs cost → Money; room filter
- Attention: trip readiness, trip-doc expiry, warranty, maintenance rules
- Capture bar on Today (expense / income / fuel / subscription grammar with preview)
- Today tiles: weather, next trip, home maintenance; sample data includes trip + appliances
- Design docs renamed to /app/docs/NUCLEUS_DESIGN*.md

NOT yet built from v2 plan (carry over): Boards (custom dashboards), Notes & Lists, Media shelf, Money expansion (sinking funds, net worth, debts, multi-currency general, month-end projection), new Tools (cooking, time, growth, randomizer, wheels), Dev Tools, Custom Tool Builder, Rules + phone reminders + quiet hours, Phone Lab, multiple profiles + decoy PIN, unlock-method choice + PIN back-off, per-module lock, encryption at rest, clipboard auto-clear, encrypted backups + merge restore, CSV/ICS export, Year in Review, Timeline, Diagnostics, utilities/chores/room view in Home, road-trip calculator, high-contrast/large-touch/reduced-motion settings.

## Backlog
- P1: SQLite/SQLCipher migration, encrypted backups, Travel module, Home module, Rules builder + local notifications, CSV/ICS export, per-module lock, capture bar, timeline
- P2: Boards & profiles, Dev Tools, custom tool builder, declarative packs, widgets (native build), Phone Lab, Media, diagnostics, tablet layouts
- Session 3 (14 Oct 2026):
  - PR #36 merged (97baa32), so v0.9.7 publishes from main.
  - Draft PR #37 (feat/v098):
    - 9519f90: sync-safe records
    - 0669b3d: Run self-check
    - 310550b: plan renumbered to v0.9.8 with Q1–Q12 locked
    - 130f015: desktop/ Tauri groundwork + Desktop workflow (artifacts only)
    - 92a69f6: blocks storage permissions to remove the Expo max-SDK warning
  - Tests 252/252, testing agent passed (iteration_5).
  - No ## v0.9.8 heading yet.
