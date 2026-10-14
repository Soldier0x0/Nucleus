import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// @core is the phone app's shared logic. Only modules with no React Native or
// Expo imports may be used here; phone-only parts get desktop adapters in src/platform.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@core": fileURLToPath(new URL("../frontend/src/core", import.meta.url)) } },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "es2022", outDir: "dist" },
});
