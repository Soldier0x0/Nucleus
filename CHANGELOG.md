# Changelog

Android releases stay under 1.0: v0.1, then v0.2, and so on. Each published version has one section below, newest first. Add the next version as a new `## v0.N` section at the top. Leave older sections as they were published.

The Android workflow copies that section into the GitHub Release. The build stops before Gradle if the section for the next version is missing or empty.

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
