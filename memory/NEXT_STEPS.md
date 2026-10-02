# Nucleus — Handoff Plan for the Next Agent

Read this first, then `/app/memory/PRD.md` and `/app/docs/NUCLEUS_DESIGN*.md`.
The user approved the full "Nucleus v2" plan; only a subset is built (see PRD "v2 — Nucleus").
Build the remaining items **in the order below**, testing each batch with `testing_agent`.

## 0. Ground rules / conventions (must follow)
- Frontend-only, local-first. All data lives in one document `DB` (`src/core/types.ts`) persisted by `src/core/store.tsx` (key `nucleus.db.v1`; migrates `tessera.db.v1`). Backend is a stub — do NOT move data to the server.
- Add fields to `DB`/`Settings` in `types.ts`, defaults in `src/core/defaults.ts` (`emptyDB`, `defaultSettings`); `normalizeDB` must keep old snapshots working.
- Domain logic = pure functions `(db) => db` (`src/core/actions.ts`, `src/core/domains.ts`). Cross-module effects go through `dispatch()` reactors or `links` (never import one module's screen into another).
- New entity kinds: add to `EntityKind`, `getEntity`/`deleteEntity` map (`actions.ts`), `describeRef` (`components/LinkedSection.tsx`), record redirect (`app/record/[kind]/[id].tsx`), search block (`src/core/search.ts`).
- New modules: manifest in `src/core/modules.ts` (`status: "available"`, `route`), add to `ModuleId` + `defaultSettings.modules`; tiles in `TileId`, `TILE_META`, `defaultSettings.tiles`, render in `app/(tabs)/index.tsx renderTile`.
- Attention rules: add to `attentionItems()` in `src/core/intelligence.ts` with a full `why` (summary, facts, rule, ranking) and an occurrence-based `key`.
- UI: use `src/components/ui.tsx` (T, Card, Button, Chip, ChipRow, Segmented, Amount, StatusBadge, EmptyState, Press), `inputs.tsx` (Field w/ unit, DateField, OptionSheet), `Sheet.tsx`, `charts.tsx` (Ring, Gauge, LineChart, MonthBars, Bar, Countdown), `WhySheet`, `Header`, `useToast`. Colors only from `useTheme()`; every interactive element gets a kebab-case `testID`; chip rows horizontal (`ChipRow`), `numberOfLines`/`minWidth: 0` on text in rows.
- Online calls only via `onlineFetch` (`src/core/online.ts`) + `useOnline()` so the Online switch and network log are respected.
- Install packages only with `yarn expo install <pkg>`. Never touch `metro.config.js`, `eas.json`, `.env` protected vars. Keep `app.json` id `com.nucleus.app`.
- Native-only features (notifications, sensors, widgets, FLAG_SECURE) must be flagged to the user as "needs installed build".

## 1. Security pack (highest priority — user's Next Action #1)
1. **Encryption at rest**: generate a random 256-bit key on first run, store in `secureStorage` (Keystore). Encrypt the serialized DB before `storage.setItem` (AES-GCM; check `expo-crypto` AES API for SDK 57 or add `@noble/ciphers` pure-JS). Decrypt on load; migrate plaintext automatically. Same for `nucleus.netcache.v1`.
2. **Unlock method choice**: Settings + onboarding Segmented `PIN | Biometric | Both`; PIN always set as hidden fallback. `LockGate.tsx` honors it.
3. **PIN back-off**: after 5 wrong PINs, wait 30s, doubling (persist attempts/until in secureStorage). Show countdown on lock screen.
4. **Profiles**: `profiles: {id,name,color}[]` index in plain storage; each profile = separate encrypted DB key `nucleus.db.<profileId>`. Switch in Settings (re-lock). Existing data = "Personal".
5. **Decoy PIN**: optional second PIN; unlocking with it opens a decoy profile pre-filled with `withSampleData`. No UI tells it apart.
6. **Per-module lock**: `settings.moduleLocks: ModuleId[]`; opening `/money` etc. requires PIN/biometric again (simple gate component in each module screen).
7. **Clipboard auto-clear**: wrap `Clipboard.setStringAsync` in a helper that clears after 60s for amounts.
8. **Encrypted backups**: password + strength meter in export sheet; PBKDF2/scrypt (`@noble/hashes`) → AES-GCM; restore asks password; add **Merge** option (by id, newer wins).

## 2. Rules & reminders (Next Action #2)
- `rules: Rule[]` {when: trigger, if: conditions[], then: actions[], enabled}. Triggers: date-relative (renewal/expiry/trip start within N days), threshold (budget %, km since service), event (fuel.added, expense added), battery level (`expo-battery`).
- Visual sentence builder screen `app/rules/index.tsx` (chips per clause).
- Actions: local notification (`expo-notifications`, request permission only on first reminder rule; native build note), add to Attention, create expense/task, open Board.
- Dry run: evaluate rule over last 90 days of txns/fuel/dates and show count before save.
- Quiet hours in Settings (no notifications 22:00–07:00 except urgent).

## 3. Boards + Notes & Lists (Next Action #3)
- `boards: {id,name,tiles:{id,size:'S'|'M'|'L'}[]}[]`; Today = default board; board picker chips on Today; edit mode with up/down + size.
- `notes: {id,title,body,checklist?:{id,text,done}[],links?:Ref[],pinned?}[]`; new entity kind `note`; module "Notes"; link a note to any record from LinkedSection ("Add note").

## 4. Year in Review + Timeline + Diagnostics
- `app/review.tsx`: horizontal paging story cards (km driven, fuel spent, top category, trips, items completed, streaks); amounts hidden by default; share as image via `react-native-view-shot` + `expo-sharing`.
- `app/timeline.tsx`: chronological feed of all entities (fuel, services, txns, trips, maintenance).
- Settings → Diagnostics: storage size per collection, netlog count, scheduled reminders, active sensors, recent errors.

## 5. Money expansion
- Sinking funds (jars with target/date, contributions), net worth snapshots (assets/liabilities, area chart), debts (balance, rate, payoff progress), multi-currency expenses everywhere (reuse `rates()`), month-end projection (spent ÷ month elapsed) on the budget card with Why.

## 6. Tools expansion
- Cooking converter + serving scaling, time calculator (+ time zones), growth (SIP/CAGR/compound/inflation), randomizer (dice, coin, cards, teams, weighted) + saved decision wheels, road-trip calculator (also in Travel).
- **Dev Tools** module: JSON format/validate, Base64, URL encode, JWT decode, UUID, hashes (`expo-crypto`), timestamp, regex tester, text diff, counts, whitespace cleaner, colour picker, snippets.
- **Custom Tool Builder**: inputs (number/money + unit), formula via a tiny safe expression parser (no `eval`), outputs, "send to Money"; tools stored in `customTools` and listed with built-ins.

## 7. Media shelf, Home extras, Phone Lab, accessibility
- Media: items {type, title, status, progress, rating, review, tags, cover from `expo-image-picker`}; poster grid with progress rings.
- Home: utilities (meter readings, bill trend + projected range), chores (recurring, assignee), room view.
- Phone Lab: `expo-sensors` live graphs (only while screen open), recorder → CSV/JSON export, compass, light, battery (`expo-battery`), device info (`expo-device`), display/touch/vibration tests; mic/camera tests ask permission on start; sound meter labelled "estimate".
- Accessibility: high contrast, large touch (scale controls), reduced motion (skip entering animations).

## 8. Exports
- CSV per module, ICS for renewals/expiries/itineraries, JSON per record — via `expo-file-system` + `expo-sharing` (web: Blob download).

## Known issues to fix along the way
- Overdue home maintenance item reported as not visible in the Attention list (check `homeSchedule` filter `days <= 7` + mark keys) — verify.
- REST Countries is skipped on web (CORS) — fine on native.
- Lint shows React-compiler "setState in effect" errors (non-blocking) in PinPad/LockGate.

## Testing
- Test credentials: `/app/memory/test_credentials.md` (PIN 1234, sample data via onboarding).
- Previous reports: `/app/test_reports/iteration_1.json`, `iteration_2.json`.
