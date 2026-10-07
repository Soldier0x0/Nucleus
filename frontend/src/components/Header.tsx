import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { IconButton, T } from "./ui";

/** Sticky, safe-area aware stack header for non-tab screens. */
export function Header({ title, right, testID, back = true, onBack }: { title: string; right?: React.ReactNode; testID?: string; back?: boolean; onBack?: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  return (
    <View testID={testID} style={[styles.wrap, { paddingTop: insets.top + 4, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {back ? <IconButton icon="arrow-left" testID="header-back" label="Back" onPress={goBack} /> : <View style={{ width: 12 }} />}
      <T v="h2" numberOfLines={1} style={{ flex: 1, marginLeft: 4 }}>
        {title}
      </T>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingBottom: 6, borderBottomWidth: 1 },
});
