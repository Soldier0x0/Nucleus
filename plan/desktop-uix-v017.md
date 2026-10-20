# Desktop UI/UX redesign — v0.17 plan

Status: drafted 20 Oct 2026. Target: the whole `desktop/` shell + every screen, shipping as v0.17.
Basis: Apple Human Interface Guidelines (Clarity, Deference, Depth; macOS app anatomy; sidebars, toolbars,
materials incl. Liquid Glass guidance, typography, dark mode, accessibility) translated to a Tauri/WebView
app using **our own assets** (Inter + JetBrains Mono, OFL) and **our own semantic design tokens**.
We deliberately do NOT ship Apple assets (SF Pro, SF Symbols) — the design *principles* are uncopyrightable
ideas, the assets are not. Everything below is buildable with CSS and existing components.

## 0. Diagnosis of the current UI (why it feels 3/10)

1. No platform anatomic order: sidebar is a wall of 19 equal buttons with no visual grouping/section
   rhythm; active state is a weak tint; no hover states; icons are string glyphs with no optical rhythm.
2. Two competing paper cards per screen (`topbar → workcol cards`) with a flat border and no depth,
   no scroll-edge treatment — long pages read as an unending stack; tables are raw `<table>`s.
3. Typography has no scale in practice: everything is 12–14px with random weights; numbers are not
   tabular in many places; captions and h2 look interchangeable.
4. Color signals almost nothing: one accent used for active chips AND links AND primary buttons;
   semantic states (ok/warn/error) are text-only; focus is invisible unless tabbing (input outline only).
5. Density works but rhythm doesn't: paddings are ad-hoc 6/8/10/12/14px; radii 7/10/16 arbitrary;
   shadows nearly absent so elevation doesn't communicate.
6. Interactions feel static: no pressed states, no transitions on section switch, palette pops with no
   fade/scale; `window.confirm` dialogs are jarring and unstyled.
7. Dark mode is a flat charcoal with the same border assumptions — borders read as noise; accent tokens
   don't shift correctly (accent-soft in dark is washed).

## 1. Information anatomy (Apple's order)

Window anatomy top to bottom, every screen:

- **Toolbar (52px, full-width, sticky):** leading = section title (20px semibold) + section-context
  count (subtitle 13px secondary). Trailing = screen actions (Add, Search, Export…) + primary action
  (accent-filled, one per screen max). Toolbar is a "material" layer: translucent with blur, hairline
  bottom border only when content passes beneath (scroll-edge cue).
- **Content layer:** max-width 1440 with 24px gutters; cards opt into a 2-column grid (`two-stack`
  upgraded to `grid-template-columns: minmax(0,1fr) minmax(0,1fr)` above 1080px). Each card gets a
  header (15px semibold + 13px secondary caption) and is visually distinct from the page background.
- **Sidebar (240px, collapsible to 64px icon rail):** translucent "sidebar material" (blur 20px,
  saturate 1.8, 60% window tint), sits above content. Sections: Workspace / Modules / Foot with 11px
  uppercase section labels; rows 30px, 13px regular; icons 17px, accent-tinted when row is active;
  active row = full-width rounded (7px) accent-soft fill with 1px inner accent border on light,
  elevated wash on dark. One badge only on Attention rows.
- **No fake toolbars inside content areas; no glass on glass:** only the sidebar + toolbar + dialogs
  get translucency. Cards stay opaque with subtle 1px hairline + 0/1/2px elevation shadow.

## 2. Type scale (Inter, tabular numerals everywhere numbers move)

| Token        | Size/weight       | Use                              |
|--------------|-------------------|----------------------------------|
| `t.large`    | 28/700, -0.5% trk | Lock screen, Today greeting       |
| `t.title`    | 20/600            | Screen title, card h2 upgraded    |
| `t.head`     | 15/600            | Card headers, table row titles    |
| `t.body`     | 13/400            | Base text (macOS body)            |
| `t.callout`  | 13/600            | Emphasized row titles             |
| `t.foot`     | 12/400            | Subtitles, helper text            |
| `t.caption`  | 11/600, 6% trk    | Uppercase section labels          |
| `t.num`      | 15–28/700 tabular | Amounts, KPIs (`font-variant-numeric: tabular-nums`) |

Rules: line-height 1.4 body, 1.2 titles; max ~72ch for prose; truncate row text with ellipsis not wrap.

## 3. Color & materials (Liquid-Glass-inspired, own tokens)

- Light: keep the Warm Paper brand hue but re-tune: `--bg #EFEAE3`, `--surface #FBF8F3`,
  `--surface-2 #F4F0E9`, hairline `rgba(32,26,19,.10)`.
