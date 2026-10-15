import React from "react";
import { View } from "react-native";
import { useTheme } from "@/src/theme";
import { aboutTitle } from "@/src/core/about";
import { installedVersion } from "@/src/native/android";
import { T } from "@/src/components/ui";
import { Row, Section, SettingsScreen, useSettingsAnchor } from "./parts";

const LICENCES: { icon: string; title: string; line: string }[] = [
  { icon: "code-braces", title: "Expo and React Native", line: "App framework · MIT licence" },
  { icon: "view-grid-outline", title: "Material Design Icons", line: "Icons · Apache License 2.0" },
  { icon: "web", title: "Weather by Open-Meteo.com", line: "CC BY 4.0 · no key, no account" },
];

/** About: the build-stamped version and the licences. */
export function AboutSettings() {
  const { colors } = useTheme();
  const anchor = useSettingsAnchor();
  return (
    <SettingsScreen title="About" testID="settings-about" anchor={anchor}>
      <Section title="About" anchor="about">
        <Row first icon="view-grid-outline" label={aboutTitle(installedVersion())} testID="settings-about-version" sub="Local-first. No account, no cloud, no AI. Insights are rules + your history." />
        <Row icon="shield-check-outline" label="Your records never leave" sub="Online mode sends only queries (currency code, city). Weather by Open-Meteo.com (CC BY 4.0)." />
      </Section>

      <Section title="Licences" anchor="licences">
        {LICENCES.map((entry, i) => (
          <Row key={entry.title} first={i === 0} icon={entry.icon} label={entry.title} sub={entry.line} />
        ))}
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
          <T muted style={{ fontSize: 12 }}>The app itself carries no third-party analytics, ads or tracking. Charts and insights are drawn on this phone from your own records.</T>
        </View>
      </Section>
    </SettingsScreen>
  );
}
