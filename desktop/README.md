# Nucleus Desktop

Tauri 2 + React + Vite. It reuses the phone app's logic from `frontend/src/core` through the `@core/*` alias and stores the same encrypted document. Plan: `plan/desktop-plan.md` (phase D1).

- `yarn install && yarn dev`: web preview at http://localhost:1420 (dev-only: the key and PIN record sit in plain localStorage)
- `yarn tauri dev`: native window (needs Rust and, on Linux, webkit2gtk-4.1)
- `yarn tauri build`: installers in `src-tauri/target/release/bundle/`
- `yarn build`: typecheck + production web build
- `yarn test` from `frontend/` also covers the desktop compat test (`desktopCompat.test.ts`)

## How it works

- First run asks for a 4+ digit PIN. It derives the key of a Stronghold snapshot in the app-data folder; the device key inside encrypts the single document (`nucleus.db.v1`, NCE1 AES-256-GCM envelope, same as the phone).
- The PIN is asked on every launch. Wrong PINs back off with the phone's schedule.
- Sections: Today, Money, Vehicles, Papers (vault files in a sibling `vault/` folder, PDFs open in the system viewer), Notes/Wiki/Kanban, Settings. `Ctrl+1..6` switches sections.
- Settings imports and exports phone-format backups, plain or password-encrypted (`sync mode 3`). Imported documents load editable.
- Only core modules with no React Native or Expo imports are used. Phone-only parts get adapters in `src/platform/`; a few native specifiers that the shared graph still names at the top are aliased to the frontend test stubs in `vite.config.ts` (their code paths are never called on desktop).
