/** True inside the Tauri webview; false for `yarn dev` in a plain browser. */
export const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const isBrowserPreview = () => !isTauri();
