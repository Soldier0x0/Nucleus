import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { fonts, useTheme } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { Icon } from "@/src/components/ui";
import { useStore } from "@/src/core/store";
import { visibleAttention } from "@/src/core/attention";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { db } = useStore();
  const urgent = visibleAttention(db).filter((i) => i.severity === "urgent").length;

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" />
          <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="modules">
          <NativeTabs.Trigger.Icon sf="square.stack.3d.up.fill" />
          <NativeTabs.Trigger.Label>Modules</NativeTabs.Trigger.Label>
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
        tabBarLabelStyle: { fontFamily: fonts.textSemi, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarButtonTestID: "tab-today", tabBarIcon: ({ color, focused }) => <Icon name={focused ? "view-dashboard" : "view-dashboard-outline"} color={color as string} size={24} /> }} />
      <Tabs.Screen name="modules" options={{ title: "Modules", tabBarButtonTestID: "tab-modules", tabBarIcon: ({ color, focused }) => <Icon name={focused ? "view-grid" : "view-grid-outline"} color={color as string} size={24} /> }} />
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
