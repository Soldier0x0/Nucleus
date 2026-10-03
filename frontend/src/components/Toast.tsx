import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, radius, useTheme, bindLookStyles } from "@/src/theme";
import { Icon } from "./ui";

type ToastT = { id: number; msg: string; icon?: string };
const Ctx = createContext<(msg: string, icon?: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<ToastT | null>(null);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string, icon?: string) => {
    if (timer.current) clearTimeout(timer.current);
    setT({ id: Date.now(), msg, icon });
    timer.current = setTimeout(() => setT(null), 2600);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {t ? (
        <Animated.View key={t.id} entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(160)} style={[styles.wrap, { top: insets.top + 8, pointerEvents: "none" }]}>
          <View testID="toast" style={[styles.toast, { backgroundColor: colors.surfaceInverse }]}>
            <Icon name={t.icon ?? "check-circle-outline"} size={18} color={colors.onSurfaceInverse} />
            <Text style={{ color: colors.onSurfaceInverse, fontFamily: fonts.textMedium, fontSize: 14, flexShrink: 1 }}>{t.msg}</Text>
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const styles = bindLookStyles(() => StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, maxWidth: 480 },
}));
