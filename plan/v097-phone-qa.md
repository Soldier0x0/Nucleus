# v0.9.7 phone QA checklist (PR #36)

Install the APK artifact from the latest PR #36 Actions run. Mark each item pass or fail.

## Guarded: v0.9.6 lock and v0.9.5 PDF
- [ ] Lock on. Leave the app longer than the timeout, come back: it asks for the PIN or biometric.
- [ ] Screen off, then on: it relocks.
- [ ] Restart from the launcher icon: the lock overlay shows.
- [ ] Take a screenshot while unlocked: the overlay still works afterwards.
- [ ] Biometric cancel or error: the app stays locked (fails closed).
- [ ] Insurance sample PDFs A and B open from the vault, and still open after a full app restart.

## Restore and onboarding
- [ ] H1: Settings, Restore a backup made on another phone. Merge is blocked and the file opens read-only.
- [ ] After any Restore: the lock setting, unlock method, biometric, module locks and install id stay the same.
- [ ] H2: Onboarding, set a PIN, then Cancel. Lock stays off and the next screen does not skip lock setup.
- [ ] L3: Onboarding with a backup from another phone shows "This phone will be read-only for this file."
- [ ] H3: Settings, delete a profile. A confirm appears first.
- [ ] H4: Settings, Erase with no PIN set. A confirm appears and Cancel keeps all data.

## Delete confirms (each one: a confirm sheet appears, Cancel keeps the item, Confirm removes it and shows a toast)
- [ ] H5: Money Plan, jar, debt and snapshot.   - [ ] H6: Builder, delete a tool (from the list and from the edit sheet)
- [ ] H9: Home bill.   - [ ] H10: Kanban, rename and delete a board.   - [ ] H11: Wiki page
- [ ] H12: Home appliance.   - [ ] H13: Media item.   - [ ] H15: Money, remove a bank-account ending
- [ ] M19: Record, remove a photo or bill file (the record itself stays).
- [ ] Subscription, Delete subscription (this crashed before fix 1b50aa7)
- [ ] No confirm opens inside another sheet: the parent sheet stays behind it and nothing freezes (Android Modal bug).

## Logic fixes (also covered by unit tests)
- [ ] H7: Builder, add inputs a, b, c, delete b, add one more. The new input gets a new short name. Typing a duplicate name blocks Save.
- [ ] Builder, edit a tool, then back out. "Discard changes?" appears.
- [ ] M10: Tools, Time, clear the end time. It shows "Enter both times as HH:MM" and no duration.
- [ ] M20: Fuel record, clear the date and save. The date is unchanged, not "—".
- [ ] L7: Budget, set a category to 0 and save. The toast says "Budget cleared".
- [ ] H14: Cycle, saving without changes shows no toast.

## The rest of the punch-list
Walk through M1–M25 and L1–L9 using plan/audit-punchlist.md.
