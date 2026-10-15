import React, { useRef } from "react";
import { Animated, Platform, Pressable, type GestureResponderEvent } from "react-native";
import { tabRipple } from "@/src/core/tabRipple";
import { Tabs } from "expo-router/js-tabs";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { fonts, useTheme } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { Icon } from "@/src/components/ui";
import { useStore } from "@/src/core/store";
import { visibleAttention } from "@/src/core/attention";

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

export default function TabsLayout() {
  const { colors, look } = useTheme();
  const { db } = useStore();
  const urgent = visibleAttention(db).filter((i) => i.severity === "urgent").length;

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" />
          <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
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
      <Tabs.Screen name="index" options={{ title: "Today", tabBarButtonTestID: "tab-today", tabBarIcon: ({ color, focused }) => <Icon name={focused ? "view-dashboard" : "view-dashboard-outline"} color={color as string} size={24} /> }} />
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
    </Tabs>
  );
}
