import React, { useRef } from "react";
import { Animated, Platform, Pressable, type GestureResponderEvent } from "react-native";
import { tabRipple } from "@/src/core/tabRipple";
import { Tabs } from "expo-router/js-tabs";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import type { SFSymbolIcon } from "expo-router/unstable-native-tabs";
import { fonts, useTheme } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { Icon } from "@/src/components/ui";
import { useStore } from "@/src/core/store";
import { visibleAttention } from "@/src/core/attention";
import { moduleById, moduleTabLabel, nativeModuleShellId } from "@/src/core/modules";
import type { ModuleId } from "@/src/core/types";

function TabButton({ onPressIn, children, ...rest }: { onPressIn?: ((event: GestureResponderEvent) => void) | null; children?: React.ReactNode } & Record<string, unknown>) {
  const ripple = tabRipple();
  const splash = useRef(new Animated.Value(0)).current;
  return (
    <Pressable
      {...rest}
      android_ripple={{ radius: ripple.radius, borderless: false }}
      onPressIn={(event) => {
        splash.setValue(1);
        Animated.timing(splash, { toValue: 0, duration: ripple.durationMs, useNativeDriver: true }).start();
        onPressIn?.(event);
      }}
    >
      <Animated.View pointerEvents="none" style={{ position: "absolute", alignSelf: "center", width: ripple.radius * 2, height: ripple.radius * 2, borderRadius: ripple.radius, opacity: splash, backgroundColor: "rgba(0,0,0,0.16)" }} />
      {children}
    </Pressable>
  );
}

/** SF symbols for the module home when the native tab bar is in use. Unknown ids keep the Today glyph. */
type NativeTabSymbol = NonNullable<SFSymbolIcon["sf"]>;
const NATIVE_SF: Partial<Record<ModuleId, NativeTabSymbol>> = {
  vehicles: "car.fill",
  money: "creditcard.fill",
  travel: "suitcase.fill",
  home: "house.fill",
  tools: "hammer.fill",
  notes: "note.text",
  papers: "doc.text.fill",
  wiki: "book.fill",
  net: "wifi",
  cycle: "calendar",
  health: "drop.fill",
};

export default function TabsLayout() {
  const { colors, look } = useTheme();
  const { db } = useStore();
  const urgent = visibleAttention(db).filter((i) => i.severity === "urgent").length;
  const shell = nativeModuleShellId(db.settings);
  const shellTab = shell ? { label: moduleTabLabel(shell), icon: moduleById(shell).icon } : null;

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf={(shell && NATIVE_SF[shell]) ?? "square.grid.2x2.fill"} />
          <NativeTabs.Trigger.Label>{shellTab?.label ?? "Today"}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="attention">
          <NativeTabs.Trigger.Icon sf="bell.fill" />
          <NativeTabs.Trigger.Label>Attention</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: look.plain ? fonts.text : fonts.textSemi, fontSize: look.typeScale === 1 ? 11 : Math.round(11 * look.typeScale) },
        tabBarButton: (props) => <TabButton {...props} />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: shellTab?.label ?? "Today", tabBarButtonTestID: "tab-today", tabBarIcon: ({ color, focused }) => <Icon name={shellTab ? shellTab.icon : focused ? "view-dashboard" : "view-dashboard-outline"} color={color as string} size={24} /> }} />
      <Tabs.Screen
        name="attention"
        options={{
          title: "Attention",
          tabBarButtonTestID: "tab-attention",
          tabBarBadge: urgent || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error, color: colors.onError, fontFamily: fonts.monoBold, fontSize: 10 },
          tabBarIcon: ({ color, focused }) => <Icon name={focused ? "bell" : "bell-outline"} color={color as string} size={24} />,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarButtonTestID: "tab-settings", tabBarIcon: ({ color, focused }) => <Icon name={focused ? "cog" : "cog-outline"} color={color as string} size={24} /> }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
    </Tabs>
  );
}
