# Changelog

Android releases stay under 1.0: v0.1, then v0.2, and so on. Each published version has one section below, newest first. Add a new `## v0.N` section at the top when that version is ready. A later version does not need a section yet.

Each section is short bullet points of what that version added or changed. A release is published only when a green APK exists and this file has those points for that one version. A missing section does not fail the build and does not publish. An empty section fails. A note that only says the app is the same as the previous one is not published, and that check fails. The job stays on the free GitHub runner, reuses the Gradle cache, and does not build an APK when a change is only docs, this file, or the README. A green pull-request build is the APK that gets published, so a merge does not compile that same git tree again.

One pull request publishes one version. That version is the only one it may document. It may be a version such as v0.5, or a sub-version such as v0.5.1, and it is still only one of them. Do not add notes or a tag for a later version to keep the next build from failing. The workflow fails if this file has a section for any other version that has not already shipped.

A republished app is allowed only when the points name the file, say that nothing in the app changed, and say why the release exists.

From v0.8.3 on, write each bullet as a short line: Fixed …, Added …, Changed …, or I fixed … / I added … / I changed …. Concrete, the way a developer would say it.

## v0.9.1

- Added image and PDF attachments on papers with an in-app viewer that works offline from the stored URI.
- Changed Vehicle and Travel into separate home boards: fuel, mileage, cost per km, and vehicle docs stay on Vehicle; metro, train, cab, and bus spend stay on Travel.
- Added vehicle document tiles for motor policy (comprehensive XOR third-party), personal accident, PUC, and roadside assistance only when the add-on is marked.
- Added a Health home board with Cycle, water reminders, and stash summary; Cycle moved off the Home board.
- Changed install-over migration so bike-only Travel users land on Vehicle without wiping data.
- Added tests for transit spend separation, motor XOR, and paper expiry helpers.

## v0.9

- Changed home pills so a board stays hidden when its module is off.
- Changed Capture so search and the line sit side by side, and the hint types itself.
- Changed fuel capture so litres, total, and rate can sit in any order, and only a named vehicle becomes a fuel entry.
- Added soft follow-ups when a fill still needs the odometer, date, or station.
- Added a soft note when a change timer runs past its usual time and the bag is empty.
- Changed tiles so a pair matches height and a long name keeps the full row.
- Changed Attention so snooze offers 1, 3, 7, 15, and 30 days, and a long list can show more.
- Changed erase so it asks for the PIN or biometrics again.
- Changed currency to one alphabetical picker.
- Added Cycle on the first-run module list.
- Added a buddy intro you can edit or skip.
- Added discs, period underwear, a home stash and a bag, and a pack size on restock.
- Changed appliance icons.
- Changed tile drag so the page follows your finger.
- Changed each appearance into a fuller skin. Paper stays the default.
- Added a longer sample cycle history.

## v0.8.3

- Fixed the home pills so the selected one scrolls into view when you swipe boards.
- Changed release notes to plain Fixed, Added, and Changed lines.

## v0.8.2

Phone Lab and Tools fixes, a softer cycle, a Blush skin, and water reminders.

- Repeating bills ask for a due date. The touch box stays still when you hold it. Vibrate uses a buzz you can feel. Make and model use title case. Tools open as tiles. Cooking and date units open a list. Dice, a coin, and a number take a short moment to land. Display test checks for Dead pixels. Battery shows cycles, health, temperature, and voltage when the phone reports them.
- Cycle shows a range and says how sure that guess is. Symptom chips can include a name you add. A doctor report stays on screen and can be saved as a PDF or a long image. The name is initials unless you choose the full name. Visit notes cite published ranges and do not diagnose.
- Blush is a soft pink skin for pills, tiles, and sheets. Cycle can use a pink calendar, and cycle reminders can use a pink tint. Other reminders stay as they are.
- Privacy and usage says what needs a connection and what never leaves.
- Health has water reminders at the times you set. It does not track glasses.

## v0.8

A documents board, a repeating bills board, and a heading on Travel.

