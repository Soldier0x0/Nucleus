# Tessera — Product & Architecture Design Document (Part 1 of 2)

> A local-first personal platform. Your data, your tiles, your rules. No cloud, no account, no AI.

This document answers §49 of the brief (A–K). Part 1 covers critique, new ideas, identity, information architecture, UX and the per-module visual design. Part 2 (`TESSERA_DESIGN_PART2.md`) covers technical architecture, intelligence, security, performance, roadmap and extensibility.

The MVP in this repository is a working Expo/React Native implementation of the core of this design (Today, Attention + Why, Vehicles, Money, Quick Tools, module library, links, search, lock, privacy, backup). Where the document describes the *target* Android-native architecture, it says so explicitly and maps the MVP's equivalents.

---

## A. Challenging the concept

### A.1 The central risk: "a platform" instead of "a product"

The brief describes a platform (modules, plugins, workflows, profiles, dashboards, widgets, themes, rules) *and* ~120 features. History is unkind to this shape: the platform consumes all engineering time, the features stay shallow, and the user experiences a configuration tool rather than something useful on day one.

**Decision:** Tessera is a *product with a platform inside*, never the reverse. Every platform capability must be justified by at least two first-party modules that need it **before** it is generalized. Example: the relationship layer exists in the MVP because Vehicles→Money already needs it; the generic plugin runtime does not exist yet because no first-party module needs it.

### A.2 Contradictions in the brief

| Tension | Resolution |
|---|---|
| "Highly customizable" vs "simple by default" | Customization is *layered*: (1) sensible defaults, (2) toggles/reorder in place, (3) visual editors, (4) declarative packs. 95% of users never pass layer 2. Nothing in layer 3–4 is required to get value. |
| "Visually rich" vs "resource-efficient" | Visuals are vector, static and computed from cached aggregates. No continuous animation loops, no live re-computation on scroll. Charts render from pre-aggregated monthly buckets, never raw rows. |
| "No INTERNET permission" vs "optional network modules" | The core APK declares no INTERNET permission. Network features ship as a *separate companion APK* ("Tessera Link") talking over a signed, permission-protected bound service. Android permissions are per-APK, so this is the only honest way to guarantee the core cannot exfiltrate. |
| "Plugins" vs "security" | No executable third-party code in-process, ever. Plugins are declarative packs interpreted by the core (see Part 2 §E.13). |
| "Intelligent" vs "explainable" | Only use techniques whose output can be explained in one sentence plus a table of the data used. That rules out opaque models and rules *in* medians, moving averages, simple regression, thresholds, z-scores, and explicit rule chains. |
| "Profiles" vs "relationships across everything" | Profiles are hard isolation boundaries (separate databases). Cross-profile relations are not allowed. If users want shared data, they share via export/import, explicitly. |
| "Widgets everywhere" vs "battery" | Widgets are *push-updated* when the underlying aggregate changes (event-driven), never on a timer below 30 minutes. |

### A.3 Things to remove or demote

- **Network discovery, port checking, Wi-Fi analyzer (core).** Android 10–14 progressively restricted SSID/BSSID/scan results behind fine location; port scanning needs INTERNET. These move to the optional companion APK or are cut. Ping/DNS cannot be done without INTERNET either.
- **Camera tester, speaker tester, microphone tester as separate tools.** Merge into one "Phone Lab · Check-up" flow — a guided, 2-minute test sequence with a single result card. Nobody wants 6 separate test tools.
- **Decision Wheel + Randomizer as separate modules.** Merge into **Randomizer** with modes (wheel, dice, coin, cards, teams, weighted list).
- **Tip calculator as its own module.** It's a mode of **Bill Split**.
- **Percentage, GST, Markup, Margin, Profit, Discount** → one **Percent & Tax** tool with modes (done in MVP).
- **CAGR, SIP, compound interest, inflation, purchasing power** → one **Growth** tool with modes. EMI/amortization stays separate because it has a distinct output (schedule) and feeds Money.
- **Sound meter (approximate SPL).** Keep, but under Phone Lab with a mandatory "uncalibrated estimate" label and a calibration offset field. Never display "dB SPL" — display "dB (est.)".
- **"Indexed files".** Tessera should not index the user's file system. Attachments are *imported* (copied into the app's storage) via the Storage Access Framework. No broad storage permission. This removes a large security and performance surface.
- **Multiple themes as *named visual modes* ("Information-heavy", "Material-inspired", …).** These overlap and multiply QA. Replace with 3 orthogonal axes: **Theme** (light/dark/system/AMOLED), **Accent** (palette), **Density** (comfortable/dense) + accessibility toggles (large touch, high contrast, reduced motion). 4 × 6 × 2 is already 48 combinations to test.

