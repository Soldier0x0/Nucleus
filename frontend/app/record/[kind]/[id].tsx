import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { deleteEntity, getEntity, SERVICE_LABEL, setTxnChannel } from "@/src/core/actions";
import { fuelFactsPatch, setFuelFacts } from "@/src/core/fuelCapture";
import { pickPaperDocument, pickPaperPhoto } from "@/src/core/paperFiles";
import type { EntityKind, Paper } from "@/src/core/types";
import { fmtDate, money, num } from "@/src/core/format";
import { CHANNEL_LABELS, channelLabel } from "@/src/core/merchantTable";
import { Header } from "@/src/components/Header";
import { DocumentContent } from "@/src/components/DocumentContent";
import { Button, Chip, ChipRow, EmptyState, Eyebrow, IconButton, T } from "@/src/components/ui";
import { DateField, Field } from "@/src/components/inputs";
import { LinkedSection } from "@/src/components/LinkedSection";
import { Sheet } from "@/src/components/Sheet";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { useToast } from "@/src/components/Toast";

const TITLES: Record<EntityKind, string> = { vehicle: "Vehicle", fuel: "Fuel entry", service: "Service record", txn: "Transaction", subscription: "Subscription", trip: "Trip", appliance: "Appliance", note: "Note", media: "Shelf item", paper: "Paper" };

