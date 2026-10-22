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
