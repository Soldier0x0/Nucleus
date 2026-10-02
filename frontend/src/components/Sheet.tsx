import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { IconButton, T } from "./ui";

/** Lightweight bottom sheet built on Modal (portal above tabs). */
export function Sheet({ visible, onClose, title, children, testID, footer }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; testID?: string; footer?: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable testID={testID ? `${testID}-backdrop` : undefined} style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }]} onPress={onClose} />
          <View testID={testID} style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 16), borderColor: colors.border }]}>
            <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
            {title ? (
              <View style={styles.head}>
                <T v="h2" style={{ flex: 1 }}>
                  {title}
                </T>
                <IconButton icon="close" onPress={onClose} testID={testID ? `${testID}-close` : "sheet-close"} label="Close" />
              </View>
            ) : null}
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }} style={{ flexGrow: 0 }}>
              {children}
            </ScrollView>
            {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: "90%", borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4, borderWidth: 1, borderBottomWidth: 0 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 8 },
  head: { flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 6, paddingTop: 4 },
});