/** Generic record view: fields + relationships. Every entity kind gets this for free. */
export default function RecordDetail() {
  const { kind, id } = useLocalSearchParams<{ kind: EntityKind; id: string }>();
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [del, setDel] = useState(false);
  const [detach, setDetach] = useState<null | "photo" | "bill">(null);
  const [fuelEdit, setFuelEdit] = useState(false);
  const [fuelDate, setFuelDate] = useState("");
  const [fuelOdo, setFuelOdo] = useState("");
  const [fuelStation, setFuelStation] = useState("");
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
    fields = [["Vehicle", vName(e.vehicleId)], ["Date", fmtDate(e.date)], ["Odometer", `${num(e.odometer, 0)} ${s.distanceUnit}${e.odometerEstimated ? " · estimated" : ""}`], ...(e.station ? ([["Station", e.station]] as [string, string][]) : []), ["Quantity", `${e.litres} ${s.volumeUnit}`], ["Price", `${num(e.price, 2)} / ${s.volumeUnit}`]];
  } else if (kind === "service") {
    headline = SERVICE_LABEL[e.kind];
    fields = [["Vehicle", vName(e.vehicleId)], ["Date", fmtDate(e.date)], ["Odometer", `${num(e.odometer, 0)} ${s.distanceUnit}`], ["Cost", money(e.cost, cur)], ...(Object.entries(e.details) as [string, string][]).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v] as [string, string])];
  } else if (kind === "txn") {
    headline = `${e.type === "income" ? "+" : "-"}${money(e.amount, cur)}`;
    fields = [["Type", e.type], ["Category", e.category], ...(e.item ? ([["Item", e.item]] as [string, string][]) : []), ...(e.channel ? ([["Channel", channelLabel(e.channel)]] as [string, string][]) : []), ["Date", fmtDate(e.date)], ...(e.origCurrency ? ([["Original", `${num(e.origAmount, 2)} ${e.origCurrency}`]] as [string, string][]) : []), ...(e.note ? ([["Note", e.note]] as [string, string][]) : [])];
  } else if (kind === "subscription") {
    headline = e.name;
    fields = [["Amount", money(e.amount, cur)], ["Cycle", e.cycle], ["Next renewal", fmtDate(e.nextRenewal)], ["Category", e.category], ["Status", e.active ? "Active" : "Paused"]];
  } else {
    router.replace((kind === "vehicle" ? `/vehicles/${id}` : kind === "trip" ? `/travel/${id}` : kind === "note" ? `/notes?id=${id}` : kind === "media" ? "/media" : kind === "paper" ? "/papers" : "/home") as any);
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
        {kind === "fuel" ? (
          <Button
            kind="secondary"
            label="Edit date, odometer, station"
            testID="fuel-edit-open"
            style={{ marginTop: 12 }}
            onPress={() => {
              setFuelDate(e.date);
              setFuelOdo(e.odometerEstimated ? "" : String(e.odometer));
              setFuelStation(e.station ?? "");
              setFuelEdit(true);
            }}
          />
        ) : null}
        {kind === "txn" && e.type === "expense" ? (
          <View style={{ marginTop: 16 }} testID="record-channel-section">
            <Eyebrow style={{ marginBottom: 8 }}>{e.channel ? "Channel" : "Tag this? (optional)"}</Eyebrow>
            <ChipRow testID="record-channel-row">
              {CHANNEL_LABELS.map((row) => (
                <Chip
                  key={row.value}
                  label={row.label}
                  selected={e.channel === row.value}
                  onPress={() => update((d) => setTxnChannel(d, id, e.channel === row.value ? undefined : row.value))}
                  testID={`record-channel-${row.value}`}
                />
              ))}
            </ChipRow>
          </View>
        ) : null}
        {kind === "txn" && e.photo ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Image source={{ uri: e.photo }} style={{ width: "100%", height: 180, borderRadius: radius.lg }} contentFit="cover" />
            <Button
              small
              kind="ghost"
              label="Remove photo"
              testID="txn-photo-clear-saved"
              onPress={() => setDetach("photo")}
            />
          </View>
        ) : null}
        {kind === "service" && e.billFile ? (
          <View style={{ marginTop: 12, gap: 8 }} testID="service-bill-detail">
            <Eyebrow>Service bill</Eyebrow>
            <View style={{ height: 280, borderRadius: radius.lg, overflow: "hidden" }}>
              <DocumentContent
                paper={{ id: `svc-${id}`, kind: "other", title: "Bill", createdAt: e.date, file: e.billFile, mime: e.billMime } as Paper}
                testID="service-bill-viewer"
              />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button
                small
                kind="ghost"
                label="Remove bill"
                testID="service-bill-clear-saved"
                onPress={() => setDetach("bill")}
              />
              <Button
                small
                kind="secondary"
                icon="image-outline"
                label="Replace photo"
                testID="service-bill-replace-photo"
                onPress={async () => {
                  const next = await pickPaperPhoto();
                  if (!next || typeof next === "string") return;
                  update((d) => ({
                    ...d,
                    services: d.services.map((row) => (row.id === id ? { ...row, billFile: next.uri, billMime: next.mime } : row)),
                  }));
                }}
              />
              <Button
                small
                kind="secondary"
                icon="file-pdf-box"
                label="Replace PDF"
                testID="service-bill-replace-pdf"
                onPress={async () => {
                  const next = await pickPaperDocument();
                  if (!next || typeof next === "string") return;
                  update((d) => ({
                    ...d,
                    services: d.services.map((row) => (row.id === id ? { ...row, billFile: next.uri, billMime: next.mime } : row)),
                  }));
                }}
              />
            </View>
          </View>
        ) : null}
        <LinkedSection refTo={{ kind, id }} />
      </ScrollView>
      <Sheet visible={fuelEdit && kind === "fuel"} onClose={() => setFuelEdit(false)} title="Fill details" testID="fuel-edit-sheet" footer={<Button label="Save" testID="fuel-edit-save" onPress={() => {
        update((d) => setFuelFacts(d, id, fuelFactsPatch(fuelDate, fuelStation, fuelOdo)));
        setFuelEdit(false);
        toast("Saved");
      }} />}>
        <DateField label="Date" optional value={fuelDate || undefined} onChange={(value) => setFuelDate(value ?? "")} testID="fuel-edit-date" />
        <Field label="Odometer" numeric testID="fuel-edit-odometer" value={fuelOdo} onChangeText={setFuelOdo} />
        <Field label="Station" testID="fuel-edit-station" value={fuelStation} onChangeText={setFuelStation} />
      </Sheet>
      <ConfirmSheet
        visible={del}
        id="record-delete"
        title="Delete this record?"
        body={`${kind === "fuel" || kind === "service" ? "The expense that was auto-created from it will be removed too." : "Its links to other records will be removed."} This can't be undone.`}
        confirmLabel="Delete"
        onCancel={() => setDel(false)}
        onConfirm={() => {
          update((d) => deleteEntity(d, { kind, id }));
          setDel(false);
          toast("Deleted", "delete-outline");
          router.back();
        }}
      />
      <ConfirmSheet
        visible={!!detach}
        id="record-detach"
        title={detach === "bill" ? "Remove the bill file?" : "Remove the photo?"}
        body={detach === "bill" ? "The attached bill file will be detached from this record. The record itself stays." : "The attached photo will be detached from this record. The record itself stays."}
        confirmLabel="Remove"
        onCancel={() => setDetach(null)}
        onConfirm={() => {
          if (detach === "photo") update((d) => ({ ...d, txns: d.txns.map((row) => (row.id === id ? { ...row, photo: undefined } : row)) }));
          else if (detach === "bill") update((d) => ({ ...d, services: d.services.map((row) => (row.id === id ? { ...row, billFile: undefined, billMime: undefined } : row)) }));
          setDetach(null);
          toast(detach === "bill" ? "Bill file removed" : "Photo removed", "delete-outline");
        }}
      />
    </View>
  );
}
