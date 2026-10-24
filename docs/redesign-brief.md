# Nucleus Desktop — Redesign Brief & Audit Ledger

Working document. Every requirement the user has stated for the desktop redesign
is kept here verbatim-ish so it survives context loss. The audit ledger below
grows as each screen/click is visually inspected. Do not delete items: user
re-checks them. Last updated: 2026-10-24 (v0.18 cycle).

## The bar (what "Apple-grade" means here, user-defined)

- Cleanliness, spacing discipline, hierarchy, smoothness, premium looks —
  NOT macOS window conventions. It is an aesthetic standard, not a platform.
- Rounded corners everywhere — **including the application window itself**
  (user has stated this before and confirmed it again; it was not followed).
- No orange gradient logo. Disciplined monochrome mark only.
- Window controls (min/zoom/close) MUST be on the **top RIGHT** with
  NO red/yellow/green color coding. Currently top-left and colored = wrong.
- Motion is expected: staggered entrances, hover-lift, springs on
  toggles/selects/dialogs. Respect prefers-reduced-motion.
- Cinematic but FAST: the opening reveal should not take much time.

## Requirements ledger (user statements, each still open until audited+fixed)

1. Window controls → right side, no traffic-light colors.
2. Replace orange gradient blob logo with disciplined monochrome mark
   (proposed: dot + hairline orbit, ink; amber only as the busy hairline).
   Applies to boot, lock screen, sidebar brand row, About.
3. Sidebar: spacing/hierarchy discipline; fingerprint pill and build number
   **do not belong on the main page — move to Settings (About)**.
4. Settings bento grid: uneven gaps, orphan cards, inconsistent padding — fix.
5. Toggles "look like broken buttons" — full redesign: rounded track, thumb
   shading, off/on color meaning, spring. (Still "shit", re-confirmed.)
6. Turn-off PIN UX: separate action + own dialog asking the CURRENT PIN inside
   the dialog (not the change-PIN form failing after first click).
7. Busy/progress feedback during 30–90s rotations.
8. Boot screen: motion + cinematic reveal, not slow. Plus launch opening
   animation: "smooth and beautiful" — implemented v1, user feedback now:
   "cinematic reveal, should not take much time, but good graphic" → rework.
9. **Text is overlapped in many places** — find each, fix.
10. **Congestion, alignment is bad everywhere.**
11. **Input boxes and field alignment everywhere looks like crap.**
12. **Settings lags while scrolling** (+ find more lag places).
13. **Spacing, margins, borders not proper everywhere.**
14. **So much stuff is hidden** (things expected to be shown). Audit: what is
    expected vs what is actually shown, per component.
15. Button sizes, gaps, spaces, margins, placements, alignments — a global
    consistency pass against one scale.
16. Sharp window edges → rounded everywhere.
17. Method requirement: audit VISUALLY, code-last. "Open every single
    component, every single module, every single click, every scroll — even
    in settings, nothing left behind… you are an expert UI/UX designer, act
    like it." Include what's expected to be shown vs actually shown vs how
    it looks. If design help is needed: install/consult references
    (skills; possibly good-looking local apps as visual reference).
18. Everything from every conversation round must be saved locally
    (this file) and carried into research/plan/implement/debug phases.

## Context

