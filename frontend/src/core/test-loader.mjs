import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// __stubs__ lives next to this file, inside src/core.
const stubDir = pathToFileURL(pathResolve(here, "__stubs__") + "/").href;

// Bare native modules that cannot load under plain Node (Metro-only resolution
// and/or requireNativeModule at import time) are redirected to inert or
// Node-backed stubs so the pure logic that shares their module graph can run.
const STUBS = {
  "react-native": `${stubDir}react-native.ts`,
  "expo-crypto": `${stubDir}expo-crypto.ts`,
  "expo-file-system": `${stubDir}expo-file-system.ts`,
  "expo-file-system/legacy": `${stubDir}expo-file-system-legacy.ts`,
  "expo-secure-store": `${stubDir}expo-secure-store.ts`,
  "expo-document-picker": `${stubDir}expo-document-picker.ts`,
  "expo-image-picker": `${stubDir}expo-image-picker.ts`,
  "expo-local-authentication": `${stubDir}expo-local-authentication.ts`,
  "expo-notifications": `${stubDir}expo-notifications.ts`,
  "expo-sharing": `${stubDir}expo-sharing.ts`,
  "expo-clipboard": `${stubDir}expo-clipboard.ts`,
  "@react-native-async-storage/async-storage": `${stubDir}async-storage.ts`,
  "react-native-blob-util": `${stubDir}react-native-blob-util.ts`,
};

// tsconfig maps "@/*" to the frontend root (this file is in src/core).
const frontendRoot = pathToFileURL(pathResolve(here, "../..") + "/").href;

export async function resolve(specifier, context, nextResolve) {
  if (Object.prototype.hasOwnProperty.call(STUBS, specifier)) {
    return { url: STUBS[specifier], shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const base = frontendRoot + specifier.slice(2);
    try {
      return await nextResolve(base, context);
    } catch (err) {
      // Metro resolves a bare directory to its index file; plain ESM needs the hint.
      if (err?.code === "ERR_UNSUPPORTED_DIR_IMPORT") return nextResolve(base + "/index.ts", context);
      throw err;
    }
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !specifier.endsWith(".ts") && !specifier.endsWith(".js") && !specifier.endsWith(".mjs")) {
    return nextResolve(specifier + ".ts", context);
  }
  // desktop/tsconfig maps "@core/*" to the phone core; node tests need the
  // same mapping with the extension hint when the loader pulls desktop
  // modules that import @core.
  if (specifier.startsWith("@core/")) {
    const base = frontendRoot + "src/core/" + specifier.slice("@core/".length);
    return nextResolve(/\.(ts|js|mjs)$/.test(base) ? base : base + ".ts", context);
  }
  // desktop/src files import @noble/* directly. CI's phone job installs only
  // frontend packages, so desktop imports resolve against the frontend copy.
  if (context.parentURL?.includes("/desktop/") && !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("@/")) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      if (err?.code !== "ERR_MODULE_NOT_FOUND") throw err;
      return nextResolve(specifier, { ...context, parentURL: frontendRoot + "src/core/probe.ts" });
    }
  }
  return nextResolve(specifier, context);
}
