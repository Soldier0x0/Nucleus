import React from "react";
import { Switch, View } from "react-native";
import { LOOK_LIST } from "@/src/core/looks";
import { LAYOUT_LIST } from "@/src/core/layouts";
import { useStore } from "@/src/core/store";
import { useTheme } from "@/src/theme";
import { Button, Card, Chip, ChipRow, Eyebrow, T } from "./ui";

/** Pick a look. The color set is chosen separately and works with every look. */
export function LookPicker() {
  const { db, setSettings } = useStore();
  const { colors } = useTheme();
  const s = db.settings;
  const current = LOOK_LIST.find((look) => look.id === s.look) ?? LOOK_LIST[0];
  const sw = { trackColor: { true: colors.brandPrimary, false: colors.surfaceTertiary }, thumbColor: colors.surfaceSecondary };
  return (
    <View style={{ gap: 10 }} testID="settings-look">
      <T v="label">Layout</T>
      <ChipRow testID="settings-layout-row">
        {LAYOUT_LIST.map((layout) => (
          <Chip key={layout.id} label={layout.name} selected={s.layout === layout.id} onPress={() => setSettings({ layout: layout.id, appearanceChosen: true })} testID={`settings-layout-${layout.id}`} />
        ))}
      </ChipRow>
      <T muted style={{ fontSize: 12 }}>{LAYOUT_LIST.find((layout) => layout.id === s.layout)?.line}</T>
      <T v="label">Look</T>
      <ChipRow testID="settings-look-row">
        {LOOK_LIST.map((look) => (
          <Chip
            key={look.id}
            label={look.name}
            selected={s.look === look.id}
            onPress={() =>
              setSettings(
                look.id === "blush"
                  ? { look: "blush", theme: "blush", accent: "blush", appearanceChosen: true }
                  : { look: look.id, appearanceChosen: true },
              )
            }
            testID={`settings-look-${look.id}`}
          />
        ))}
      </ChipRow>
      <T muted style={{ fontSize: 12 }}>{current.line}</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T v="label">Two tones</T>
          <T muted style={{ fontSize: 12 }}>The background keeps this color. Type, buttons, and marks use a second color.</T>
        </View>
        <Switch testID="settings-dual-tone" value={s.dualTone} onValueChange={(dualTone) => setSettings({ dualTone })} {...sw} />
      </View>
      <Card testID="look-preview">
        <Eyebrow>Preview</Eyebrow>
        <T v="title" style={{ marginTop: 4 }}>Good afternoon</T>
        <T muted style={{ marginTop: 4 }}>Rows, type, and cards follow this look.</T>
        <View style={{ marginTop: 12 }}>
          <Button label="A button" small testID="look-preview-button" />
        </View>
      </Card>
    </View>
  );
}
