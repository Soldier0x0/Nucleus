# Changelog

Android releases stay under 1.0: v0.1, then v0.2, and so on. Each published version has one section below, newest first. Add a new `## v0.N` section at the top when that version is ready. A later version does not need a section yet.

Each section is short bullet points of what that version added or changed. The Android workflow builds the APK either way. It publishes a GitHub Release only when the section for that version has those points. A note that only says the app is the same as the previous one is not published, and the notes step fails. A missing section does not fail the build and does not publish. An empty section fails.

A republished app is allowed only when the points name the file, say that nothing in the app changed, and say why the release exists.

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
