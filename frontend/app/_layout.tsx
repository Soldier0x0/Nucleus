import React, { useEffect, useMemo } from "react";
import * as Linking from "expo-linking";
import { useColorScheme, View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { buildTheme, ThemeContext } from "@/src/theme";
import { StoreProvider, useStore } from "@/src/core/store";
import { ToastProvider } from "@/src/components/Toast";
import { LockGate } from "@/src/components/LockGate";
import { BackupNudge } from "@/src/components/BackupNudge";
import { UnreadableData } from "@/src/components/UnreadableData";
import { pushCaptureText } from "@/src/core/captureBus";
import { pushReceiptText } from "@/src/core/receiptBus";
import { looksLikeReceipt } from "@/src/core/receipt";
import { HomeSurface } from "@/src/components/HomeSurface";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Themed({ children }: { children: React.ReactNode }) {
  const { db, ready, unreadable } = useStore();
  const scheme = useColorScheme();
  const s = db.settings;
  const themeKey = s.theme === "system" ? (scheme === "light" ? "paper" : "midnight") : s.theme;
  const theme = useMemo(
    () => buildTheme(themeKey, s.accent, s.density === "dense", { highContrast: s.highContrast, largeTouch: s.largeTouch, reducedMotion: s.reducedMotion }),
    [themeKey, s.accent, s.density, s.highContrast, s.largeTouch, s.reducedMotion],
  );
  const mode = theme.mode;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>{unreadable ? <UnreadableData /> : children}</View>
    </ThemeContext.Provider>
  );
}

function takeSharedUrl(url: string | null) {
  if (!url || !url.includes("capture")) return;
  const parsed = Linking.parse(url);
  const text = parsed.queryParams?.text;
  if (typeof text !== "string" || !text.trim()) return;
  if (looksLikeReceipt(text)) pushReceiptText(text);
  else pushCaptureText(text);
}

export default function RootLayout() {
  useEffect(() => {
    Linking.getInitialURL().then(takeSharedUrl).catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => takeSharedUrl(url));
    return () => sub.remove();
  }, []);

  // Fonts + icon font are pre-warmed here so icons render on first paint (incl. Expo Go Android).
  const [loaded, error] = useFonts({
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
    "JetBrainsMono-Regular": require("../assets/fonts/JetBrainsMono-Regular.ttf"),
    "JetBrainsMono-Medium": require("../assets/fonts/JetBrainsMono-Medium.ttf"),
    "JetBrainsMono-Bold": require("../assets/fonts/JetBrainsMono-Bold.ttf"),
    MaterialDesignIcons: require("@react-native-vector-icons/material-design-icons/fonts/MaterialDesignIcons.ttf"),
  });
  if (!loaded && !error) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <StoreProvider>
            <Themed>
              <ToastProvider>
                <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
                <BackupNudge />
                <HomeSurface />
                <LockGate />
              </ToastProvider>
            </Themed>
          </StoreProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
