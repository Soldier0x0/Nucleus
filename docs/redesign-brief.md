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
| Settings | todo | — | scroll LAG reported by user; audit every card visually before touching. |
| Toggle (liquid switch) | todo | — | still "broken buttons"; redesign deferred to the toggle item. |

## Openings & fixes log

- 2026-10-24: opening animation v1 implemented (inline theme first-paint,
  BootScreen intro→leaving→done veil). User verdict: rework → cinematic, fast,
  good graphic. Done in v2 this day.
- 2026-10-24: v2 opening (bloom + unified beat) captured live: b2-*. Mid-fade
  stills still uncaptured (detector fires ~90% through the 540ms veil);
  low priority, will re-verify after the chrome passes land.