- No UI framework. Hand-rolled CSS (desktop/src/styles.css), tokens live in
  :root / [data-theme=dark]: bg light #f2f2f6 dark #0a0a0c, accent amber
  (#b56717 light / #e5a44f dark), radius 16/12/9, Inter Variable + JetBrains Mono.
- QA sandbox: XDG_DATA_HOME=/tmp/opencode/qa-data2 (pinless vault f9bd83d3);
  NEVER touch real vault /home/harsha/Documents/Default Project, never kill
  app mid-derivation. qa.py at /tmp/opencode: snap/click/drag/type/key,
  absolute screen coords, QA_FULLWIN=1 includes window edges.
- CI: each non-docs push = ~40 min APK build. Batch design pushes; docs-only
  pushes skip builds.

## Audit ledger (fill per screen: expected vs shown vs issues)

Legend: status = todo | seen | fixed | verified. Score each honestly;
record the frame path for every entry.

| Area | Status | Frames | Expected vs shown / issues |
|---|---|---|---|
| Boot opening v2 | seen | /tmp/opencode/b2-045.png, b2-16.png, mf-1.png | One cinematic beat: mark+ring+word arrive together over a warm bloom (~0.8s settle), amber shuttle orbits during the 45s derivation, cross-fade into dark Today. Awaiting user replay verdict. |
| Window corners | todo | /tmp/opencode/c2-corner.png | The application window is square 90° on X11. Fix: transparent surface + rounded shell root (Rust `transparent(true)`; needs dev-server restart to verify). |
| Window controls | todo | v2-t2.png (toolbar trio), hover-dot.png | THREE problems: (1) they sit top-LEFT inside the content toolbar, user wants top-RIGHT; (2) color-coded red close, user wants graphite; (3) clicking the toolbar trio DOES NOT close the app (WM path only) and hover shows no glyph — broken affordance. A separate functional fixed overlay exists on boot screens (top-left) — unify into one right-top set. |
| Today screen | todo | mf-1.png | Context strip "0 things want you · 24 Oct 2026" — awkward copy; toolbar dots crowd the strip edge; "No phone yet pairing lives in Settings" pill is repeated verbatim as a link line below (redundant duplicate); KPI pair inconsistent: left card shows caption under the number, right card shows pill inline with it (baseline mismatch); "With your phone" card leaves its grid row's right cell empty (orphan). |
| Sidebar foot | todo | mf-1.png | Fingerprint pill `6cb29023` lives on the MAIN PAGE — user: belongs in Settings (About). Clutter risk: brand row (logo pill + name + v0.18.0 + rail icon), search, Support row, fingerprint, phone card. Hierarchy needs one decider + one quiet line. |
| Money screen | todo | v2-t2.png | (1) Add-row overflows its card: the Note field is CLIPPED mid-label at the card edge ("Note (o…") and "Add expense" wraps to its own line — the promised single-line add-row is broken at this width. (2) In/Out/Net/Rows KPI cards have bottom-heavy voids and content baselines not shared (Б₹0.00 vs pill-inline variants). (3) Categories card: label then huge empty void. (4) 6-month trend: giant empty band above tiny baseline labels — ratio dishonest. (5) amber primary "Add expense" row hangs left with uneven gap rhythm. |
| Settings screen | todo | set-1.png, set-2.png | (1) STICKY TITLE OCCLUSION FAILS: with the page scrolled, the Security card title bleeds through the sticky Settings heading — literal overlapping text, the clearest "text is overlapped" exhibit. (2) Bento voids: short left cards leave giant vertical voids (Security ends ~y268, Backup begins ~y673); General card interior mostly empty while Look/Pair cards are dense — row heights not composed. (3) Toggle "Start with this computer" renders as a tiny dark pill + dot — the exact "broken button" look (v2-verdict pending redesign). (4) Backup row mixes THREE control treatments in one line (amber Export backup / plain Password input / grey Export encrypted). (5) Version shows twice on one screen (sidebar brand pill AND context strip "…v0.18.0"). (6) Pair-a-phone column is dense (QR+digits+address+2 buttons+devices table) vs sparse left column. |
| Scroll / compositor | todo | set-2.png, boot-check.png, hover-money.png | During Settings scrolling: stale-buffer patches are real (toolbar strip text and window-control trio VANISHED in one frame while content stayed, a content region painted black mid-poll; one frame showed old content composed with missing overlay chrome). Manual 78ms frame sampling during wheel: continuous motion, no hard freezes — perceived lag most plausibly from backdrop-filter/blur repaints + mousemove-driven spotlight effects. Fix candidates: fewer blur layers in scroll paths, GPU-cheap hover effects, restore chrome via z/backdrop fix, then re-measure. |
| Health | todo | aud-health.png | (1) Water steppers are RAW NATIVE number inputs (tiny native spinners) — inconsistent with Cycle's custom steppers. (2) Medicines row: "Medicine name" and "Dose (optional)" fields differ in width and their edges nearly touch — needs exact-crop confirmation whether they overlap; gaps irregular to the Add button. (3) Sidebar tooltip plate sits ON the row it describes and half-covers the label (see aud-papers.png too). (4) Content ends mid-page; below-fold is a black void (systemic composition issue). |
| Cycle | todo | aud2-cycle.png | THE overlap showcase: Stash row labels collide with the "Home" location label (Pads/Home, Liners/Home, Tampons/Home, Cups/Home, Discs/Home all rendered overlapping at the same baseline) and "Period underwear" collides with "Low from". Also: buddy card shows Name("Optional") input immediately followed by a second input whose text is CLIPPED mid-word ("…guess from th") overlapping the helper line below it; the Bag column Steppers show an em-dash placeholder while Pack shows numerals (inconsistent); low-mark helper reads like dev-speak ("counts at or under the low mark tint warm. The low mark cycles out of the row's own label"); change-timer chip row leaves one orphan chip on the second row. |
| Papers | todo | aud2-papers.png | Sidebar tooltip plate half-covers the "Notes" row label; "Other" filter chip wraps alone (orphan); vault panel keeps filter chips over an empty list with the bare caption "No papers match."; the right 75% of the screen is empty black with only a floating caption + Print button — no composition/CTA. |
| Notes | todo | aud-notes.png | Empty-state vessel is one of the better-executed screens (bowl illustration + copy + New note). Segmented Notes/Kanban fine. But below the vessel card ~60% of the viewport is dead black (systemic: no max-width/composition per screen). |
| Tools | todo | aud-tools.png | The swap-units control between the two selects reads as a faint ghost icon (no affordance/contrast); the result plate's Copy/Save mini-buttons are a smaller scale than the header chips (internal scale chaos); tool card floats high with a large void below. |
| Rules | todo | aud-rules.png | Quiet-hours Off/On renders as TWO FLAT BUTTONS (one dark, one amber) — reads exactly like "two broken buttons", not a switch; also the On segment's corners clip oddly against the Off segment. Giant dead space between the Rules card (top) and the Quiet hours card (pinned to the viewport bottom fold). |
| Vehicles | todo | aud-vehicles.png | Garage card and Fuel stations card float with mismatched heights and leave the rest of the viewport empty black; copy leaks tech ("pull the OSM index around your city"); unresolved what the empty-state SHOULD show (import CTA lost in prose). |
| Tool Builder | todo | aud-toolbuilder.png | Template chips fine; "Start from scratch" primary button carries a different (heavier) shadow than other primaries; content ends at ~y260 leaving a void — same composition problem. |
| Money interactions | todo | mon-select.png (raced), mon-select2.png | Select popover + Add-expense flow + toast rail could NOT be exercised this pass — sidebar clicks raced the fast batch and one Money click landed while the compositor was stalled; retake during the toggle/motion implementation pass. Note: the QA vault is empty (no seeded transactions), so reorder/undo/toast states need seeded data later. |

## Openings & fixes log

- 2026-10-24: opening animation v1 implemented (inline theme first-paint,
  BootScreen intro→leaving→done veil). User verdict: rework → cinematic, fast,
  good graphic. Done in v2 this day.
- 2026-10-24: v2 opening (bloom + unified beat) captured live: b2-*. Mid-fade
  stills still uncaptured (detector fires ~90% through the 540ms veil);
  low priority, will re-verify after the chrome passes land.
