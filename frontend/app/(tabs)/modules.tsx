import React from "react";
import { StyleSheet, Switch, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { usesNativeTabs } from "@/src/navigation";
import { MODULES, moduleById, TILE_META } from "@/src/core/modules";
import type { DB, ModuleId } from "@/src/core/types";
import { Eyebrow, Icon, IconButton, Press, T } from "@/src/components/ui";
import { DragRow, moveItem } from "@/src/components/Reorderable";

function move<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const a = [...arr];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}

export default function Modules() {
  const { db, setSettings, session } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const s = db.settings;
  const planned = MODULES.filter((m) => m.status === "planned");
  const visible = session === "real" ? s.modules : s.modules.filter((m) => m.id !== "cycle");
  const withHidden = (nextVisible: typeof visible) => [...nextVisible, ...s.modules.filter((m) => !visible.some((row) => row.id === m.id))];
  const sw = { trackColor: { true: colors.brandPrimary, false: colors.surfaceTertiary }, thumbColor: colors.surfaceSecondary };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: sp.lg, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Eyebrow>Your toolkit</Eyebrow>
        <T v="title" testID="modules-title">Modules</T>
      </View>
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: bottomChrome + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <T muted style={{ fontSize: 12, marginBottom: 10 }}>Hold a row, then drag. The arrows do the same thing.</T>
        <Eyebrow style={{ marginBottom: 8 }}>Installed · {visible.length}</Eyebrow>
        {visible.map((ms, i) => {
          const m = moduleById(ms.id);
          return (
            <DragRow key={ms.id} index={i} count={visible.length} rowHeight={76} onMove={(from, to) => setSettings({ modules: withHidden(moveItem(visible, from, to)) })}>
            <View testID={`module-card-${ms.id}`} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: ms.enabled ? 1 : 0.7 }]}>
              <Press testID={`module-open-${ms.id}`} disabled={!ms.enabled} onPress={() => router.push(m.route as any)} style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <View style={[styles.ic, { backgroundColor: ms.enabled ? colors.surfaceInverse : colors.surfaceTertiary }]}>
                  <Icon name={m.icon} size={22} color={ms.enabled ? colors.onSurfaceInverse : colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="label">{m.name}</T>
                  <T muted style={{ fontSize: 12 }} numberOfLines={2}>
                    {ms.enabled ? `${m.description}${countLine(db, ms.id)}` : "Off · not loaded, not searched"}
                  </T>
                </View>
              </Press>
              <View style={{ alignItems: "center" }}>
                <Switch testID={`module-toggle-${ms.id}`} value={ms.enabled} onValueChange={(v) => setSettings({ modules: s.modules.map((x) => (x.id === ms.id ? { ...x, enabled: v } : x)) })} {...sw} />
              </View>
              <View>
                <IconButton icon="chevron-up" testID={`module-up-${ms.id}`} label="Move up" onPress={() => (Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), setSettings({ modules: withHidden(move(visible, i, -1)) }))} />
                <IconButton icon="chevron-down" testID={`module-down-${ms.id}`} label="Move down" onPress={() => (Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), setSettings({ modules: withHidden(move(visible, i, 1)) }))} />
              </View>
            </View>
            </DragRow>
          );
        })}

        <Eyebrow style={{ marginTop: 20, marginBottom: 8 }}>Home board</Eyebrow>
        <T muted style={{ fontSize: 12, marginBottom: 8 }}>These tiles stay on the home screen. They are not reset each day. A trip board is a temporary extra — switch back to Home when you return.</T>
        <View style={[styles.list, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          {s.tiles.map((t, i) => {
            const meta = TILE_META[t.id];
            const modOff = meta.module && !s.modules.find((m) => m.id === meta.module)?.enabled;
            return (
              <DragRow key={t.id} index={i} count={s.tiles.length} rowHeight={56} onMove={(from, to) => setSettings({ tiles: moveItem(s.tiles, from, to) })}>
              <View testID={`tile-row-${t.id}`} style={[styles.tileRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                <Icon name={meta.icon} size={20} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <T v="label">{meta.name}</T>
                  {modOff ? <T muted style={{ fontSize: 12 }}>Module is off</T> : null}
                </View>
                <IconButton icon="arrow-up" testID={`tile-up-${t.id}`} label="Move up" onPress={() => setSettings({ tiles: move(s.tiles, i, -1) })} />
                <IconButton icon="arrow-down" testID={`tile-down-${t.id}`} label="Move down" onPress={() => setSettings({ tiles: move(s.tiles, i, 1) })} />
                <Switch testID={`tile-toggle-${t.id}`} value={t.enabled} onValueChange={(v) => setSettings({ tiles: s.tiles.map((x) => (x.id === t.id ? { ...x, enabled: v } : x)) })} {...sw} />
              </View>
              </DragRow>
            );
          })}
        </View>

        {planned.length ? <Eyebrow style={{ marginTop: 20, marginBottom: 8 }}>On the roadmap</Eyebrow> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {planned.map((m) => (
            <View key={m.id} testID={`planned-module-${m.id}`} style={[styles.planned, { borderColor: colors.borderStrong }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Icon name={m.icon} size={22} color={colors.muted} />
                <T v="mono" muted style={{ fontSize: 10 }}>PHASE {m.phase}</T>
              </View>
              <T v="label" style={{ marginTop: 8 }}>{m.name}</T>
              <T muted style={{ fontSize: 12 }} numberOfLines={3}>{m.description}</T>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function countLine(db: DB, id: ModuleId) {
  const n = (() => {
    switch (id) {
      case "vehicles":
        return db.vehicles.length;
      case "money":
        return db.txns.length;
      case "travel":
        return db.trips.length;
      case "home":
        return db.appliances.length;
      case "notes":
        return db.notes.length;
      case "rules":
        return db.rules.length;
      case "media":
        return db.media.length;
      case "papers":
        return db.papers.length;
      case "builder":
        return db.customTools.length;
      case "kanban":
        return db.kanban.length;
      case "wiki":
        return db.wiki.length;
      case "tools":
      case "dev":
      case "lab":
      case "net":
        return 0;
      case "cycle":
        return db.cycle.days.length;
      default: {
        const unknown: never = id;
        return unknown;
      }
    }
  })();
  return n ? ` · ${n}` : "";
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.lg, paddingLeft: 12, paddingVertical: 4, marginBottom: 10 },
  ic: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  list: { borderWidth: 1, borderRadius: radius.lg },
  tileRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 12, paddingRight: 8, minHeight: 56 },
  planned: { width: "48%", flexGrow: 1, borderWidth: 1, borderStyle: "dashed", borderRadius: radius.lg, padding: 12 },
});
