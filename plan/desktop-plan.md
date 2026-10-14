# Nucleus Desktop (Windows + Linux): plan

Status: **decided by Harsha 14 Oct 2026, not started.** Build after v0.9.8 ships. If it turns out small, it can fold into v0.9.8. The sync markers (1.x below) go into v0.9.8 Phase 1 either way.

## Decisions (locked)

| Topic | Decision |
|---|---|
| What it is | A full Nucleus app with the same editing rights as the phone, synced both ways |
| Sync modes | All three: (1) automatic over local Wi-Fi while both apps are open, (2) manual Sync with QR pairing, (3) export/import of the encrypted file |
| UI | A new desktop layout (sidebar, wide tables, charts, keyboard shortcuts) that reuses the core logic. Not a stretched phone UI |
| Repo | Same repo, new `desktop/` folder that imports `frontend/src/core` |
| Releases | Each release carries the APK **plus** Windows and Linux installers, published by GitHub Actions the same way the APK is today |

## Architecture

- **Shell:** Tauri 2. It builds a Windows `.msi` / `-setup.exe` and a Linux `.deb` / `.AppImage` (about 10 MB each). It runs offline and needs no browser engine install on Windows 10/11 (WebView2 is built in).
- **UI:** React + Vite in `desktop/src`. It imports `@core/*` → `frontend/src/core/*`, the same code the phone runs. About 87 of the 96 core files have no phone dependencies. The other 9 (files, secure store, notifications, crypto bridge) get small desktop adapters in `desktop/src/platform/`. These are the same seams the test stubs in `src/core/__stubs__` already show.
- **Storage:** the same single encrypted JSON document, kept in the app data folder. The Tauri `fs` and `stronghold`/keyring plugins replace `expo-secure-store`. Vault files (PDFs, photos) go in a sibling `vault/` folder.
- **Lock:** a PIN on desktop (and Windows Hello later). The phone's lock settings are never synced.

## Phase D0: sync-safe data (goes into v0.9.8 Phase 1)

Today `mergeDB` lets the incoming copy win for every id. It has no deletes and no notion of which edit is newer, so syncing would bring deleted items back and overwrite newer edits.

1. Every record gets `updatedAt` (ISO), set in `actions.ts` / `update()` writers.
2. Deletes write a tombstone `{ id, kind, deletedAt }` to `db.tombstones` instead of only filtering. Tombstones older than 180 days are pruned once every paired device has synced past them.
3. `mergeDB` becomes per-record last-write-wins on `updatedAt`, and tombstones beat older edits. Device-only settings (lock, biometrics, module locks, installId, notification state) never merge.
4. `settings.pairedDevices: { id, name, key, lastSyncAt }[]`. A backup from a paired device is editable; an unpaired foreign file stays read-only, as today.
5. Unit tests for: edit vs edit (newer wins), delete vs older edit (delete wins), delete vs newer edit (edit wins), the same file merged twice changes nothing (idempotent), and device settings untouched.

Normalize on load sets `updatedAt` = `createdAt` (or the migration time) for old records, so nothing changes on screen.

## Phase D1: desktop shell and read/write

- Scaffold `desktop/` (Tauri 2 + React + Vite + TypeScript). Wire the `@core` path alias, the platform adapters and the encrypted load/save.
- Screens, in order: Today, Money (table + charts), Vehicles, Papers vault (PDF viewer), Notes/Wiki/Kanban (one menu, three views, as decided), Settings.
- Import the phone's encrypted backup file. This is sync mode 3 and needs nothing new.

## Phase D2: pairing and sync

- **Pairing (QR):** Desktop → Settings → Pair a phone shows a QR with `{ deviceId, name, x25519 public key, LAN address/port, one-time code }`. The phone scans it (expo-camera, so CAMERA permission and the contextual permission flow) and both sides store each other in `pairedDevices`. A typed 6-digit code is the fallback when there's no webcam scan.
- **Transport:** the desktop runs a local-only HTTPS/WebSocket server on the LAN (Tauri Rust side). Every message is encrypted with the pair key. No internet, no cloud.
- **Manual sync:** a Sync button on either side. They swap changes since `lastSyncAt` (records + tombstones + vault file hashes), merge with the D0 rules, and show "12 in, 3 out".
- **Automatic sync:** while both apps are open on the same Wi-Fi, the desktop is found over mDNS (a small native module in the APK build, not Expo Go) and sync runs on change, debounced about 5 s, plus on app resume.
- **Vault files:** sent by content hash, only the files the other side is missing.

## Phase D3: GitHub Actions and releases

Goal: one merged PR publishes one version that carries the APK, Windows and Linux files.

- Rename or extend `.github/workflows/android-apk.yml` into a `release.yml` with these jobs:
  - `version`: the existing `next-android-version.js` / `release-notes.js` step, shared by all jobs.
  - `android`: the existing APK job, unchanged.
  - `desktop`: matrix `windows-latest` + `ubuntu-22.04`. It runs `tauri-action` (or `npx tauri build`) with the version stamped from the changelog and uploads `.msi`, `-setup.exe`, `.deb` and `.AppImage` as artifacts on PRs.
  - `publish`: needs `android` + `desktop` and creates **one** GitHub Release with all files attached. If any platform fails, no release is made.
- The same rules as today: core tests + tsc + release-script tests run first. A docs-only change does not compile. The green PR artifacts are what get published.
- **Signing:**
  - Windows installers are unsigned at first, so SmartScreen shows "More info → Run anyway". Optional secrets for a code-signing certificate can be added later.
  - Linux needs none.
  - Tauri updater signing key: optional, later.

## Open questions (ask Harsha before D1)

1. Windows Hello / fingerprint unlock on desktop now, or a PIN only at first?
2. Should the desktop also show sensor/phone-only modules (Phone Lab, bank texts)? Recommended: hide them on desktop.
3. Is macOS needed ever? It isn't in scope now; Tauri can add it later.
