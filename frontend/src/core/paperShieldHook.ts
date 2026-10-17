import { useEffect } from "react";
import { Platform } from "react-native";
import * as ScreenCapture from "expo-screen-capture";
import { useStore } from "./store";
import { setShieldApplier, shieldOff, shieldOn } from "./paperShield";

setShieldApplier(async (mode) => {
  if (Platform.OS === "web") return;
  if (mode === "secure") await ScreenCapture.preventScreenCaptureAsync("nucleus");
  else await ScreenCapture.allowScreenCaptureAsync("nucleus");
});

/**
 * Keeps the window capture-secure for all paper-bearing surfaces at once.
 * Screens stack, so an inner unmount only restores when the last one closes,
 * and to whatever the user picked in Settings.
 */
export function usePaperShield(active: boolean) {
  const { db } = useStore();
  const restoreBlock = db.settings.blockScreenshots === true;
  useEffect(() => {
    if (!active) return;
    shieldOn();
    return () => shieldOff(restoreBlock);
  }, [active, restoreBlock]);
}
