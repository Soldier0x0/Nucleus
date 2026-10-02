import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { getEntity, linkedRefs, SERVICE_LABEL } from "@/src/core/actions";
import type { Ref } from "@/src/core/types";
import { fmtDate, money } from "@/src/core/format";
import { Eyebrow, Icon, Press, T } from "./ui";

export function describeRef(db: ReturnType<typeof useStore>["db"], ref: Ref) {
  const e = getEntity(db, ref);
  const cur = db.settings.currency;
  switch (ref.kind) {
    case "vehicle":
      return { icon: e.type === "bike" ? "motorbike" : "car-side", title: e.name, sub: "Vehicle", route: `/vehicles/${e.id}` };
    case "fuel":
      return { icon: "gas-station-outline", title: `Fuel · ${e.litres} L`, sub: `${fmtDate(e.date)} · ${money(e.total, cur)}`, route: `/record/fuel/${e.id}` };
    case "service":
      return { icon: "wrench-outline", title: SERVICE_LABEL[e.kind], sub: `${fmtDate(e.date)} · ${money(e.cost, cur)}`, route: `/record/service/${e.id}` };
    case "txn":
      return { icon: "swap-vertical", title: `${e.type === "income" ? "Income" : "Expense"} · ${e.category}`, sub: `${fmtDate(e.date)} · ${money(e.amount, cur)}`, route: `/record/txn/${e.id}` };
    case "subscription":
      return { icon: "autorenew", title: e.name, sub: `Subscription · ${money(e.amount, cur)}`, route: `/record/subscription/${e.id}` };
  }
}

/** Relationship navigator shown on every record. */
export function LinkedSection({ refTo }: { refTo: Ref }) {
  const { db } = useStore();
  const { colors } = useTheme();
  const router = useRouter();
  const links = linkedRefs(db, refTo);
  return (
    <View testID="linked-section" style={{ marginTop: 24 }}>
      <Eyebrow style={{ marginBottom: 8 }}>Linked · {links.length}</Eyebrow>
      {links.length === 0 ? (
        <T muted>No linked records yet.</T>
      ) : (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surfaceSecondary }}>
          {links.map((l, i) => {
            const d = describeRef(db, l.ref)!;
            return (
              <Press key={l.ref.kind + l.ref.id} testID={`linked-item-${l.ref.kind}-${i}`} onPress={() => router.push(d.route as any)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.divider }}>
                <Icon name={d.icon} size={20} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <T v="label">{d.title}</T>
                  <T muted style={{ fontSize: 12 }}>
                    {l.rel} · {d.sub}
                  </T>
                </View>
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </Press>
            );
          })}
        </View>
      )}
    </View>
  );
}
