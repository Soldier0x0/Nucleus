import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { deleteEntity, getEntity, SERVICE_LABEL } from "@/src/core/actions";
import type { EntityKind } from "@/src/core/types";
import { fmtDate, money, num } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Button, EmptyState, Eyebrow, IconButton, T } from "@/src/components/ui";
import { LinkedSection } from "@/src/components/LinkedSection";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";

const TITLES: Record<EntityKind, string> = { vehicle: "Vehicle", fuel: "Fuel entry", service: "Service record", txn: "Transaction", subscription: "Subscription", trip: "Trip", appliance: "Appliance" };

/** Generic record view: fields + relationships. Every entity kind gets this for free. */
export default function RecordDetail() {
  const { kind, id } = useLocalSearchParams<{ kind: EntityKind; id: string }>();
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [del, setDel] = useState(false);
  const e = getEntity(db, { kind, id });
  const s = db.settings;
  const cur = s.currency;
  if (!e)
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title={TITLES[kind] ?? "Record"} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="file-question-outline" title="Record not found" body="It may have been deleted." testID="record-missing" />
        </View>
      </View>
    );

  const vName = (vid: string) => db.vehicles.find((v) => v.id === vid)?.name ?? "—";
  let headline = "";
  let fields: [string, string][] = [];
  if (kind === "fuel") {
    headline = money(e.total, cur);
    fields = [["Vehicle", vName(e.vehicleId)], ["Date", fmtDate(e.date)], ["Odometer", `${num(e.odometer, 0)} ${s.distanceUnit}`], ["Quantity", `${e.litres} ${s.volumeUnit}`], ["Price", `${num(e.price, 2)} / ${s.volumeUnit}`]];
  } else if (kind === "service") {
    headline = SERVICE_LABEL[e.kind];
    fields = [["Vehicle", vName(e.vehicleId)], ["Date", fmtDate(e.date)], ["Odometer", `${num(e.odometer, 0)} ${s.distanceUnit}`], ["Cost", money(e.cost, cur)], ...(Object.entries(e.details) as [string, string][]).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v] as [string, string])];
  } else if (kind === "txn") {
    headline = `${e.type === "income" ? "+" : "-"}${money(e.amount, cur)}`;
    fields = [["Type", e.type], ["Category", e.category], ["Date", fmtDate(e.date)], ...(e.origCurrency ? ([["Original", `${num(e.origAmount, 2)} ${e.origCurrency}`]] as [string, string][]) : []), ...(e.note ? ([["Note", e.note]] as [string, string][]) : [])];
  } else if (kind === "subscription") {
    headline = e.name;
    fields = [["Amount", money(e.amount, cur)], ["Cycle", e.cycle], ["Next renewal", fmtDate(e.nextRenewal)], ["Category", e.category], ["Status", e.active ? "Active" : "Paused"]];
  } else {
    router.replace((kind === "vehicle" ? `/vehicles/${id}` : kind === "trip" ? `/travel/${id}` : "/home") as any);
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={TITLES[kind]} testID="record-header" right={<IconButton icon="delete-outline" label="Delete" testID="record-delete-button" onPress={() => setDel(true)} />} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <Eyebrow>{TITLES[kind]}</Eyebrow>
        <T v="monoXl" style={{ marginTop: 4, marginBottom: 16 }} testID="record-headline">
          {s.privacyMode && kind !== "service" && kind !== "subscription" ? "•••••" : headline}
        </T>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }} testID="record-fields">
          {fields.map(([k, v], i) => (
            <View key={k} style={{ flexDirection: "row", alignItems: "center", minHeight: 46, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.divider }}>
              <T muted style={{ flex: 1 }}>{k}</T>
              <T v="mono" style={{ textTransform: k === "Type" || k === "Cycle" ? "capitalize" : "none", flexShrink: 1, textAlign: "right" }}>{v}</T>
            </View>
          ))}
        </View>
        <LinkedSection refTo={{ kind, id }} />
      </ScrollView>
      <Sheet visible={del} onClose={() => setDel(false)} title="Delete this record?" testID="record-delete-sheet">
        <T style={{ marginBottom: 16 }}>{kind === "fuel" || kind === "service" ? "The expense that was auto-created from it will be removed too." : "Its links to other records will be removed."}</T>
        <Button
          kind="danger"
          label="Delete"
          icon="delete-outline"
          testID="record-delete-confirm"
          onPress={() => {
            update((d) => deleteEntity(d, { kind, id }));
            setDel(false);
            toast("Deleted", "delete-outline");
            router.back();
          }}
        />
      </Sheet>
    </View>
  );
}
