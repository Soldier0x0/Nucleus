import * as Clipboard from "expo-clipboard";

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Copy to clipboard and wipe it again after `seconds` (unless the user copied
 * something else meanwhile). Used for amounts and other sensitive values.
 */
export async function copyTemporary(text: string, seconds = 60) {
  await Clipboard.setStringAsync(text);
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    try {
      if ((await Clipboard.getStringAsync()) === text) await Clipboard.setStringAsync("");
    } catch {
      /* clipboard unavailable */
    }
  }, seconds * 1000);
}
