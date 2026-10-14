// Registers the TypeScript module-resolution hook for the node:test runner.
//
// `--import` runs this file for its side effects but does NOT treat an
// exported `resolve` as a loader hook, so the hook in `test-loader.mjs` must
// be registered explicitly with `module.register()` for extensionless relative
// imports (e.g. `./cycle`) to resolve to their `.ts` files under node:test.
import { register } from "node:module";

register(new URL("./test-loader.mjs", import.meta.url));
