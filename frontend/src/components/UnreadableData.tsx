import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { clearFailures, clearPin } from "@/src/core/security";
import { Button, Eyebrow, Icon, T } from "./ui";
import { Sheet } from "./Sheet";

/**
 * Shown when the saved database cannot be decrypted or parsed.
 * Retry reads it again. Erase is explicit and is the only path that replaces it.
 */
export function UnreadableData() {
  const { retryLoad, discardUnreadable } = useStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <View testID="data-unreadable" style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.mark, { backgroundColor: colors.surfaceInverse }]}>
        <Icon name="shield-lock-outline" size={28} color={colors.onSurfaceInverse} />
      </View>
      <Eyebrow style={{ marginTop: 16 }}>Saved data</Eyebrow>
      <T v="title" style={{ marginTop: 6, textAlign: "center" }}>
        Could not open your data
      </T>
      <T muted style={styles.copy}>
        The copy on this device could not be read. It has not been replaced. Try again, or erase it and restore from a backup you exported earlier.
      </T>
      <Button testID="data-unreadable-retry" label="Try again" icon="refresh" onPress={retryLoad} disabled={busy} style={{ alignSelf: "stretch" }} />
      <Button testID="data-unreadable-erase" kind="ghost" label="Erase and start over" onPress={() => setConfirm(true)} disabled={busy} style={{ alignSelf: "stretch", marginTop: 8 }} />
      <Sheet visible={confirm} onClose={() => !busy && setConfirm(false)} title="Erase saved data?" testID="data-unreadable-sheet">
        <T style={{ marginBottom: 16 }}>This replaces the copy that could not be opened. Export a backup first if you still have one from earlier.</T>
        {error ? (
          <T testID="data-unreadable-error" color={colors.error} style={{ marginBottom: 12 }}>
            {error}
          </T>
        ) : null}
        <Button
          kind="danger"
          icon="delete-forever-outline"
          label="Erase all data"
          testID="data-unreadable-erase-confirm"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setError(undefined);
            try {
              await discardUnreadable();
              await clearPin().catch(() => {});
              await clearFailures().catch(() => {});
            } catch {
              setError("Could not erase. The saved copy is still on this device.");
              setBusy(false);
            }
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  mark: { width: 56, height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  copy: { textAlign: "center", marginTop: 12, marginBottom: 28, paddingHorizontal: 8 },
});
