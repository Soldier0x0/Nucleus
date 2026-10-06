import React from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { Magnetometer } from "expo-sensors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { Header } from "@/src/components/Header";
import { HeadingRose } from "@/src/components/HeadingTile";
import { useHeading } from "@/src/components/useHeading";
import { Card, Eyebrow, T } from "@/src/components/ui";
import { ModuleGate } from "@/src/components/ModuleGate";

export default function Compass() {
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const rose = Math.min(220, Math.max(160, width - sp.lg * 2 - sp.xl * 2 - 8));
  const { heading, available } = useHeading(Magnetometer);
  const word = heading?.word ?? "Heading";
  const degrees = heading ? `${heading.degrees}°` : "—";
  const detail = heading
    ? "The top of this phone. The magnetometer stays on the phone."
    : available === false
      ? "This phone has no magnetometer."
      : "Hold the phone flat, screen up.";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Heading" testID="heading-header" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, maxWidth: 420, width: "100%", alignSelf: "center" }}>
        <Card testID="heading-card">
          <Eyebrow>Travel</Eyebrow>
          <View style={{ alignItems: "center", marginTop: 20 }}>
            <HeadingRose degrees={heading?.degrees ?? null} size={rose} marks />
          </View>
          <T v="title" testID="heading-word" style={{ textAlign: "center", marginTop: 18 }}>{word}</T>
          <T v="monoLg" testID="heading-degrees" style={{ textAlign: "center", marginTop: 4 }}>{degrees}</T>
          <T muted style={{ textAlign: "center", marginTop: 10 }}>{detail}</T>
        </Card>
      </ScrollView>
      <ModuleGate id="travel" name="Travel" icon="bag-suitcase-outline" />
    </View>
  );
}
