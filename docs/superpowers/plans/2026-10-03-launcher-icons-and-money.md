# Launcher icons, money words, and a greeting name

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a person pick a home-screen picture, file spending with a fixed word list and a spreadsheet, and put their name on the Today greeting without showing it to a decoy PIN.

**Architecture:** Pure functions decide the icon alias, the money category, and the greeting. React screens call those functions. Android ships sixteen bitmaps as activity-aliases and enables one at a time. The call-me name stays inside the encrypted document.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, the `nucleus-android` Kotlin module, an Expo config plugin.

## Global Constraints

- Local-first. One encrypted document, `nucleus.db.v1`. No cloud records. No on-device model.
- Capture stays a fixed grammar. `450 food lunch` remains category Food, note `lunch`, amount 450.
- The decoy PIN copies appearance and the emergency card only. It must not reveal the real name.
- The call-me name is not written into the shared profile index.
- Flashcards are issue #5 only. Do not build them.
- Do not read SMS, do not store a bank balance, and do not add height, weight, sensors, water timers, or fasting clocks.
- Default launcher picture is Paper press on the paper ground.
- Install a newer same-signed APK over the existing app. Do not uninstall.

---

### Task 1: Money word list, item totals, and CSV

**Files:**
- Create: `frontend/src/core/moneyWords.ts`
- Create: `frontend/src/core/moneyWords.test.ts`
- Modify: `frontend/src/core/types.ts` (`Txn.item`)
- Modify: `frontend/src/core/capture.ts`
- Modify: `frontend/src/core/defaults.ts` (trim `item` on load)
- Modify: `frontend/src/components/MoneyForms.tsx`
- Modify: `frontend/app/money/index.tsx`
- Create: `frontend/src/components/MoneyExport.tsx`
- Test: `frontend/src/core/moneyWords.test.ts`

**Interfaces:**
- Consumes: `Txn`, `addDays`, `parseCapture`
- Produces:
  - `classifyMoney(text: string, type: "expense" | "income"): { category: string; item?: string } | null`
  - `moneySuggestions(text: string, type: "expense" | "income", limit?: number): { label: string; hit: MoneyHit }[]`
  - `categoryFromOther(typed: string): string`
  - `itemTotals(txns, category): [string, number][]`
  - `exportBounds(today, span, from?, to?): { from: string; to: string }`
  - `moneyCsv(txns, currency, from, to): string`

- [x] A known word files a category and, when the list has one, an item. `food` is Food with no item. `mario` returns null.
- [x] Suggestions need a token of at least two letters.
- [x] A blank Other name stays Other. A typed name, at most 40 characters, becomes the category.
- [x] CSV starts with a UTF-8 BOM and contains monthly totals, Monday-start weekly totals, then Date, Type, Category, Item, Amount, Note.
- [x] `450 food lunch` still saves note `lunch`. `40 samosa` saves Food / Snacks and note `samosa`.

### Task 2: Greeting name inside the document

**Files:**
- Create: `frontend/src/core/greeting.ts`
- Create: `frontend/src/core/greeting.test.ts`
- Modify: `frontend/src/core/types.ts` (`givenName`, `nameAsked`)
- Modify: `frontend/src/core/profiles.ts` (`shellSettings` does not copy `givenName`)
- Modify: `frontend/src/core/defaults.ts`
- Modify: `frontend/app/(tabs)/index.tsx`
- Modify: `frontend/app/onboarding.tsx`
- Modify: `frontend/app/(tabs)/settings.tsx`
- Create: `frontend/src/components/NameAsk.tsx`
- Modify: `frontend/src/components/LockGate.tsx`
- Test: `frontend/src/core/greeting.test.ts`, `frontend/src/core/personal.test.ts`

**Interfaces:**
- Consumes: `Settings.givenName`, `VaultSession`
- Produces:
  - `cleanCallName(raw: string): string`
  - `greetingLine(hour: number, name?: string): string`

- [x] Hour 0–11 morning, 12–17 afternoon, 18–23 evening. A name joins on the same line: `Good afternoon, Asha`.
- [x] Onboarding asks for the name. Finishing sets `nameAsked`.
- [x] An updated install with no name asks once after the lock screen is gone. Not now skips it.
- [x] Decoy data has no `givenName`. Today passes no name when the session is decoy.
- [x] The open profile chip shows the call-me name. The profile index is not rewritten with it.

### Task 3: Sixteen launcher pictures

**Files:**
- Create: `frontend/assets/launcher/*.png` (16)
- Modify: `frontend/assets/icon.png`, `frontend/assets/adaptive-icon.png`
- Create: `frontend/src/core/launcher.ts`
- Create: `frontend/src/core/launcherArt.ts`
- Create: `frontend/src/core/launcher.test.ts`
- Create: `frontend/plugins/withLauncherIcons.js`
- Modify: `frontend/app.json`
- Modify: `frontend/modules/nucleus-android/.../NucleusAndroidModule.kt` (`setLauncherIcon`)
- Modify: `frontend/src/native/android.ts` (`applyLauncherIcon`)
- Modify: `frontend/src/components/Mark.tsx`
- Create: `frontend/src/components/LauncherPicker.tsx`
- Modify: `frontend/app/_layout.tsx`, `frontend/app/(tabs)/settings.tsx`, `frontend/src/components/LockGate.tsx`, `frontend/app/onboarding.tsx`

**Interfaces:**
- Consumes: `ThemeKey`, `useColorScheme`
- Produces:
  - `resolveLauncher(choice, theme, scheme): { family, variant, alias }`
  - `launcherAlias(family, variant): string` such as `IconPaperPaper`
  - `markPalette(family, variant): { ground, ring, core, tick }`
  - `applyLauncherIcon(alias: string): void`

- [x] Families: paper, metal, glass, tiles. Grounds: paper, midnight, dune, amoled. Plus Match my theme.
- [x] Match maps paper, dune, and amoled to themselves. Midnight and graphite use midnight. System light uses paper; anything else uses midnight.
- [x] A fixed choice ignores the current theme.
- [x] The config plugin removes the launcher filter from MainActivity, adds sixteen aliases, and enables only `.IconPaperPaper`.
- [x] Kotlin enables the new alias before it disables the others, and does not disable MainActivity.
- [x] The lock-screen mark uses the same family and ground.

### Task 4: Verify

Run from `frontend/`:

```bash
node --experimental-strip-types --experimental-loader ./src/core/test-loader.mjs --test \
  src/core/moneyWords.test.ts src/core/greeting.test.ts src/core/launcher.test.ts \
  src/core/life.test.ts src/core/personal.test.ts src/core/openDb.test.ts src/core/roadmap.test.ts
yarn tsc --noEmit
```

Expected: every test passes, `tsc` prints nothing.

Android check, when the SDK is present:

```bash
cd frontend && npx expo prebuild --platform android --no-install
# restore package.json if prebuild rewrites the android script
cd android && ANDROID_HOME=$ANDROID_HOME ./gradlew :nucleus-android:compileDebugKotlin
```

Expected: sixteen aliases in the manifest, only `IconPaperPaper` enabled, MainActivity keeps VIEW and SEND, Kotlin compile succeeds. Do not commit `frontend/android` or `local.properties`.
