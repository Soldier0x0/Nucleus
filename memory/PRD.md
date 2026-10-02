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

## Backlog
- P1: SQLite/SQLCipher migration, encrypted backups, Travel module, Home module, Rules builder + local notifications, CSV/ICS export, per-module lock, capture bar, timeline
- P2: Boards & profiles, Dev Tools, custom tool builder, declarative packs, widgets (native build), Phone Lab, Media, diagnostics, tablet layouts
