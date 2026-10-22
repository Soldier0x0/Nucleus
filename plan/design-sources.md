# Design Sources — v0.17 Reference

Status: research reference for the v0.17 Apple-inspired redesign (`plan/desktop-uix-v017.md`). Docs-only; no code impact.

## Primary reference: Apple DESIGN.md

- Source: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) → `design-md/apple/DESIGN.md` (563 lines, tree sha `96ed920ec7ee71d56d6b545dc02d4d92b182aac2`). Local copy: `/tmp/opencode/apple-DESIGN.md`.
- What it teaches (the format we mirror):
  - **Token-first spec**: YAML frontmatter (colors / typography / rounded / spacing / components) + `{token.ref}` everywhere — never inline hex or px in prose.
  - **Single accent discipline**: one Action Blue `#0066cc` for every interactive element; link blue `#2997ff` only on dark surfaces. No secondary accent anywhere.
  - **Surface alternation as divider**: white ↔ parchment `#f5f5f7` ↔ near-black tiles (`#272729/#2a2a2c/#252527`); the color change *is* the section break; tiles edge-to-edge, radius 0. Pure `#000000` reserved for one video case.
  - **Exactly one shadow in the system**: `rgba(0,0,0,0.22) 3px 5px 30px` — product imagery only, never cards/buttons/text.
  - **Typography ladder** 300/400/600/700 (500 deliberately absent); body at 17px not 16px; negative tracking ≥17px only; footer dense links line-height 2.41.
  - **Two button grammars**: pill (primary CTAs) + 8px utility rects; press state = `scale(0.95)`; focus = 2px solid `#0071e3` outline. No hover states documented — hover is never a design decision.
  - **Frosted sticky bars**: canvas-parchment 80% + `backdrop-filter: saturate(180%) blur(20px)`.
  - **Iteration guide**: change one component at a time; variants as separate entries; every state listed or assumed.
  - **Font substitution** (Linux/Windows): Inter ≈ SF Pro (weight 600 + `ss03`), −0.01em tracking at display sizes, body line-height 1.47 → 1.44.
- Relevance to v0.17: our palette (light `#EFEAE3/#FBF8F3/#F4F0E9`, dark `#17130E/#211B14/#2A231B`, never `#000`) mirrors tile alternation + reserved black; motion tokens 120/200/320ms; focus rings 3px accent 35%; sidebar `blur(20px) saturate(180%)` matches Apple's frosted baseline directly.

## Counterpoint reference: OpenCode DESIGN.md

