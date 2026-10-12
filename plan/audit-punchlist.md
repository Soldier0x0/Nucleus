# Nucleus — First-Run Module Audit (Track 1)

**Method:** four parallel code audits walked every module's create → use → delete
path as a brand-new user, hunting dead buttons, dead-ends, missing empty-states,
and data-loss risks. Findings are ranked by user impact. Every item has file:line,
severity, and a one-line fix. **No code changed yet** — this is the punch-list to
work from.

Severity: **HIGH** = data loss or a broken core flow · **MEDIUM** = dead-end,
silent no-op, or confusing state · **LOW** = polish.

---

## Confirmed owner-reported issues (Money)
- **"Check bank texts" always says 0** — `MoneyDesk.tsx:141`. Not a no-op, but the
  mount effect (`MoneyDesk.tsx:69-72`) and `BankTextSync.tsx:120-132` already drain
  the queue (native `drain()` deletes on read), so the manual button always reports
  "0 kept, 0 dropped" with no explanation. MEDIUM.
- **Can't delete saved bank-account endings** — `MoneyDesk.tsx:134-140` appends to
  `db.settings.ownAccounts`, renders as text, no remove UI anywhere. A wrong ending
  mis-classifies transfers forever. HIGH.
- **Budget flows** — REFUTED, budgets save/update correctly. Only polish gaps.

---

## HIGH — data loss / broken core (fix first)

| # | Where | Problem | Fix |
|---|---|---|---|
| H1 | `settings.tsx:772` (+`vaultFile.ts:42`) | Backup **"Merge"** from another phone silently **replaces** everything (`readOnly` skips merge, falls to `replace()`), but the button says "Merge" and Merge is the default. | When `readOnly`, disable/hide Merge or show a "This replaces everything" confirm. |
| H2 | `onboarding.tsx:351` (+`PinPad.tsx`) | Inline PIN pad has **no cancel**; both exit buttons disabled during entry. A first-timer who opens it by mistake is trapped (must force-quit). | Render a "Cancel" ghost button whenever `pinStage` is active. |
| H3 | `settings.tsx:304` (+`store.tsx:295`) | **Delete profile** is one tap, no confirm; `storage.removeItem(profileDocKey)` wipes every record with no undo. | Confirm sheet naming the profile + record counts before `deleteProfile`. |
| H4 | `settings.tsx:926` | **"Erase all data"** is a dead-end with no PIN/biometric (onboarding allows skipping PIN) — button does nothing forever. | Fall back to a type-to-confirm ("type ERASE") when neither exists. |
| H5 | `money/plan.tsx:240,264,286` | **Delete jar / debt / snapshot** each delete instantly, no confirm, no undo; destroys payoff/net-worth history. | Confirm sheet (match `record/[kind]/[id].tsx:178`) for each. |
| H6 | `builder/index.tsx:74,207` | **Delete custom tool** (list + edit sheet) destroys it in one tap, no confirm; edit-sheet delete sits next to Save. | `Alert.alert` confirm before the `update`. |
| H7 | `builder/index.tsx:161` | **Duplicate input keys**: `String.fromCharCode(97+len)` re-issues a key after a delete → two fields share one value; formula silently uses the last. | `uid()`/counter for keys; block save on duplicate keys. |
| H8 | `lab/index.tsx:293` | **"Stop · samples" toasts "N exported"** but CSV export is web-only → recording silently discarded with false confirmation. | On native, write CSV via file-system/share, or toast "discarded — export is web-only". |
| H9 | `HomeLife.tsx:111` | **Utility bill has no delete** (only "Edit last"; `deleteEntity` has no `utility` kind). A mistyped amount skews the estimate forever. | Add "Delete bill" filtering `d.utilities` by id. |
| H10 | `kanban/index.tsx:28,37,71` | **Board can't be renamed or deleted** — a typo'd board name is permanent. | Add rename/delete to the board card/header. |
| H11 | `wiki/index.tsx:94` | **Delete page** wipes the whole body in one tap, no confirm, no toast. | Confirm sheet naming the page title. |
| H12 | `home/index.tsx:159` | **Delete appliance** removes it + maintenance plans + history in one tap, no confirm/toast. | Confirm sheet listing what's removed. |
| H13 | `media/index.tsx:203` | **Remove from shelf** deletes item + review in one tap, no confirm/feedback. | Confirm + toast. |
| H14 | `cycle/index.tsx:138` | **"Remember these dates"** always toasts "Saved", but `rememberPeriod` silently no-ops on empty/invalid input → false success. | Toast only on real change; else "Check both dates". |
| H15 | `MoneyDesk.tsx:134` | **Can't delete/edit saved bank endings** (see above). | Remove chip per ending + toast on failed save. |

---

## MEDIUM — dead-ends, silent no-ops, confusing states

