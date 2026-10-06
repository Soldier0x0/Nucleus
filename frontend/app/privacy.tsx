import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { PRIVACY_CONNECTION, PRIVACY_NEVER, PRIVACY_PERMISSIONS, PRIVACY_STAYS } from "@/src/core/privacyCopy";
import { Header } from "@/src/components/Header";
import { T } from "@/src/components/ui";

export default function PrivacyUsage() {
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="privacy-usage">
      <Header title="Privacy and usage" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 16, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <T v="label">On this phone</T>
        <T>{PRIVACY_STAYS}</T>
        <T v="label">Permissions</T>
        {PRIVACY_PERMISSIONS.map((row) => (
          <View key={row.name}>
            <T v="label">{row.name}</T>
            <T muted style={{ marginTop: 4 }}>{row.line}</T>
          </View>
        ))}
        <T v="label">Needs a connection</T>
        <T>{PRIVACY_CONNECTION}</T>
        <T v="label">What never leaves</T>
        <T>{PRIVACY_NEVER}</T>
      </ScrollView>
    </View>
  );
}