- Documents is its own home board for papers and files kept in Nucleus: IDs, insurance, and trip docs. A missing paper is named, such as Travel insurance. Short cards sit two-up. A fuller card keeps the full row. Paper, with bento and cards, stays the default unless a look or layout was already chosen. Those papers stay in the encrypted file on this phone.
- Repeating bills is its own board for rent, an EMI, a subscription, and similar charges. Due, paid, and snooze stay ordinary reminders. One-off expenses stay on the money board.
- Travel has a Heading tile beside packing. It shows which way the top of the phone faces, and opens that compass in a card. It uses the magnetometer and stays on this phone.

## v0.7.4

A tile can be small or wide, and holding it still rearranges the board.

- Hold a tile and drag it up, down, or side to side. The home board rearranges, a short tap still opens the tile, and the motion stays smooth.
- Drag a corner to make that tile small or wide. Small tiles sit together on a row. A wide tile keeps the full row.

## v0.7.3

Hold a tile to rearrange the home board.

- Hold a tile, then move it. The tile under your finger is where it lands, and the home board rearranges.
- The tile follows your finger, and the motion stays smooth.

## v0.7.2

The earlier home cards, circle swipe, and a screenshot that stays unlocked.

- Paper, with bento and cards, stays the default for a new install and an update, unless a look or layout was already chosen.
- Home cards use the earlier icons and the earlier type. A small label such as Attention or Weather, a large figure, and urgent, upcoming, and info counts.
- Short cards sit in two columns. A card with more information keeps a full row. A tile sizes itself to what it shows. A long press resizes that one tile, and the motion stays smooth.
- A screenshot on an unlocked phone does not ask for a PIN or the thumbprint.
- Swipe goes through every home board in a circle, and the last board wraps to the first. The timeline and the money month swipe as well.
- Privacy and usage says what stays on the phone, what each permission is for, and what never leaves.

## v0.7.1

Fixes for leftover sample data, the home cards, and bank texts.

- Remove sample data is next to Add sample data. It clears leftover demo rows, including Activa fuel and service notes, the 45000 demo budget, and unnamed two-expense lines, even when the sample list is empty. Entries you added stay.
- The default look is Paper. The default layout is bento and cards. A new install and an update both get that, unless a look or layout was already chosen.
- Home cards use the earlier icons and show the useful figures. Attention shows its count. A saved home city shows the forecast on the Weather card. Each card opens its own place, and Weather opens the weather section.
- Bank texts save lines from Google Pay, PhonePe, and bank notifications once notification access is on. A file install needs Allow restricted settings first, then notification access. Nucleus reads those notifications, not SMS, and does not turn the permission on.
- A real icon change may still restart the app. An unlocked phone does not ask for the thumbprint or PIN after that restart.

## v0.7

Home, travel, money, and the cycle calendar.

- Leftover Activa fuel and service money copies are removed even when the sample list is empty and the Activa is already gone. Notes such as "Activa · 5.6 L" and "Activa · Engine oil" go. Income, other expenses, and your own bike stay. The 45000 demo budget is put back to the budget from before the demo. A repeated expense names its note.
- Every home board swipes in a circle, and the last board wraps to the first. Every board has two columns. A card with more information keeps a full row. A module turned off in Modules is hidden on the home screen. The records stay.
- Public transport is its own trip, with metro, train, cab or taxi, and bus. Weather can ask once for location, read it, then stop. The app cannot turn the phone's location switch on or off.
- Money shows the category that grew the most, this month versus last month. A personal vehicle shows cost per kilometer, fuel against the tank, and the km left before service.
- After two of your own cycles, the calendar shows your typical length and how this one compares. The forecast stays labeled a guess. A receipt that does not match the bank debit is flagged. Before a trip, if no weather is saved, one reminder asks you to save it. Stops you marked on a previous trip can be used again.
- The cycle calendar lets you enter past period dates and remembers them. Images and bills swipe, with a gallery, including when one image is open.
- Privacy and usage says what stays on the phone, what each permission is for, and what never leaves.
- A real icon change still restarts the app. An unlocked phone does not ask for the thumbprint.
- A tap on the bottom bar uses a smaller, shorter splash, so it does not leave a large slow circle.
- The bank-texts switch opens notification access and says to turn Nucleus on. If Android blocks that screen, allow restricted settings from the Nucleus app info menu first. The app does not turn the permission on by itself.

