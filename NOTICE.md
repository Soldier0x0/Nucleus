# Nucleus — third-party notices

Nucleus is Copyright (c) 2025–2026 Sai Harsha Vardhan and is distributed under the
MIT license (see `LICENSE`). Third-party code, fonts and data bundled in the
published APK and desktop installers keep their own licenses and notices:

| Component | Where | License |
| --- | --- | --- |
| Inter typeface (bundled TTFs) | `frontend/assets/fonts/Inter-*.ttf` | SIL Open Font License 1.1 — text in `docs/licenses/OFL-Inter.txt` |
| JetBrains Mono typeface (bundled TTFs) | `frontend/assets/fonts/JetBrainsMono-*.ttf` | SIL Open Font License 1.1 — text in `docs/licenses/OFL-JetBrainsMono.txt` |
| Material Design Icons (font package) | npm `@react-native-vector-icons/material-design-icons` | Apache License 2.0 / Pictogrammers Free License |
| React, React DOM, React Native | npm | MIT |
| Expo SDK and modules | npm `expo-*` | MIT |
| Tauri framework, plugins and CLI | npm/Cargo `@tauri-apps/*`, `tauri*` | MIT OR Apache-2.0 |
| @noble hashing/ciphers/curves | npm, used on phone and desktop | MIT |
| qrcode-generator | npm/qrcode-generator 1.4.4 | MIT |
| date-fns, dayjs | npm | MIT |
| TanStack Query | npm `@tanstack/react-query` | MIT |
| pdf.js | npm `pdfjs-dist` | Apache License 2.0 |
| Rust ecosystem crates (blake2, base64, rusqlite, notify, etc.) | `desktop/src-tauri/Cargo.lock` | MIT / Apache-2.0 per crate; human-readable summaries ship with every Cargo registry download |
| Open-Meteo weather + air-quality data | fetched only while Online is ON | CC BY 4.0, credited in-app under Settings → About |
| Frankfurter currency rates | fetched only while Online is ON | Open data via the European Central Bank, app credits in Settings → About |

Full dependency inventories live in `frontend/package.json`,
`desktop/package.json` and `desktop/src-tauri/Cargo.lock`; every released
build can be reproduced from those lockfiles.

## Repository agent tooling (not shipped in any build)

`.opencode/skills/` holds agent SKILL.md files vendored from upstream
repositories at the pinned revisions below. They are developer-facing docs and
are not bundled into the APK, the installers or the web documents viewer:

| Skill(s) | Source (MIT, pinned revision) |
| --- | --- |
| apple-design, animate, animate-expo, find-animation-opportunities | github.com/emilkowalski/skills @ `2d228630ba14` (`skills/<name>/`) |
| design-review | github.com/garrytan/gstack @ `514fbfdc9799` (`design-review/`) |
| wcag-audit-patterns | github.com/wshobson/agents @ `0874a27b17a2` (`plugins/accessibility-compliance/skills/wcag-audit-patterns/`) |

Installed 22 October 2026; re-vendor from upstream when updating.
