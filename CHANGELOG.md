# Changelog

Android releases stay under 1.0: v0.1, then v0.2, and so on. Each published version has one section below, newest first. Add that version as a new `## v0.N` section when its pull request is ready. One pull request documents one version, the one it publishes. Do not add notes for a later version to keep the next build from failing.

Each section is short bullet points of what that version added or changed. A release is published only when a green APK exists and this file has those points for that one version. A missing section does not fail the build and does not publish. A note that only says the app is the same as the previous one is not enough. A change that is only docs, this file, or the README does not build an APK.

## v0.4

A private cycle calendar on this phone.

- One calendar. Large day cells, a buddy picture at the top, and the next window as one line. Flow, symptoms, and stash are one level down.
- Started today and Ended today are one tap. Spotting does not start a new cycle.
- The window is a guess: a 28-day placeholder until two of her own cycle lengths exist, then the middle of those lengths. It widens when recent cycles disagree. A gap longer than about 90 days is left out.
- A reminder title is only the buddy name and “needs attention”. No date, no flow, and no emoji on the lock screen.
- The decoy PIN hides the calendar, the buddy name, and the picture.

## v0.3

The app on the phone is the same as v0.2. Nothing in the app changed after that APK. This release is the build that can finish once these notes exist.

## v0.2

The app on the phone is the same as v0.1. This release only changes publishing.

- Every release includes the notes from this file.
- A build stops if those notes are missing.

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