| # | Where | Problem | Fix |
|---|---|---|---|
| M1 | `VehicleSheet.tsx:54` | Invalid odometer → `save()` clears error and silently vanishes, discarding the whole form. | `setErr("Enter a valid odometer")` instead of `setErr(undefined)`. |
| M2 | `papers/index.tsx:142` | **Remove person** deletes with no confirm (only unconfirmed destructive action in papers); leaves dangling `personId`. | Confirm sheet or toast+undo. |
| M3 | `bills/index.tsx:47` | **"Due" button** is a literal no-op on fresh bills (`setBillMark` early-returns; no attention entry). | Hide/disable unless snoozed/paid, or make it a real remind action. |
| M4 | `bills/index.tsx:41` + `MoneyForms.tsx:158` | **Bills/subscriptions have no delete or edit** — only pause/resume. A mis-added bill is permanent. | Add "Delete bill/subscription" (confirm) to the edit sheet. |
| M5 | `lab/index.tsx:103` | Leaving Phone Lab mid-recording **discards the capture** with no warning. | Prompt "Stop and keep samples?" on unmount/back. |
| M6 | `tools/index.tsx:94` | **"Clear history"** bulk-deletes all saved results, no confirm, and is the only way to remove one junk row. | Per-row delete + confirm on bulk clear. |
| M7 | `builder/index.tsx:106` | Closing the edit sheet **discards unsaved edits** with no warning. | "Discard changes?" confirm when dirty. |
| M8 | `tools.tsx:38` | Calculators keep **Copy/Save enabled when result is "—"** → copies an em dash / saves junk. | Disable actions when no valid result. |
| M9 | `tools2.tsx:239` | Decide/Teams "Randomise" with empty options does nothing, no message. | Inline hint + disable when list is empty. |
| M10 | `tools2.tsx:94` | Empty time field → duration computed as 00:00 ("Crosses midnight: Yes"). | Validate HH:MM; show "Enter both times". |
| M11 | `dev/index.tsx:177` | "Hash it" runs on empty input → hashes empty string (looks broken). | Disable when input is blank. |
| M12 | `kanban/index.tsx:94` | **Delete card** one tap, no confirm/toast. | Confirm or toast. |
| M13 | `cycle/more.tsx:179` | **"Clear"** wipes the whole day's log (flow/symptoms/changes), no confirm. | Confirm before clearDay. |
| M14 | `health/index.tsx:61` | **"Add reminder"** silently no-ops on duplicate time or 9th item, no message. | Toast the reason. |
| M15 | `TripDesk.tsx:73` | **"Hand this stop to someone"** no-ops until a name is typed; never disabled. | Disable when person is blank. |
| M16 | `cycle/more.tsx:220` | **"Add symptom"** silently no-ops on empty/duplicate/cap. | Toast the reason. |
| M17 | `wiki/index.tsx:34` | Tapping a wiki link to a missing page **immediately creates an empty page** (typos leave junk). | Create only on save, not on chip tap. |
| M18 | `kanban/index.tsx:111` | **"Move to next column"** wraps Done→To-do; label doesn't say where. | Disable in last column or label the target. |
| M19 | `record/[kind]/[id].tsx:124` | **Remove bill / remove photo** detach immediately, no confirm (unlike the record's own Delete). | Gate behind the same confirm sheet. |
| M20 | `record/[kind]/[id].tsx:170` (+`fuelCapture.ts:166`) | Clearing the fuel DateField writes an empty date → renders "—", breaks ordering/insights. | Only set date when fuelDate is truthy. |
| M21 | `settings.tsx:558` | **Add/Remove sample data** mutate the live DB on one tap, no confirm; remove uses fuzzy heuristics. | Confirm with row counts first. |
| M22 | `settings.tsx:282` | **Switch profile** swaps the whole workbench on one press with no warning that current records vanish. | Confirm "Switch to X? records hidden until you switch back." |
| M23 | `papers/view.tsx:44` | Deleting a paper from the detail sheet leaves "Document not found" (no auto back). | Navigate back on delete. |
| M24 | `VehicleJourneySection.tsx:55,67` | Timed-odo / End-journey Save silently no-op on invalid input. | Toast "Enter a valid odometer". |
| M25 | `money/plan.tsx:210` | "Add money" no-ops on empty/invalid amount; button never disabled. | Disable unless amount > 0. |


---

## LOW — polish

| # | Where | Problem | Fix |
|---|---|---|---|
| L1 | `settings.tsx:302` | Rename with empty input silently does nothing. | Disable when blank. |
| L2 | `attention.tsx:129` | "See more" has no "See less". | Toggle + flip label. |
| L3 | `onboarding.tsx:76` | Foreign-phone backup silently sets read-only; gate doesn't say so first. | Note it before committing. |
| L4 | `MoneyDesk.tsx:117` | Remove saved category name: one tap, no confirm. | Confirm or undo toast. |
| L5 | `MoneyExport.tsx:40` | If sharing unavailable, CSV written but nothing shared/toasted (silent). | Clipboard fallback + toast. |
| L6 | `MoneyDesk.tsx:109` | "Hand bill to someone" no-ops until a name is typed. | Disable when person blank. |
| L7 | `MoneyForms.tsx:181` | Budget save silently drops 0-limits / resets monthly to 0. | Warn when values are being removed. |
| L8 | `lab/index.tsx:96` | Switching sensor mid-recording mixes axes in one CSV. | Clear recording on chip change. |
| L9 | `media/index.tsx:152` | Save never disabled; empty title becomes "Untitled". | Disable when title blank. |

---

## Suggested fix order
1. **Safety batch (HIGH, destructive):** H1–H15 — confirmations + the backup-Merge
   lie + onboarding trap. Biggest public-launch risk (data loss / lost trust).
2. **Dead-end batch:** H9, H10, M4, M2 — add the missing delete/edit/rename paths.
3. **Silent no-op batch:** M8–M11, M14, M16, M24, M25, H14, H8 — every button that
   lies or does nothing gets feedback or a disabled state.
4. **Polish (LOW)** as capacity allows.

**Owner impact note:** the two flows the owner uses daily (fuel logging, documents)
are otherwise solid — the only real defects there are M1 (silent vehicle-save
failure) and M2 (unconfirmed person removal). The Money module's dead-ends
(H15, M4) match the owner's own stuck points and should lead batch 1.

