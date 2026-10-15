import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStore } from "@/src/core/store";
import { aboutTitle } from "@/src/core/about";
import { installedVersion } from "@/src/native/android";
import { searchSettings } from "@/src/core/settingsSearch";
import { Eyebrow, Icon, T } from "@/src/components/ui";
import { Row, Section } from "@/src/components/settings/parts";

const GROUPS: { route: string; icon: string; label: string; sub: string; testID: string }[] = [
  { route: "/settings/display", icon: "contrast-circle", label: "Display", sub: "Appearance, You, defaults, units, online, home tiles and accessibility", testID: "settings-group-display" },
  { route: "/settings/security", icon: "shield-account-outline", label: "Security and privacy", sub: "App lock, profiles, screenshots, clipboard, privacy mode and emergency card", testID: "settings-group-security" },
  { route: "/settings/notifications", icon: "bell-outline", label: "Notifications", sub: "Reminders, quiet hours, channels, bank texts and the lock screen", testID: "settings-group-notifications" },
  { route: "/modules", icon: "view-grid-outline", label: "Modules", sub: "Turn on or off and set the menu order", testID: "settings-modules-button" },
  { route: "/settings/data", icon: "database-outline", label: "Data and backup", sub: "Your data, locked file, cloud, sample data and developer logs", testID: "settings-group-data" },
  { route: "/settings/about", icon: "information-outline", label: "About", sub: "Version and licences", testID: "settings-group-about" },
];

export default function Settings() {
  const { db } = useStore();
  const s = db.settings;
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchSettings(query), [query]);
  const searching = query.trim().length > 0;
  useEffect(() => {
    if (params.section === "weather") router.replace({ pathname: "/settings/display", params: { section: "weather" } } as any);
  }, [params.section, router]);
  const modulesOn = s.modules.filter((m) => m.enabled).length;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: sp.lg, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Eyebrow>Everything stays on this device</Eyebrow>
        <T v="title" testID="settings-title">Settings</T>
      </View>
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <TextInput
          testID="settings-search-input"
          value={query}
          onChangeText={setQuery}
          placeholder="Search settings"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={[styles.search, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary, color: colors.onSurface }]}
        />
        {searching ? (
          <Section title={`Results · ${results.length}`}>
            {results.length === 0 ? (
              <T muted testID="settings-search-empty" style={{ padding: 16 }}>No close matches. Groups: Display, Security and privacy, Notifications, Modules, Data and backup, About.</T>
            ) : (
              results.map((hit, i) => (
                <Row
                  key={hit.id}
                  first={i === 0}
                  icon="magnify"
                  label={hit.title}
                  sub={hit.group}
                  testID={`settings-search-${hit.id}`}
                  onPress={() => router.push({ pathname: hit.route, params: hit.anchor ? { anchor: hit.anchor } : {} } as any)}
                  right={<Icon name="chevron-right" size={18} color={colors.muted} />}
                />
              ))
            )}
          </Section>
        ) : (
          <Section title="Groups">
            {GROUPS.map((group, i) => (
              <Row
                key={group.route}
                first={i === 0}
                icon={group.icon}
                label={group.label}
                sub={group.route === "/modules" ? `${modulesOn} on · ${group.sub}` : group.route === "/settings/about" ? aboutTitle(installedVersion()) : group.sub}
                testID={group.testID}
                onPress={() => router.push(group.route as any)}
                right={<Icon name="chevron-right" size={18} color={colors.muted} />}
              />
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { height: 46, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 16, marginBottom: 16 },
});