## v0.6.3

The lock, the emergency card, the locked file, and bank texts.

- Changing the home-screen icon restarts the app. The phone stays unlocked across that restart, so the thumbprint is not asked. A locked phone, or a full close of the app, still asks. Tapping the same icon still leaves it alone.
- The emergency card shows on the lock screen before the PIN: blood group, phone number, and the plate of the default vehicle. It shows only while Show on the lock screen is on. Turning that on asks for notification permission.
- Sign in and store this file signs in to Drive or OneDrive, whichever is already chosen, and uploads the locked file. If sign-in or the upload does not finish, the screen says so.
- Bank texts are read from the bank app's own notifications on this phone. Turning the switch on asks for notification access. If that access is denied, the switch stays off and the screen says why. Codes are dropped. An unclear text asks once and is remembered. A transfer between your own accounts is not spending.
- Bank and UPI notices treat paid, sent, and spent the same as debited, and received and added the same as credited. A balance line stays a balance. Codes are still dropped. An unclear text still asks once and is remembered.
- Sample data can be removed on its own. Expenses and other entries you added stay.
- Dismissing a reminder clears it and does not open the app. A service interval, a bill that is due, fuel that is short, and a backup that has not synced are ordinary reminders. The emergency card stays only while its switch is on.
- A short swipe on Attention snaps back. A long pull snoozes or marks done. Done, Paid, snooze, and Why stay. The Bedroom AC line no longer says overdue.
- About shows the version installed on this phone. This release is 0.6.3. A later release shows the version stamped into that APK.
- A missing trip document is named, such as Travel insurance. Several missing documents are named. A short packing list names the items still unpacked. If the app cannot tell what is missing, it says so.

## v0.6.2

Money and Travel each show their own board.

- Tapping Money shows only money tiles: balance, spending, charts, receipts, bills, and the rest of that board. Tapping Travel shows only driving tiles: route, mileage, fuel, papers, vehicle, service, range, stops, weather, and packing.
- An empty tile stays visible, and its title is that tile's own name.
- Tapping the home-screen icon leaves the current picture in place. A still-unlocked phone stays unlocked. The thumbprint is asked after the phone was locked, or after the app was fully closed.
- Money and Travel swipe between two different boards. Opening Travel starts on the travel tiles. Opening Money starts on the money tiles.
- Money, Travel, and Home do not show the dashed Customize home box.

## v0.6.1

Presets, the home-screen mark, and looks show up on the phone.

- Money, Travel, Home, Custom, and the other boards show their tiles even when there is no data yet. An empty tile is the placeholder. Switching still does not delete anything.
- The home-screen mark fills the circle Android masks. The ground stays opaque.
- A look changes type, corners, and spacing on the home screen. Glass frosts the cards. Bento makes each tile full width.

## v0.6

A private desk on this phone for money, trips, and the next cycle window, in one locked file.