- Source: `npx getdesign@latest add opencode.ai` (the getdesign.md catalog listed above). Local copy: `plan/design/opencode-DESIGN.md` (521-line alpha spec of opencode.ai `/` + `/zen` + `/enterprise`. Berkeley Mono is paid — its substitute stack starts with JetBrains Mono, already our mono face).
- What it teaches (a terminal-native system, the opposite pole of Apple's chrome):
  - **One face carries everything**: every text role is the same monospaced family — no sans body, no display face, no italics. The typographic restraint *is* the brand (a manpage, rendered at modern resolution).
  - **Monochrome with one reserved dark moment**: cream `#fdfcfc` is the only body background, ink `#201d1d` the only brand color, 1px history hairlines the sole separators; the near-black `#201d1d` full-bleed belongs to the hero TUI mockup only — one dark statement per page (same scarcity logic as Apple reserving `#000`).
  - **Elevation by color inversion, not shadow**: zero drop shadows anywhere; the only surface that reads as "above" is the inverted dark one.
  - **Two-value radius**: 4px on every interactive element, 0px on every container — radius itself signals "this acts".
  - **Semantic ramp = Apple HIG verbatim**: carries `#007aff` + hover/active deepenings, `#ff3b30` / `#ff9f0a` / `#30d158`, documents focus as flat (border flips to ink, no halo glow).
- Relevance to v0.17: independently confirms our four bets — single interactive accent, reserved-dark scarcity, hairlines as dividers, "restraint lands" (same conclusion as the awwwards cross-check). Semantic ramp mapping matches our §3 exactly; JetBrains Mono flavor for code surfaces already ships.
- Deliberately NOT adopted (that's a landing page, ours is a dense daily tool): all-mono chrome (Inter earns its place for readability and hierarchy at 13px), no-shadow absolutism (we keep 0/1/2px elevation tokens), 0px container radius vs our 7px, and the 96px marketing section rhythm (ours runs 12px table rhythm). ASCII bracket bullets remain an option for Dev-Tools/empty-state flavor, not chrome.

## Pattern rebuilds: Forever Components (technique extraction)

- Source: forevercomponents.com — 767 zero-dependency animated components. Free account copies 3/day; the site does not state an open code license, so **upstream files are study references only** and never tracked: raw copies live in `plan/design/forever/` (gitignored), rebuilds are Nucleus-native files checked in here. Every shipped rebuild must keep `prefers-reduced-motion` support, focus discipline and `role="status"`/`aria-live` — the upstream metadata lists them, we own them in the port.
- Skill pairing for rebuild reviews: `animate` (motion decisions in order) → `design-review` (spacing/hierarchy polish) → `find-animation-opportunities` (boundaries — reject the rest).

### Undo Snackbar — rebuilt as `plan/design/undo-snackbar-nucleus.html` (22 Oct 2026)

What was extracted (kept): SN state machine `idle→counting→confirmed|restored`; single rAF loop owning **all** state transitions (wall-clock timers sit on that clock); `visibilitychange` clock rebase (`t0+=gap`, `timer.due+=gap`) so hidden time never fast-forwards the countdown; ring = stroke-dashoffset only (r=12.5, stroke 3.4, rotate −90°), flipped under 28% remaining; ledger row dims `.12` + slides 18px as the deletion cue; UNDO button press = scale keyframe with overshoot; restore flash = border tint + checkmark pop; reduced motion = static legible ring frame while timers still run.

What changed (Nucleus-native), table of upstream → ours:

| Aspect | Forever upstream | Nucleus rebuild |
| --- | --- | --- |
| Palette | mint/rose accents on dark navy `#0b0d12`; brand `--fb12-acc` drives the ring | real desktop tokens (`desktop/src/styles.css`); semantics: ring drains in `--warn` (attention) → `--error` (destructive) under 28%; flash borders via `--error`/`--accent` mixes |
| Motion | entrance 620ms `cubic-bezier(.18,1.5,.3,1)`, exit 420ms `(.5,0,.7,.2)`, icon pop 500ms `(.2,1.6,.3,1)` | v0.17 token tier: entrance 320ms spring `(.32,.72,0,1)`, exit 160ms ease-in (`--fast`), icon/press 320ms with ≤1.4 overshoot |
| Materials | opaque gradient bar, big dark shadow | dialog-tier translucent panel (`panel` 88% + `blur(20px) saturate(180%)`), token shadow only — no stacked depth cues |
| Controls | 13px UNDO, radius 9, double-ring focus (bg+accent) | compact 24px control, radius 7, single 3px accent 35% focus ring; `--accent-strong` text |
| Copy / thermostat | "Item moved to trash", 4.2s | real record names, 6s window; sub-line goes "Deleting for good soon" on the red stretch |
| Keyboard | UNDO is the only focusable (Enter/Space) | + Esc commits (matches timeout; UNDO stays the explicit restore), focus lands on UNDO at spawn |
| Not ported | idle auto-press demo loop, `forever:` preview/theme hooks, fake ledger as content, per-cycle label rotation | production is event-driven; theming via the app's `[data-theme]`; the ledger row **is** the real record (delete → snackbar, restore → tombstone un-gone); one window at a time |

Desktop wiring when v0.17 lands: pairs with the §4 dialog sheet — destructive confirms split into **dialog** (busy-, bulk-, cascade-deletes) vs **undo snackbar** (single-record optimistic delete, e.g. the audit-punchlist M12/H5/M4-class deletes). App has no toast system yet on desktop; this component seeds it (next rebuild: Toast Stack reference → same `role="status"` discipline).

### Toast Stack — rebuilt as `plan/design/toast-stack-nucleus.html` (22 Oct 2026)

Their own docs say "needs refactoring before shipping" (no live region, rAF drain frame cost, auto-cycle demo). Kept: bottom-rail `column-reverse` stack, MAX 3 with oldest-retire rule, enter from 26px/scale .94 with spring overshoot, progress hairline draining left over the toast's life, smoothstep slide-right exit, reduced-motion static 3-toast snapshot, visibility pause. Changed in the port:

| Aspect | Forever upstream | Nucleus rebuild |
| --- | --- | --- |
| Animation driver | per-toast rAF loop (`spring()` overshoot fn, smoothstep exit fn) | **zero rAF for visuals**: CSS keyframes entrance (320ms spring + overshoot in the curve), linear `scaleX` drain, 160ms ease-in exit transition on the compositor; JS only schedules |
| Scheduling | rAF clock for everything + separate setTimeout demo tick | one shared visibility-rebased timer (same architecture as the undo snackbar) plus CSS `animation-play-state: paused` under `html[data-hidden]`, so the JS deadline and the CSS drain cannot drift apart |
| A11y | rail `aria-hidden` (demo convenience), their docs admit the gap | rail = `role="status" aria-live="polite" aria-relevant="additions text"` (exits never re-announce); failure toasts are `role="alert"` |
| Palette / kind set | ok/err/warn/neutral mint-rose-amber (dark navy) | `--ok` success, `--error` failures, `--warn` attention, neutral border-only glyph; icon circle ink `--accent-ink`; subtitle in JetBrains Mono (sync/status lines) |
| Content | abstract demo kinds | real payloads (backup written, sync paused, export failed, empty view) |
| Not ported | idle auto-push cycle, forever: hooks, `space ↵` stage trigger | event-driven dispatch buttons (the app's exports/sync/reminders will call `push()`); constants: 320/160/4200ms knobs up front |

### Odometer Count-Up — rebuilt as `plan/design/odometer-nucleus.html` (22 Oct 2026)

This is the v0.17 §7 hero motion: "Numbers: count-up animation on KPI change". Kept: continuous fractional reel math (per decimal place: `frac` + `top`, digits roll through carries like a real odometer), 3-cell viewport with distance falloff `1 − 1.3·dist`, DPR-independence trivially replaced by DOM, visibilitychange pause that never fast-forwards, reduced-motion snap straight to target. Changed:

| Aspect | Forever upstream | Nucleus rebuild |
| --- | --- | --- |
| Renderer | `<canvas>` redraw loop | DOM reels — real font tokens (Inter 26/700 `tabular-nums`, plan §2 `t.num`), selectable, and re-theming is instant via CSS vars (no `syncTheme()`/`getComputedStyle` cache to invalidate — theme flips are free) |
| Chase easing | `cur += (tgt−cur)·0.045` per frame (60fps-dependent) | `cur = tgt + (cur−tgt)·e^(−dt/τ)`, δt-normalized, **τ ≈ 360ms** (derivation: ln(0.955)·60 ≈ −2.76/s) — same feel, frame-rate independent, dt clamped ≤100ms post-resume |
| Loop discipline | runs forever (hold-idle re-randomizes every ~1.3s) | settles and **stops the rAF loop** when `|tgt−cur| < 0.5` (calm rule; wakes only on new data) — their own "wire external data" limitation answered |
| Data | random target, tap = new random | `setTarget(value)` API; harness cycles Nucleus-flavoured preset amounts |
| Numerals | mono mint digits, leading zeros equal weight | leading zeros dimmed to 0.3 with a `.dim` slot (mechanical idle, not data); western grouping separators; `en-IN` render in the accessible name |
| A11y | canvas text invisible to screen readers | `role="img"` + `aria-label` ("Week left: ₹12,450") maintained on settle; reels `aria-hidden` |
| Not ported | sheen line, mono canvas label, demo hold counter, forever: hooks | styling lives on the KPI card (panel/hairline/shadow); label is a `t.caption`-tier mono row |

Desktop wiring when v0.17 lands: becomes the `CountUp` numeric helper for Today/Money KPI tiles (one hero motion moment per screen — this is it), the toast stack pairs with the undo snackbar as the desktop's two-layer feedback system (transient status = toast, dangerous-reversible = undo snackbar, blocking decisions = dialog sheet).

### Frosted Glass — rebuilt as `plan/design/glass-materials-nucleus.html` (22 Oct 2026)

This is the §3 materials reference for plan §1 (sidebar/toolbar shell). The upstream demo floats a glass card over decorative drifting blobs; the rebuild grounds the same recipe over the app's real scenario — opaque paper cards scrolling beneath a translucent sidebar + toolbar — and prototypes the plan's scroll-edge cue.

| Aspect | Forever upstream | Nucleus rebuild |
| --- | --- | --- |
| Stage | glass card over three drifting gold/cream/tan blobs (the entire demo) | no decorative stage — the blur source is *real content*: opaque cards scrolling beneath; cards stay opaque (never glass on glass) |
| Glass values | blur(16px) saturate(140%), panel rgba .42 dark / .55 light | plan §1 / Apple frosted-bar baseline: blur(20px) saturate(180%), 60% window tint as `--mat-tint` |
| Specular | `inset 0 1px 0 rgba(255,255,255,.22)` top rim — the premium tell | kept as `--mat-hi`: toolbar top edge, sidebar right edge (`inset -1px 0 0`) |
| Fallback | upstream limitation: blur silently vanishes in Firefox, leaving a washed 42% panel | `@supports not (backdrop-filter: blur(1px))` raises tint to 94% opaque — legible degrade instead |
| Added | — | scroll-edge cue: toolbar hairline + descent shadow wake only while content passes beneath (passive `scroll` listener) |
| Hover | panel lifts `translateY(-4px) scale(1.02)` | not ported to chrome — glass is furniture, not content; hover life belongs to the 4% ink row fills |
| Not ported | blob drift keyframes, Space Grotesk display face, `forever:` hooks, blob visibility-pause | theming via `[data-theme]`; no ambient loop exists, so nothing to pause |

Demo tokens deliberately use the v0.17 §3 **retuned** set (light `#EFEAE3/#FBF8F3/#F4F0E9`, dark `#17130E/#211B14/#2A231B`), not the 0.16.1 stage other rebuilds carry verbatim — the material layer targets v0.17. Desktop wiring when v0.17 lands: sidebar 240px grouped rows (30px) + 52px sticky toolbar from plan §1; materials restricted to the sidebar/toolbar/dialog layers (§4 dialog sheet reads the same tokens later).

### Liquid Toggle — rebuilt as `plan/design/toggle-liquid-nucleus.html` (22 Oct 2026)

The upstream is an SVG goo-filter toggle (`feGaussianBlur` + `feColorMatrix` alpha-matrix) with two trailing droplets lagged by `sin(p·π)`. Kept: the elastic settle feel and a11y posture. The filter itself is deliberately not ported — their own metadata flags rendering cost in dense forms, and at the §4 switch size droplets land sub-pixel.

| Aspect | Forever upstream | Nucleus rebuild |
| --- | --- | --- |
| Renderer | SVG + goo filter, 3 circles with droplet lag | CSS-only 40×24 pill button, 20px knob (paper fill, hairline, 1px shadow) |
| Motion | per-frame lerp `p += (t−p)·0.085`, demo keeps rAF alive | §4 spec: 200ms spring `cubic-bezier(.32,.72,0,1)` translateX; knob squish `scale 1.26→.82` via the same curve on flip, settles and stops |
| Track | `transition: fill .5s`, teal on navy | 200ms crossfade to `--accent`; off-state surface-2 + inset hairline; `--accent-strong` ring on the on-state |
| A11y | `aria-pressed` on a button, focus-visible, reduced-motion snap | `role="switch"` + `aria-checked` (correct toggle protocol), labels via `aria-labelledby`, 3px 35% accent focus ring, reduced-motion jump + no squish |
| Context | single abstract stage + idle auto-toggle demo | real settings-row context (three toggle rows, hover fill); event-driven — no demo loop, no `forever:` hooks |

Desktop wiring when v0.17 lands: the §4 iOS-style switch replacing checkbox rows in Settings/Cycle/Lab/Reminders — the highest-visibility control delta in the redesign (a switch is on nearly every screen).

### Segmented Control — rebuilt as `plan/design/segmented-pill-nucleus.html` (22 Oct 2026)

Upstream slides a gradient pill between four native buttons on a cached spring with velocity-stretch. Kept nearly whole — including their geometry-cache discipline and the wrap-around-safe trajectory interpolation — with the a11y gap their own docs admit closed.

| Aspect | Forever upstream | Nucleus rebuild |
| --- | --- | --- |
| Geometry | `measure()` once, re-read on resize only, never per frame (their comment) | kept verbatim; `offsetLeft/offsetWidth` cached on all four tabs |
| Spring | k=0.18, damp=0.65 per frame; rAF runs while the auto-cycle demos | same constants; **settle-and-stop** — loop exits when `|cur−idx|` and `|vel|` pass thresholds; reduced-motion jumps instantly |
| Overshoot | wrap-around fix clamps `i0` to real pairs, lets `fr` run outside 0..1 | kept verbatim — the pill bounces past the edge correctly |
| Stretch | `\|vel\|·40px` unclamped | same factor, clamped to 12px (calm rule) |
| Pill | slate→sage gradient, `card-shadow` glow | flat `--accent` fill (single-accent rule), 1px contact shadow, radius 7 tabs on radius 10 track |
| A11y | buttons + `aria-pressed`; docs admit missing tablist | `role="tablist"/"tab"` + `aria-selected`, roving tabindex, Arrow/Home/End navigation, 3px 35% focus rings |
| Context | abstract Day/Week/Month/Year demo + auto-cycle | Money screen period selector with live `role="status"` mono readout ("This week · Sep 21 – 27") |

Desktop wiring when v0.17 lands: Money tabs, Reminders filters, Settings segments — the `.seg` pill layer and spring plug into the existing control grid directly; selection readouts ride `role="status"` so period changes announce politely.

### Spotlight Hover — rebuilt as `plan/design/spotlight-hover-nucleus.html` (22 Oct 2026)

Upstream tracks the cursor with a CSS custom-property pair and preserves layout cost by caching the card rect. The technique is kept verbatim; the dressing is replaced with warm, informative ink.

| Aspect | Forever upstream | Nucleus rebuild |
| --- | --- | --- |
| Coordinates | `--c04-x/--c04-y` px custom properties drive a radial glow | kept verbatim as `--mx/--my`; `pointerenter` seeds the position before fade-in so the wash appears under the cursor, not sliding in from center |
| Layout cost | rect cached at init, refreshed on resize only, never per move | kept + passive captured `scroll` refresh for real scrolling shells; zero rAF anywhere |
| Aesthetic | peach glow + Space Grotesk display face + masked grid reveal | 6% ink wash over `--panel` — feedback on content, not ornament; ink not accent (navigation focus stays single-accent); masked grid dropped (decorative, uninformatative) |
| Life | glow auto-orbits while the pointer is away (idle demo) | no orbit: event-driven, settle-and-stop; wash fades in 200ms on enter, out on leave |
| A11y | arrow keys move the glow on a tabindexed card | tiles are real buttons with labels; `focus-visible` centers the wash — keyboard users get the same affordance without pointer faking |

Desktop wiring when v0.17 lands: Today's two-column module grid and Money tiles read the same `--mx/--my` pair; combine with (not instead of) the 4% ink row fill used on lists. Ship the focus-centering, skip the orbit.

### Empty State — rebuilt as `plan/design/empty-state-nucleus.html` (22 Oct 2026)

Upstream is a 26-mote canvas cloud hovering over an open vessel, with spring physics and scatter-on-poke. Honoring their own avoidWhen — "motion competes with a call-to-action" — the cloud is not ported; the vessel is, as a single inline SVG whose rim brightness is settle-keyed.

| Aspect | Forever upstream | Nucleus rebuild |
| --- | --- | --- |
| Illustration | DPR-aware canvas, 26 typed-array motes, bezier vessel | one inline SVG: `--panel-2` void, muted walls, dashed ground, front rim accent (dasharray 76/24 over `pathLength=100`) |
| Life | motes drift, scatter on poke, spring-settle, loop forever | one settle on first paint: 5px drop-in + rim brightens `--accent-soft` → full `--accent` (520ms, 160ms delay, `both`) — then the page is still |
| Composition | illustration is the whole demo | illustration + real copy: headline, one sentence, primary **Add expense** button (focusable, ring, press state) |
| A11y | canvas wears `role="img"` + blanketing label | SVG `role="img"` describes only the vessel; headline/sentence/action are real HTML, announced naturally |
| Context | abstract stage | Money ledger before the first expense |

Desktop wiring when v0.17 lands: empty states for Money (no transactions), Reminders (none due), Health (no device entries). Budget rule: an empty state settles once and stops — if it animates more than once, it is a screensaver.

### Error Shake — rebuilt as `plan/design/error-shake-nucleus.html` (22 Oct 2026)

Upstream shakes a ghost-email field with a rAF decaying sine. The envelope is kept exactly; everything byte-driving is converted to CSS, and their auto-reset is corrected for production.

| Aspect | Forever upstream | Nucleus rebuild |
| --- | --- | --- |
| Shake | rAF: `x = sin·AMP·exp(−7.5t)`, AMP 13px | same envelope baked into a 550ms CSS keyframe track (11px → −9 → 6 → −4 → 2.4 → −1.4 …), GPU translateX, zero rAF; re-armed per invalid submit via forced reflow |
| Border flush | rAF RGB lerp to red over 180ms | 200ms `--base` transition to `--error` + `--error-soft` 3px ring (swaps out the neutral focus ring while erroring) |
| X mark | scale pop with 1.18 overshoot | `cubic-bezier(.34,1.56,.64,1)` pop, strokes drawn center-out (`transform-box: fill-box`), second stroke staggered 70ms |
| Message | slides up, `aria-live` polite (their own docs add it) | kept + `role="status"`; 200ms 3px slide; error text in `--error` |
| Reset | error self-clears after 2.7s | **production fix: error persists until the value changes** — input event clears it; a form that forgives itself while the user is reading it teaches nothing |
| Theater | ghost email, blinking caret, idle auto-error | dropped: dumb `inputmode="decimal"` field, real validation (`> 0`), event-driven only; success path flashes `--ok` and clears on next input |

Desktop wiring when v0.17 lands: every invalid/destructive-rejection flow — Expense save, Transfer form, wrong-pin unlock. Reduced motion keeps the static error frame (border + mark + message) so meaning survives without motion; pairs with the undo snackbar (forgiving path) rather than replacing it.

## Format spec: Stitch DESIGN.md

- <https://stitch.withgoogle.com/docs/design-md/overview/> — plain markdown at project root describing the visual system.
- Division of labor: **AGENTS.md = coding rules; DESIGN.md = visual system**. Versioned with the code; agents quote `{token}` refs directly.
- Earmark: publish Nucleus's own `DESIGN.md` at repo root in v0.17 using the same skeleton (frontmatter tokens + Overview / Colors / Typography / Layout / Elevation / Shapes / Components / Do's–Don'ts / Iteration Guide / Known Gaps).

## Creative principles: Claude frontend-design SKILL.md

- <https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/frontend-design/skills/frontend-design/SKILL.md> (blob `a5333457c414d20d625f307df945842c0952ecc3`); cookbook: <https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb>
- Design-lead persona; ground in subject/audience/primary job; hero = the most characteristic thing of the subject's world; avoid the default "big number + small label + stats + gradient" template; typography carries the page's personality; deliberate, opinionated palette; aesthetic risk if justified.
- Applied to Nucleus: subject = a local-first personal database → calm, dense, tabular, paper-like; hero = the data itself (records, tables, timelines), not decorative chrome.

## Vetted resources (free, license-clean)

| Resource | License | Use |
| --- | --- | --- |
| Lucide | ISC | icon set (primary choice) |
| Phosphor | MIT | icon alternative |
| Radix Colors | MIT | accessible color-scale reference |
| Inter | OFL | body/UI font (already in use; −0.01em display tracking per Apple substitute note) |
| Fraunces / Newsreader | OFL | optional display-serif accents |
| unDraw | open license | empty-state illustrations (or inline SVGs) |

Galleries for pattern study (reference only, no assets copied): Mobbin, UI Sources, Nicely Done, Screenlane.
Catalogs: getdesign.md, awesome-design-md (84 brand files), designmd.co.

## Rejected

- getdesign.md Mobile Starter Kit ($249): Expo/React Native kit — contradicts the local-first/privacy posture and MIT provenance. Do not buy.
