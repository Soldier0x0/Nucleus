import React, { useState } from "react";
import { TextInput, View } from "react-native";
import { fonts, radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { parseCapture } from "@/src/core/capture";
import { Icon, IconButton, T } from "./ui";
import { useToast } from "./Toast";

/** One-line quick capture with a live preview of what will be created. */
export function CaptureBar() {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const [q, setQ] = useState("");
  const r = parseCapture(db, q);
  const ok = r && !("error" in r);
  const save = () => {
    if (!r || "error" in r) return;
    update(r.apply);
    toast(`Saved · ${r.label}`, r.icon);
    setQ("");
  };
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingLeft: 12, backgroundColor: colors.surfaceSecondary }}>
        <Icon name="lightning-bolt-outline" size={18} color={colors.brandPrimary} />
        <TextInput testID="capture-input" value={q} onChangeText={setQ} onSubmitEditing={save} placeholder="Capture: 450 food lunch" placeholderTextColor={colors.muted} returnKeyType="done" style={{ flex: 1, height: 46, color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: 14 }} />
        {ok ? <IconButton icon="check" testID="capture-save-button" label="Save capture" onPress={save} /> : null}
      </View>
      {r ? (
        <View testID="capture-preview" style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
          <Icon name={"error" in r ? "information-outline" : r.icon} size={14} color={"error" in r ? colors.muted : colors.success} />
          <T muted={"error" in r} style={{ fontSize: 12, flex: 1 }} numberOfLines={2}>{"error" in r ? r.error : `Will create: ${r.label}`}</T>
        </View>
      ) : null}
    </View>
  );
}