### A.4 Things to merge

- **Utility tracking (Home) + Subscriptions (Money) + Recurring expenses (Money)** are the same concept: a **Recurring obligation** with an amount (fixed or metered), a cycle and an optional meter reading. One entity, three views.
- **Warranty (Home), Insurance/PUC (Vehicle), Passport/visa documents (Travel)** are the same concept: an **Expiring credential** attached to an entity. One entity type, one Attention rule, one countdown component.
- **Maintenance (Home) + Service (Vehicle)** share an engine: a **Maintenance plan** (interval in time and/or usage) + **Maintenance log**. Vehicles use odometer as the usage meter; a water purifier uses months; an AC uses months *or* run-hours.
- **Packing list, home chores, trip checklist, shopping list** are all **Checklists** with templates. One component, one storage shape, one "reuse previous" mechanism.

These merges are the single biggest complexity reduction in the document: four primitives (*Recurring*, *Expiring*, *Maintenance plan*, *Checklist*) power ~15 features in the brief.

### A.5 Things to separate

- **Finance "Net worth" vs "Expenses".** Net worth is a slow-moving, monthly snapshot activity; expenses are daily. Separate screens, separate cadences, and net worth is opt-in (it's the most sensitive data).
- **Rules engine vs Workflow engine.** Rules decide *whether* (deterministic predicate on state); workflows decide *what happens next* (actions with data passing). Keep them separate internally; present them in the UI as one "When / If / Then" builder.
- **Attention vs Notifications.** Attention is the in-app ranked list (pull). Notifications are a filtered, rate-limited projection of Attention (push). Users configure "which severities notify", never per-item.

### A.6 Architectural risks

1. **Generic entity tables (EAV) killing performance and type safety.** Mitigation: typed tables per module + a *thin* shared layer (entity registry, links, events, search index). See Part 2 §E.4.
2. **Event storms / feedback loops in rules.** Mitigation: rule execution is a bounded DAG per event with depth ≤ 4, idempotency keys, and cycle detection at rule-save time.
3. **Schema evolution across modules and backups.** Mitigation: every module owns versioned migrations; backups carry per-module schema versions; restore runs migrations forward.
4. **Over-abstracted UI engine.** Mitigation: the "UI engine" is a component library + a small set of *layout templates* (Tool, Dashboard, Record, List, Timeline). Declarative packs choose a template; they cannot invent layouts.

### A.7 UX risks

- **Empty-state desert.** A local-first app starts empty, so insights can't appear. Mitigation: (1) "Explore with sample data" (in MVP), (2) every insight states *what data it still needs* ("Log 2 more services and I'll learn your interval"), (3) quick-capture everywhere.
- **Module sprawl in navigation.** Mitigation: 4 fixed tabs; modules live in a library; *Today* is the only screen that grows, and it summarizes.
- **Customization paralysis.** Mitigation: never ask the user to customize up front. Onboarding asks only units, modules, lock.

### A.8 Security risks

- **Backups are the #1 leak vector.** Mitigation: encrypted backups by default from Phase 2 (Argon2id-derived key, AES-256-GCM). MVP warns explicitly.
- **Clipboard leakage** of amounts/secrets. Mitigation: sensitive copies marked `EXTRA_IS_SENSITIVE` (Android 13+) and auto-cleared after 60s.
- **Notification previews leaking finance data on lock screen.** Mitigation: `VISIBILITY_PRIVATE` with a redacted public version for Zone ≥ 1.

### A.9 Performance risks

- Dashboards that query raw rows on every render. Mitigation: materialized aggregates (`monthly_category_totals`, `vehicle_stats`) updated incrementally on write.
- Full-text search over everything. Mitigation: FTS5 with contentless tables, incremental updates on write, no background re-index.

### A.10 Scope risk

The roadmap (Part 2 §J) ships **3 modules** in the MVP, done properly, and grows by 2–3 per phase. "20 excellent modules" is the 3-year target, not the v1 target.

---

## B. New ideas not in the brief

1. **"Why?" as a first-class UI primitive.** Every derived number, suggestion and ranking has a tappable explanation sheet: summary sentence → data table → rule → ranking rationale. (Implemented in MVP.)
2. **"What data is missing" insights.** The system tells you what it *can't* conclude yet and what would unlock it. Turns emptiness into guidance.
3. **The Ledger of Self (Timeline).** A unified, chronological, cross-module timeline of everything you recorded. Filterable by entity/tag. It's the "raw data" layer of progressive disclosure and an excellent audit trail.
4. **Capture Bar.** A single quick-entry surface (long-press the Today tab or a widget) that parses a tiny deterministic grammar: `fuel 5.4L 560 26310` → Fuel entry; `450 food lunch` → Expense; `netflix 649 monthly` → Subscription. Grammar is fixed, documented and shown as you type. No AI.
5. **Readiness scores.** For any "upcoming event" entity (trip, service visit, renewal), a deterministic checklist-derived % (documents present, packing complete, budget set). Shown as a ring.
6. **Cost-of-ownership per entity.** Because every expense can link to an entity, Tessera can show *true cost* per vehicle, appliance, subscription, trip — "your Activa cost ₹2.31/km all-in over 14 months". This is a killer derived value the brief hinted at but didn't name.
7. **Projections with uncertainty bands.** Forecasts show a band (min/max of the method's residuals) instead of a single number. "Next electricity bill: ₹2,700–2,900".
8. **Rule dry-run.** Before saving a rule, show "Over the last 90 days this would have fired 4 times" using the event log. Prevents noisy automations.
9. **Data health.** A screen listing data-quality issues: odometer going backwards, duplicate transactions on the same day/amount, subscriptions with no payment for 2 cycles. Deterministic, actionable.
10. **Tessera "Packs".** Shareable declarative bundles (templates + custom tools + checklists + rules), e.g. "Indian two-wheeler owner pack", "Monsoon home pack". Signed, previewed, capability-scoped.
11. **Time-boxed sensor sessions.** Hardware tools always run as a *session* with a visible timer and a stop button; data saved as an artifact. No hidden sensor use ever.
12. **"Quiet hours" for Attention.** Rule-based suppression: no notifications 22:00–07:00 unless Urgent.
13. **Local "receipt" attachments with on-device OCR (optional, not AI-generative).** ML Kit text recognition is on-device; still, it's a model — it should be an opt-in, separate module, clearly labelled. Default: off. (Flagged as a deliberate exception to discuss, not assumed.)
14. **Emergency card.** A Zone-0 lock-screen-safe card (blood group, emergency contacts, vehicle plate, insurance number) that works even when the app is locked.
15. **Year in review.** A deterministic, local "Wrapped" for your own data — km driven, fuel spent, biggest category, longest streak. Pure statistics, very shareable as an image (user-initiated).

---

## C. Redesigns (where I'd change the brief)

- **Navigation:** replace "user-assembled navigation" with **4 fixed tabs** — *Today · Modules · Attention · Settings* — plus global search and the capture bar. Customization happens *inside* Today and the module library, not in the nav. Predictable navigation beats customizable navigation for usability and accessibility.
- **Data model:** replace a universal entity table with **typed module tables + a shared relationship/event/search layer** (Part 2 §E.4).
- **Plugin system:** replace executable plugins with **declarative packs** (Part 2 §E.13). Executable extensions only ever as *separate APKs* communicating over a capability-checked IPC contract — and not before Phase 4.
- **Workspaces vs Dashboards vs Profiles:** the brief has three overlapping concepts. Collapse to two:
  - **Profile** = isolated data world (separate encrypted DB).
  - **Board** = a saved arrangement of tiles (Today is the default board; "My Car", "Trip: Goa" are others). "Workspace" is dropped as a separate concept.
- **Themes:** orthogonal axes instead of named modes (A.3).

---

## D. Product identity

### D.1 Concept
**Tessera** — a tessera is a single tile in a mosaic. Each module, each record, each insight is a tile; together they form the picture of your life admin. The metaphor scales: tiles (records) → panels (modules) → mosaic (Today board).

### D.2 Naming directions
| Name | Angle | Notes |
|---|---|---|
| **Tessera** (chosen) | Mosaic of tiles | Distinctive, short, metaphor maps to modularity. |
| Workbench | Craft / tools | Clear but generic; trademark-crowded. |
| Ledgerline | Records + timeline | Leans finance-heavy. |
| Almanac | Personal reference | Warm, but implies static content. |
| Keel | Stability, self-reliance | Short; less descriptive. |
| Hearth | Home-centric | Too narrow. |

### D.3 Personality
Calm, precise, instrument-like. A well-made workbench: everything has a place, labels are exact, nothing shouts. It's *confident about facts and humble about inferences* — every inference shows its working.

Voice: plain, short, specific. "584 km until service" not "Your vehicle may require maintenance soon!" Never exclamation marks. Never anthropomorphic ("I think…"); the system says what the *rule* found.

### D.4 UX principles
1. **Answer "what matters?" first.** Every screen leads with one visual answer.
2. **Visual before numeric before textual.** Ring → number → sentence → table.
3. **Four layers:** Overview → Details → Explanation → Raw data.
4. **Never ask what you can derive.** Two of litres/price/total → compute the third (MVP). Odometer prefilled. Last price remembered.
5. **Status never by colour alone.** Icon + label + colour (MVP: `StatusBadge`).
6. **Every inference is inspectable.** "Why?" everywhere.
7. **Reversible by default.** Snooze/dismiss/restore, delete confirmations, backups.
8. **Quiet hardware.** Sensors only in explicit sessions.
9. **Local and honest.** "Offline" indicator, no fake sync spinners.

### D.5 Visual language
- **Type:** Inter for UI, JetBrains Mono for all measurements, amounts and eyebrows (the "instrument" voice). Uppercase mono eyebrows label every panel.
- **Colour:** neutral graphite/paper surfaces; one user-chosen accent (Ochre default; Moss, Terracotta, Teal, Graphite, Rose). Semantic colours (error/warning/success/info) are fixed and never used as accents.
- **Depth:** no shadows (tier 0). Separation by 1pt borders and tonal surfaces. Inverse (dark) cards are reserved for "needs you now" (the Attention tile flips to inverse when something is urgent/upcoming).
- **Shapes:** 12pt card radius, 8pt controls, pill chips. Tick marks on rings and gauges — a subtle instrument cue.
- **Motion:** 90–260 ms; press-scale 0.97; staggered fade-in of tiles; shake on wrong PIN. Respects reduced-motion.

---

## Information architecture & navigation

```
Tabs
├── Today            (default Board: ranked tiles, search, capture)
├── Modules          (library: enable/disable/reorder; Today layout; roadmap)
│     ├── Vehicles   → Vehicle dashboard → Record
│     ├── Money      → Overview | Activity | Subscriptions → Record
│     └── Tools      → Units | Percent & Tax | Bill split | Dates | EMI
├── Attention        (Urgent / Upcoming / Info → Why? → Done / Snooze / Dismiss)
└── Settings         (Appearance · Defaults · Security & privacy · Data · About)
Global: Search (from Today), Record detail (/record/:kind/:id), Lock overlay, Onboarding
```

Rules: Modules never appear as tabs. Record detail is generic (same layout for every entity kind, with a **Linked** section). Sheets for entry; full screens for viewing.

---

## I. UX per module (what is visual / interactive / hidden / summarized)

### Today
- **Visual:** Attention tile (big count + severity pills), budget **ring**, service **gauge**, renewal **day-boxes**, tool buttons.
- **Hidden:** all lists. Each tile is one visual unit with ≤3 lines of text.
- **Interactive:** tap → module; long-press (Phase 2) → tile options; "Customize Today".

### Attention
- **List** grouped by severity with left colour rule + icon + label (triple-encoded).
- Actions inline (Why? / Done / 3d / Dismiss). Subscriptions' "Done" = "Paid" → logs a linked expense and advances renewal (MVP).
- **Explanation** sheet: summary, data table, rule, ranking.
- Phase 2: swipe right = done, swipe left = snooze.

### Vehicles
- **Gauge** for km since service vs learned interval; needle + ticks.
- **Stat strip** (avg mileage, cost/km, odometer) in mono.
- **Countdown bars** (segmented) for insurance and PUC.
- **Line chart** for mileage per fill with dashed average.
- **Timeline** for service history (nodes with type icons).
- **List** for fuel log with per-fill mileage.
- **Adaptive form** for service (fields per type) — MVP.
- **Hidden until asked:** raw odometer math, per-interval list (in Why?).

### Money
- **Ring** (budget used) → **bars** (category with limit marker) → **month bars** (6-month) → **insight cards** → **transactions list**.
- **Custom number pad + category chips** (frequency-ordered) for 3-tap entry.
- Subscriptions as **day-boxes** (days to renewal) + annual total card.
- Phase 2: calendar heat-map of daily spend; sinking-fund jars; net-worth stacked area.

### Quick Tools
- Unit attached to the input (tap to change). Swap button. Result panel in inverse tone with **Copy / Save / Send to module** and optional breakdown (progressive disclosure).
- EMI shows a principal/interest **split bar**; "Track as recurring" sends it to Money.

### Travel (Phase 2)
- **Countdown + readiness ring** on the trip card; **day timeline** (vertical, time-blocked) for itinerary; **checklist** with category progress bars for packing; trip expenses as a **stacked bar** by category vs budget; documents as **expiring credentials**.
- Reuse prompt: "Start from 'Goa 2025' packing list (34 items)?".

### Home (Phase 2)
- **Room/appliance cards** with status glyph; **maintenance timeline** (next 90 days); **warranty countdowns**; utilities as **meter-reading line charts** with bill projection band.

### Media (Phase 3)
- **Poster grid** with progress ring overlay; status as segmented filter; shelves (collections). Manual entry; covers imported from gallery via the photo picker (no permission needed on Android 13+).

### Phone Lab (Phase 3)
- **Live line charts** (ring buffer, 10 s window) for sensors; **gauges** for light/pitch; **session** banner with timer and Stop; results saved as artifacts exportable to CSV/JSON.

### Dev Tools (Phase 2)
- Two-pane input/output with instant transform; history per tool; "copy as" options. Dense mode by default.

### Rules (Phase 2)
- Sentence-style builder: **When** [event chip] **If** [condition chips] **Then** [action chips]. Dry-run panel with a sparkline of historical firings.

Continue in **Part 2**.
