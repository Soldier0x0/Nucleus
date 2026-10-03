import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { usesNativeTabs } from "@/src/navigation";
import { AttentionItem } from "@/src/core/intelligence";
import { allAttention, visibleAttention } from "@/src/core/attention";
import { paySubscription } from "@/src/core/actions";
import { addDays, todayISO } from "@/src/core/format";
import { Button, EmptyState, Eyebrow, Icon, Press, StatusBadge, T } from "@/src/components/ui";
import { WhySheet } from "@/src/components/WhySheet";
import { useToast } from "@/src/components/Toast";

const GROUPS = [
  { sev: "urgent", label: "Urgent", icon: "alert-octagon" },
  { sev: "upcoming", label: "Upcoming", icon: "clock-alert-outline" },
  { sev: "info", label: "Info", icon: "information-outline" },
] as const;

export default function Attention() {
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const items = visibleAttention(db);
  const hiddenCount = allAttention(db).length - items.length;
  const [open, setOpen] = useState<AttentionItem | null>(null);

  const mark = (it: AttentionItem, status: "done" | "dismissed" | "snoozed") => {
    update((d) => {
      let next = d;
      if (status === "done" && it.subscriptionId) next = paySubscription(next, it.subscriptionId);
      return { ...next, attention: { ...next.attention, [it.key]: { status, until: status === "snoozed" ? addDays(todayISO(), 3) : undefined } } };
    });
    setOpen(null);
    toast(status === "done" ? (it.subscriptionId ? "Payment logged in Money · renewal moved forward" : "Marked done") : status === "snoozed" ? "Snoozed for 3 days" : "Dismissed", status === "done" ? "check-circle-outline" : status === "snoozed" ? "alarm-snooze" : "eye-off-outline");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: sp.lg, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Eyebrow>Across all modules</Eyebrow>
        <T v="title" testID="attention-title">Attention</T>
        {items.length ? <T muted style={{ fontSize: 12, marginTop: 6 }}>Swipe right to snooze, left to mark done. The buttons under each item do the same.</T> : null}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          {GROUPS.map((g) => (
            <View key={g.sev} style={[styles.count, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`attention-count-${g.sev}`}>
              <Icon name={g.icon} size={16} color={g.sev === "urgent" ? colors.error : g.sev === "upcoming" ? colors.warning : colors.info} />
              <T v="monoLg" style={{ fontSize: 18 }}>{items.filter((i) => i.severity === g.sev).length}</T>
              <T muted v="caption">{g.label}</T>
            </View>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: bottomChrome + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {items.length === 0 ? (
          <EmptyState testID="attention-empty" icon="check-all" title="All caught up" body="Nothing needs you right now. Nucleus checks expiry dates, service intervals, renewals, budgets and spending patterns whenever your data changes." />
        ) : (
          GROUPS.map((g) => {
            const list = items.filter((i) => i.severity === g.sev);
            if (!list.length) return null;
            return (
              <View key={g.sev} style={{ marginBottom: 20 }} testID={`attention-group-${g.sev}`}>
                <Eyebrow style={{ marginBottom: 8 }}>
                  {g.label} · {list.length}
                </Eyebrow>
                {list.map((it, i) => (
                  <Animated.View key={it.key} entering={FadeInDown.delay(i * 40)} layout={LinearTransition}>
                    <Swipeable
                      overshootLeft={false}
                      overshootRight={false}
                      renderLeftActions={() => (
                        <View style={[styles.swipe, { backgroundColor: colors.warning }]}>
                          <T v="label">Snooze</T>
                        </View>
                      )}
                      renderRightActions={() => (
                        <View style={[styles.swipe, { backgroundColor: colors.success }]}>
                          <T v="label" color={colors.onSuccess}>Done</T>
                        </View>
                      )}
                      onSwipeableOpen={(direction) => mark(it, direction === "right" ? "done" : "snoozed")}
                    >
                    <Press testID={`attention-item-${it.key}`} onPress={() => setOpen(it)} style={[styles.item, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderLeftColor: g.sev === "urgent" ? colors.error : g.sev === "upcoming" ? colors.warning : colors.info }]}>
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={[styles.ic, { backgroundColor: colors.surfaceTertiary }]}>
                          <Icon name={it.icon} size={20} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <StatusBadge severity={it.severity} />
                          <T v="label" style={{ marginTop: 6 }} numberOfLines={2}>{it.title}</T>
                          <T muted style={{ fontSize: 13 }} numberOfLines={2}>{it.subtitle}</T>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
                        <Press testID={`attention-why-${it.key}`} onPress={() => setOpen(it)} style={[styles.act, { backgroundColor: colors.surfaceInverse }]}>
                          <Icon name="help-circle-outline" size={16} color={colors.onSurfaceInverse} />
                          <T v="caption" color={colors.onSurfaceInverse}>Why?</T>
                        </Press>
                        <Press testID={`attention-done-${it.key}`} onPress={() => mark(it, "done")} style={[styles.act, { borderColor: colors.borderStrong, borderWidth: 1 }]}>
                          <Icon name="check" size={16} />
                          <T v="caption">{it.subscriptionId ? "Paid" : "Done"}</T>
                        </Press>
                        <Press testID={`attention-snooze-${it.key}`} onPress={() => mark(it, "snoozed")} style={[styles.act, { borderColor: colors.borderStrong, borderWidth: 1 }]}>
                          <Icon name="alarm-snooze" size={16} />
                          <T v="caption">3d</T>
                        </Press>
                        <Press testID={`attention-dismiss-${it.key}`} onPress={() => mark(it, "dismissed")} style={[styles.act, { borderColor: colors.borderStrong, borderWidth: 1 }]} accessibilityLabel="Dismiss">
                          <Icon name="eye-off-outline" size={16} />
                        </Press>
                      </View>
                    </Press>
                    </Swipeable>
                  </Animated.View>
                ))}
              </View>
            );
          })
        )}
        {hiddenCount > 0 ? (
          <Button
            kind="ghost"
            small
            icon="restore"
            label={`Restore ${hiddenCount} resolved / snoozed`}
            testID="attention-restore-button"
            style={{ marginTop: 8 }}
            onPress={() => {
              const keys = new Set(allAttention(db).map((i) => i.key));
              update((d) => ({ ...d, attention: Object.fromEntries(Object.entries(d.attention).filter(([k]) => !keys.has(k))) }));
            }}
          />
        ) : null}
      </ScrollView>
      <WhySheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.title ?? ""}
        why={open?.why}
        route={open?.route}
        actions={
          open ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button label={open.subscriptionId ? "Log payment" : "Done"} icon="check" style={{ flex: 1 }} testID="why-done-button" onPress={() => mark(open, "done")} />
              <Button kind="secondary" label="Snooze 3d" icon="alarm-snooze" style={{ flex: 1 }} testID="why-snooze-button" onPress={() => mark(open, "snoozed")} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  count: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 10, height: 44 },
  item: { borderWidth: 1, borderLeftWidth: 4, borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  ic: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  act: { flexDirection: "row", alignItems: "center", gap: 4, height: 36, paddingHorizontal: 12, borderRadius: radius.md },
  swipe: { justifyContent: "center", paddingHorizontal: 18, borderRadius: radius.lg, marginBottom: 10 },
}));
