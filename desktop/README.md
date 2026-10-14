# Nucleus Desktop (groundwork)

Tauri 2 + React + Vite. It reuses the phone app's logic from `frontend/src/core` through the `@core/*` alias. Plan: `plan/desktop-plan.md`.

- `yarn install && yarn dev`: web preview at http://localhost:1420
- `yarn tauri dev`: native window (needs Rust and, on Linux, webkit2gtk-4.1)
- `yarn tauri build`: installers in `src-tauri/target/release/bundle/`

Only core modules with no React Native or Expo imports may be used here. Phone-only parts get adapters in `src/platform/` (phase D1).
