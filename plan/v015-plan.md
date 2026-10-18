# v0.15 plan — Desktop, finished + Material-You widgets

Extends plan/v012-v014-plan.md. One release: the desktop design pass approved in the design boards,
the remaining desktop features, widget dynamic color, and the CI honesty items.

## 1. Design system on desktop (always', plan/design boards)
- Tokens from plan/design/mockup.css (Warm Paper): bg #f5f1ea / #161310, card rims, ink, accent
  #be7a2e / #d8934c, good/warn/bad + soft variants, radius 16/10, Inter-then-system font stack,
  tabular numerals. Both themes re-tokened; dark keeps charcoal.
- Shell: 232px sidebar (bg-soft), logo dot + version chip, search row (⌘K), WORKSPACE / MODULES
  labels per the boards, icon rows (inline SVG paths from the boards), Attention badge pill,
  syncfoot card at the bottom.
- Screens: topbar per screen (caption + h1 24px), 28px gutters, bento 12-col spantiles on Today
  (spent spark, fuel cycle, service progress, attention t7, pick-up t5, recent documents, bills,
  with-your-phone), Money KPI cards + tablecard, Attention two-column with rail, Settings in
  named grid-areas, module lists as tablecards. Empty states: one clean line, no zero-cards.
- Stale Roadmap card deleted from Settings.

## 2. Desktop features
- Export: CSV per table (backup-compatible write path), PDF snapshots via textPdf; Export button
  in the Money topbar and print stays CSS-only for paper.
- Fuel station finder on desktop: Overpass pumps near home city, favorites first, cached,
  Google Maps route link (opener url), saved into db.stations (syncs). CSP allow-list:
  connect-src https://overpass-api.de.
- Drag-drop: folders recurse; every PDF/image attaches; backup .json replaces.
- Saved views generalized: Travel + Media get named views like Money/Papers.

## 3. Phone
- Widgets follow Material-You dynamic color on Android 12+ with fallback palette.

## 4. Infra
- cargo test (sync_server.rs) runs in CI before tauri build.
- Signed updater: keys generated, GH secrets attempted; if scope is denied the updater waits.

## Cross-cutting
- Bullets Fixed/Added/Changed; one PR = one version; guardrail files untouched.
- Changelog may not claim multi-window or updater unless both ship for real.
