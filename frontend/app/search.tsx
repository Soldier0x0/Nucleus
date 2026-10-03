import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { search } from "@/src/core/search";
import { EmptyState, Eyebrow, Icon, IconButton, Press, T } from "@/src/components/ui";

const SUGGEST = ["Fuel", "Electricity", "Netflix", "Activa", "EMI", "Food"];

export default function Search() {
  const { db } = useStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState("");
  const groups = useMemo(() => search(db, q), [db, q]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.head, { paddingTop: insets.top + 6, borderBottomColor: colors.border }]}>
        <IconButton icon="arrow-left" testID="search-back" label="Back" onPress={() => router.back()} />
        <View style={[styles.box, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong }]}>
          <Icon name="magnify" size={20} color={colors.muted} />
          <TextInput testID="search-input" autoFocus value={q} onChangeText={setQ} placeholder="Search everything" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.onSurface, fontFamily: fonts.text, fontSize: 16, height: 46 }} returnKeyType="search" />
          {q ? <IconButton icon="close-circle" testID="search-clear" label="Clear" onPress={() => setQ("")} /> : null}
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        {!q ? (
          <>
            <Eyebrow style={{ marginBottom: 8 }}>Try</Eyebrow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {SUGGEST.map((s) => (
                <Press key={s} testID={`search-suggest-${s}`} onPress={() => setQ(s)} style={[styles.sug, { borderColor: colors.borderStrong }]}>
                  <T v="label">{s}</T>
                </Press>
              ))}
            </View>
            <T muted style={{ marginTop: 16 }}>Search runs entirely on this device across modules, tools, records and their relationships.</T>
          </>
        ) : groups.length === 0 ? (
          <EmptyState testID="search-empty" icon="text-search" title="No matches" body={`Nothing local matches “${q}”.`} />
        ) : (
          groups.map((g, gi) => (
            <View key={g.title + gi} style={{ marginBottom: 18 }} testID={`search-group-${gi}`}>
              <Eyebrow>{g.title}</Eyebrow>
              {g.summary ? <T v="mono" style={{ fontSize: 13, marginTop: 4 }} testID={`search-group-summary-${gi}`}>{g.summary}</T> : null}
              <View style={[styles.list, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                {g.items.map((it, i) => (
                  <Press key={it.id} testID={`search-result-${gi}-${i}`} onPress={() => router.push(it.route as any)} style={[styles.item, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                    <Icon name={it.icon} size={20} color={colors.muted} />
                    <View style={{ flex: 1 }}>
                      <T v="label" numberOfLines={1}>{it.title}</T>
                      <T muted style={{ fontSize: 12 }} numberOfLines={1}>{it.subtitle}</T>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.muted} />
                  </Press>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: 1 },
  box: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: radius.md, paddingLeft: 12, marginRight: 8 },
  sug: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
  list: { borderWidth: 1, borderRadius: radius.lg, marginTop: 8 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, minHeight: 56 },
}));
