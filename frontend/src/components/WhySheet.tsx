import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { radius, useTheme, bindLookStyles } from "@/src/theme";
import type { Why } from "@/src/core/intelligence";
import { Sheet } from "./Sheet";
import { Button, Eyebrow, Icon, T } from "./ui";

/** Explainability surface: every system-generated insight can show its reasoning and data. */
export function WhySheet({ visible, onClose, title, why, route, actions }: { visible: boolean; onClose: () => void; title: string; why?: Why; route?: string; actions?: React.ReactNode }) {
  const { colors } = useTheme();
  const router = useRouter();
  if (!why) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title="Why am I seeing this?" testID="why-sheet">
      <T v="h2" style={{ marginBottom: 8 }} testID="why-title">
        {title}
      </T>
      <T testID="why-summary" style={{ marginBottom: 16 }}>
        {why.summary}
      </T>
      <Eyebrow>Data used</Eyebrow>
      <View style={[styles.table, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} testID="why-facts">
        {why.facts.map((f, i) => (
          <View key={i} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
            <T muted style={{ flex: 1 }}>
              {f.label}
            </T>
            <T v="mono">{f.value}</T>
          </View>
        ))}
      </View>
      <View style={[styles.rule, { backgroundColor: colors.surfaceTertiary }]}>
        <Icon name="function-variant" size={18} color={colors.muted} />
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 4 }}>Rule</Eyebrow>
          <T testID="why-rule">{why.rule}</T>
          <T muted style={{ marginTop: 6, fontSize: 12 }}>
            {why.ranking}
          </T>
        </View>
      </View>
      <View style={{ gap: 8, marginTop: 16 }}>
        {actions}
        {route ? (
          <Button
            kind="ghost"
            label="Open related module"
            icon="arrow-top-right"
            testID="why-open-module"
            onPress={() => {
              onClose();
              router.push(route as any);
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  table: { borderWidth: 1, borderRadius: radius.md, marginTop: 8, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, minHeight: 40 },
  rule: { flexDirection: "row", gap: 10, padding: 12, borderRadius: radius.md },
}));
