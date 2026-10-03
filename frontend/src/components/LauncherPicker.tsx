import { Image, useColorScheme, View } from "react-native";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import type { LauncherChoice } from "@/src/core/types";
import { ICON_FAMILIES, ICON_FAMILY_LABEL, ICON_VARIANTS, ICON_VARIANT_LABEL, resolveLauncher } from "@/src/core/launcher";
import { LAUNCHER_ART } from "@/src/core/launcherArt";
import { Chip, Press, T } from "./ui";

export function LauncherPicker() {
  const { db, setSettings } = useStore();
  const { colors } = useTheme();
  const scheme = useColorScheme();
  const choice = db.settings.launcher;
  const resolved = resolveLauncher(choice, db.settings.theme, scheme);
  const pick = (next: LauncherChoice) => setSettings({ launcher: next });

  return (
    <View style={{ padding: 12, gap: 12 }} testID="settings-launcher">
      <T v="label">Home screen icon</T>
      <T muted style={{ fontSize: 12 }}>
        Paper press is the starting picture. Pick a family and a ground, or let it follow your theme. The lock screen uses the same colours.
      </T>
      <Chip label="Match my theme" selected={choice.variant === "match"} testID="settings-launcher-match" onPress={() => pick({ family: choice.family, variant: "match" })} />
      {ICON_FAMILIES.map((family) => (
        <View key={family} style={{ gap: 8 }}>
          <T v="caption">{ICON_FAMILY_LABEL[family]}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ICON_VARIANTS.map((variant) => {
              const on = choice.variant === "match" ? choice.family === family && resolved.variant === variant : choice.family === family && choice.variant === variant;
              return (
                <Press
                  key={variant}
                  testID={`settings-launcher-${family}-${variant}`}
                  accessibilityLabel={`${ICON_FAMILY_LABEL[family]} ${ICON_VARIANT_LABEL[variant]}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => pick({ family, variant })}
                  style={{ width: 72, alignItems: "center", gap: 4, borderWidth: 2, borderColor: on ? colors.onSurface : "transparent", borderRadius: radius.md, padding: 4 }}
                >
                  <Image source={LAUNCHER_ART[`${family}-${variant}`]} style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.surfaceTertiary }} />
                  <T v="caption">{ICON_VARIANT_LABEL[variant]}</T>
                </Press>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
