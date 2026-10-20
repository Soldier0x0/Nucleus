# Privacy — what leaves the device

Short version: your records never leave the device on their own. Nucleus has
no account, no server account system and no telemetry of any kind.

## Storage

- Everything — money, vehicles, trips, cycle logs, papers — lives in one
  encrypted document on your device:
  - Android: in the app's private storage.
  - Desktop: in your app-data folder, encrypted, keyed from your PIN
    (the PIN never leaves the device; the key store is a Stronghold snapshot).
- Backups are files you create and keep. An "export backup" writes a file you
  picked a folder for, with `write_export_file`, guarded to chosen extensions.

## Sync (phone ↔ desktop)

- Sync is peer-to-peer over your local Wi-Fi. The desktop runs a small local
  server that advertises on mDNS; the phone pairs by typing a code it shows.
  The vault travels directly between the two devices. Nothing is relayed
  through a server on the internet.

## Network requests

There is exactly one way records reach the internet: you switch **Online** on
in Settings (off by default). While it is on, Nucleus fetches:

- Weather, geocoding and air quality — Open-Meteo (CC BY 4.0).
- Currency rates — Frankfurter (opens `api.frankfurter.dev`).

These requests carry the place name or currency, **never your documents**.
The results are cached in your local document. Turning Online off stops all
of it and no cache is re-fetched.

Also, only if you click **Check for updates** (desktop Settings): one
request to api.github.com to see if a newer release exists, and the updater
download to github.com if you install it.

## Diagnostics

- Bug reports start with what you can see in-app. No crash reporting SDK
  exists in the app; nothing is uploaded automatically, ever.
- The desktop `Network`/`Lab` tools run locally: pings, DNS lookups and a
  LAN scan touch only the name you type and your own subnet. Nothing from
  those screens is stored or sent anywhere.

## What this app never does

- No analytics, no ads, no tracking pixels, no third-party app frameworks.
- No accounts, no email, no phone numbers required from you.
- No server holds your data. You own the files.

The GPL-style distribution terms are in `LICENSE`; usage terms are in
`docs/TERMS.md`. Both are open-source, so you can verify all of it from the
same repository.
