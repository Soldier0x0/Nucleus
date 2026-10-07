import React, { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { fonts, radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { parseCapture } from "@/src/core/capture";
import { subscribeCapture } from "@/src/core/captureBus";
import { Icon, IconButton, T } from "./ui";
import { useToast } from "./Toast";

const HINTS = [
  "450 food lunch",
  "5.4L @103.7 Activa",
  "netflix 649 monthly",
  "onion 80 groceries",
  "Activa 5.4L 560 full 12450 km",
  "period started",
  "hotel 3200",
  "puc expiry 2026-12-01",
  "uber 180",
];

/** One-line quick capture. The hint types itself. The draft stays while search opens. */
export function CaptureBar() {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [hint, setHint] = useState("");
  useEffect(() => subscribeCapture(setQ), []);
  useEffect(() => {
    let phrase = 0;
    let count = 0;
    let deleting = false;
    const id = setInterval(() => {
      const text = HINTS[phrase % HINTS.length] ?? "";
      if (!deleting) {
        count += 1;
        setHint(text.slice(0, count));
        if (count >= text.length) deleting = true;
        return;
      }
      count -= 1;
      setHint(text.slice(0, Math.max(0, count)));
      if (count <= 0) {
        deleting = false;
        phrase += 1;
      }
    }, 90);
    return () => clearInterval(id);
  }, []);
  const r = parseCapture(db, q);
  const ok = r && !("error" in r);
  const save = () => {
    if (!r || "error" in r) return;
    update(r.apply);
    toast(`Saved · ${r.label}`, r.icon);
    setQ("");
  };
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingLeft: 14, backgroundColor: colors.surfaceSecondary, height: 46 }}>
        <TextInput testID="capture-input" value={q} onChangeText={setQ} onSubmitEditing={save} placeholder={hint} placeholderTextColor={colors.muted} returnKeyType="done" style={{ flex: 1, height: 46, color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: 14 }} />
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
