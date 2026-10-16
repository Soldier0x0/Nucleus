import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// @core is the phone app's shared logic. Only modules with no React Native or
// Expo imports may be used here; phone-only parts get desktop adapters in src/platform.
// A few core files (paperFiles and what it pulls in through defaults -> presets ->
// bills -> actions) still name native packages at the top. Those paths are never
// reached from desktop code, so the test stubs make the graph bundle cleanly.
const stub = (name: string) => fileURLToPath(new URL(`../frontend/src/core/__stubs__/${name}`, import.meta.url));
const shim = (name: string) => fileURLToPath(new URL(`src/coreShims/${name}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@core", replacement: fileURLToPath(new URL("../frontend/src/core", import.meta.url)) },
      { find: /^expo-crypto$/, replacement: shim("expo-crypto.ts") },
      { find: /^@\/src\/utils\/storage$/, replacement: shim("phoneStorage.ts") },
      { find: /^react-native$/, replacement: stub("react-native.ts") },
      { find: /^expo-file-system\/legacy$/, replacement: stub("expo-file-system-legacy.ts") },
      { find: /^expo-file-system$/, replacement: stub("expo-file-system.ts") },
      { find: /^expo-document-picker$/, replacement: stub("expo-document-picker.ts") },
      { find: /^expo-image-picker$/, replacement: stub("expo-image-picker.ts") },
      { find: /^react-native-blob-util$/, replacement: stub("react-native-blob-util.ts") },
    ],
  },
  // A string (not an object) stops esbuild from reading frontend/tsconfig.json for shared core files: it extends
  // expo/tsconfig.base, which only exists when the phone app's packages are installed.
  esbuild: { tsconfigRaw: JSON.stringify({ compilerOptions: { jsx: "react-jsx", target: "es2022", useDefineForClassFields: true } }) },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "es2022", outDir: "dist" },
});
