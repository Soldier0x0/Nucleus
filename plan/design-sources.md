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