- Dark: elevated model, never pure black: `--bg #17130E`, `--surface #211B14`, `--surface-2 #2A231B`,
  brighter hairlines `rgba(255,244,230,.14)`, labels step to 100/72/48%.
- Materials: real `backdrop-filter: blur(20px) saturate(180%)` on sidebar/toolbar/dialog with the
  window tint at 55–65% opacity; **dimming layer behind dialogs** per Apple's clear-glass rule.
- Elevation: 2px token shadow rest / 8px raised (palette, dialogs); never layer shadow+blur+border+fill
  — Apple warns against stacking depth cues.
- Semantic: `--ok` green reserved to money *in*, `--warn` amber for attention, `--error` red strictly
  destructive/dangerous, `--accent` orange strictly interactive (nav active, primary button, focused
  control). Never decorative accents (no default borders tinted).

## 4. Controls

- Buttons: 32px (regular) / 24px (compact `small-btn`), radius 7px; primary filled
  `accent-ink-on-accent`, hover +4% lighten, active scale .97, focus ring `0 0 0 3px accent 35%`.
- Segmented: keep `.seg`, add 150ms slide hint via background transition, 13px medium.
- Switch: proper iOS-style pill 39×23 with knob 19px and 200ms spring, replacing checkbox rows in
  Settings/Cycle/Lab/Reminders.
- Fields: 32px inputs, 6px radius, inner 1px border, focus = accent border + ring; numeric fields
  monospace tabular; `placeholder` at 45%.
- Tables/cards: rows 40px with 12px vertical rhythm; header rows caption style; zebra OFF (hairline
  dividers); row hover 4% fill; selected row accent-soft.
- Replace `window.confirm` destructive confirms with a native-feeling `.dialog` sheet (blur backdrop,
  11px radius, danger button red) — keep it small and centered, not modal-stacked.

## 5. Motion

- Tokens: `--fast 120ms`, `--base 200ms`, `--spring 320ms cubic-bezier(.32,.72,0,1)`.
- Section switch: content fades/translates 8px in 180ms; sidebar row highlight springs.
- Palette/dialog: overlay fades 120ms, sheet scales .96→1 with spring; backdrop-pop.
- All list updates: 140ms height/opacity; respect `prefers-reduced-motion` (turn all into instant).

## 6. Keyboard + accessibility (the part that makes it feel native)

- Global: Ctrl+1..9 sections (exists), Ctrl+K palette (exists), Esc closes palette/dialog.
- New: Alt+Ctrl+←/→ cycles sidebar sections; every primary action gets a shortcut surfaced in tooltip;
  Tab order = sidebar → toolbar → content (F6-like region cycling via a "skip to content" hidden link).
- Focus rings always visible (3px accent ring); hover ≠ focus.
- Contrast: body 13px ≥4.5:1 in both modes; verify accent-on-light for text uses `--accent-strong`.
- `aria-label`s on icon-only buttons; `role="switch"` on the new switch; `aria-live` on toasts/notes.

## 7. Delight details (the 10/10 layer)

- Traffic-light-friendly window: no draggable blocking; keep tauri default system chrome.
- Empty states: hand-drawn-style illustration slot + one sentence + one action button; each screen
  (Money empty, Notes empty, Net — already good).
- Scrollbars: 8px overlay style, auto-hide when idle (`scrollbar-color`, `scrollbar-gutter: stable`).
- Numbers: count-up animation on KPI change (respect reduced motion).
- Sidebar ver chip + sync dot get a quiet 1px hairline glass pill look.
- Print styles retained; screenshot/“fill the screen” Lab overlay unchanged.


## 9. Support/monetization surface (ties into the open-source docs)

- Settings → About gains a "Support the project" row that opens the GitHub
  Sponsors page (and later a UPI page) via the existing opener plugin; inline
  caption "@Soldier0x0 — fund a feature". Never a nag: fits the honesty rules.
- Cargo.toml `license = "MIT"` rides with the first v0.17 code commit, as does
  removing `memory/test_credentials.md` from git (keep the file locally).
- GitHub Sponsors must be enabled once by the owner at github.com/sponsors —
  FUNDING.yml is live but the payout profile is not; nothing else is missing.

## 8. Rollout

v0.17 in two PRs is NOT allowed (one PR = one version) — so it's all-or-one: shell + tokens first in the
same PR as screens' polish passes (Money, Health, Cycle, Today, Attention get topbars; the rest inherit).
Pins to update: `.title`, `.card`, `.switch`, contact `.mono` exist; tab bar tests keep testIDs.