- The home-screen mark fills the circle. Android still masks the icon.
- The lock asks after the phone was locked, or after the app was fully closed. Switching away and back does not ask.
- Turning on a lock-screen alert or the emergency card asks for that permission, and the card can show on the lock screen.
- Bank texts stay on the phone. Debits, credits, and balances are kept. Codes and other texts are dropped.
- An unknown sender, an unclear category, or a possible transfer between your own accounts asks once, then remembers.
- Money shows the month in and out, a category split, and balance over time.
- Repeating bills, a reminder the day before, a price change, cash, and a yearly money export.
- A receipt is cropped to the page. The amount, date, and shop are read from the words on the phone and confirmed before they count.
- One encrypted file holds money, cycle, notes, settings, and trips. Start fresh or bring a file in. The app says what is in the file before it replaces anything.
- An optional copy of that locked file can go to your own Drive or OneDrive. It stays off until you choose it. A second phone can open the file read-only.
- Glass and Bento sit on the existing looks, and on Paper, Midnight, Dune, and AMOLED.
- A home-screen widget shows the next cycle window. The notification shade has no dates.
- Search covers your notes, money, cycle, and trips.
- Records that share a date or an amount can be linked.
- Trips have a timeline, weather when online, stops you mark, a range warning, and a service interval from the vehicle's own kilometers.
- The cycle window still comes from your own dates.
- The decoy PIN hides cycle and money.
- The greeting names the one thing due today.
- One stop or one bill can be handed to one person.
- Home presets rearrange the main screen. Money and Travel swipe between two screens. Empty modules stay hidden. Nothing is deleted when you switch.
- ADHD mode shows one next action in plain type. The timer counts time spent. A day with nothing finished is a break. Motion and the buddy stay off until you turn them on.
- One quiet heads-up at a time, from data already on the phone. Dismissing it has no penalty. Other alerts wait while ADHD mode is on.
- A new name starts as Harsha.
- Bikes use a bike mark. Cars keep a car mark.
- Dragging a module opens a gap where it will land.

## v0.5

Looks you can see, on the colors you already have.

- Current stays the default and looks the same as before.
- Soft is rounder, with slightly larger type and more space between rows.
- Tight is sharper and closer.
- Plain is big type, with very little decoration.
- Cards keeps those same shapes and adds a soft shadow.
- Ink, Signal, and Poster are livelier, and they stay readable.
- Two tones can sit on any look. The background keeps the color set. Type, buttons, and marks use a second color.
- Paper, Midnight, Dune, and AMOLED still work with every look.
- A release is published only when its notes are short bullet points of what that version added or changed.
- One pull request documents only the version it publishes. It does not add notes for a later version.

## v0.4

A private cycle calendar on this phone.

- One calendar. Large day cells, a buddy picture at the top, and the next window as one line. Flow, symptoms, and stash are one level down.
- Started today and Ended today are one tap. Spotting does not start a new cycle.
- The window is a guess: a 28-day placeholder until two of her own cycle lengths exist, then the middle of those lengths. It widens when recent cycles disagree. A gap longer than about 90 days is left out.
- A reminder title is only the buddy name and “needs attention”. No date, no flow, and no emoji on the lock screen.
- The decoy PIN hides the calendar, the buddy name, and the picture.

## v0.3

- The file is nucleus-v0.3.apk.
- Nothing in the app changed from v0.2. Icons, money, and the greeting are that same app, with the version name stamped 0.3.
- This release exists because the Android job would not finish until a v0.3 section was in the changelog.

## v0.2

- GitHub release notes are copied from this file.
- The Android job stops before the APK build when the section for that version is missing or empty.
- The release tag points at the commit that was built.
- nucleus-v0.2.apk is the v0.1 phone app: home-screen icons, money words, CSV export, and the greeting name.

## v0.1

First published APK. It includes the life desk, widgets, packs, kanban, and wiki already on main.

- Settings can change the home-screen icon. Paper press is the default.
- Metal ring, Glass core, and Tiles, each on Paper, Midnight, Dune, and AMOLED.
- Match my theme follows the app theme. The lock-screen mark uses the same choice.
- Money: Other can take an optional name. A blank name stays Other.
- A fixed word list files breakfast, lunch, samosa, carrots, concerts, accidents, and similar words, and keeps the item, so a month can show carrots separately under Groceries.
- Suggestions appear while typing. Unknown words are left alone.
- Transactions export to a CSV for this month, the past 30 days, the past 60 days, or a custom range. The file stays on the phone.
- Today can greet you by name. The name is asked during PIN setup, and once after an update if it is missing.
- The name is stored only in the open document. A decoy PIN shows the greeting with no name.

Not in this build: flashcards, SMS or bank inbox reading, health formulas, water or fasting clocks, and motion sensors.
