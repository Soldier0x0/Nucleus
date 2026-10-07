import React, { useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { vehicleStats } from "@/src/core/intelligence";
import { deleteVehicle, SERVICE_LABEL } from "@/src/core/actions";
import { daysBetween, fmtDate, num, todayISO } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Amount, Button, Card, EmptyState, Eyebrow, Icon, IconButton, Press, Segmented, StatusBadge, T } from "@/src/components/ui";
import { Countdown, Gauge, LineChart } from "@/src/components/charts";
import { VehicleSheet } from "@/src/components/VehicleSheet";
import { FuelSheet, KIND_ICON, ServiceSheet } from "@/src/components/VehicleForms";
import { WhySheet } from "@/src/components/WhySheet";
import { Sheet } from "@/src/components/Sheet";
import { LinkedSection } from "@/src/components/LinkedSection";
import { VehicleArt } from "@/src/components/VehicleArt";
import { VehicleCare } from "@/src/components/VehicleCare";
import { VehicleJourneySection } from "@/src/components/VehicleJourneySection";
import { Image } from "expo-image";
import { fuelLabel, vehicleBody } from "@/src/core/life";

export default function VehicleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [sheet, setSheet] = useState<null | "fuel" | "service" | "edit" | "why" | "delete">(null);
  const [tab, setTab] = useState<"fuel" | "service" | "linked">("fuel");
  const v = db.vehicles.find((x) => x.id === id);
  if (!v)
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title="Vehicle" />
        <View style={{ padding: 16 }}>
          <EmptyState icon="car-off" title="Vehicle not found" body="It may have been deleted." />
        </View>
      </View>
    );
  const st = vehicleStats(db, v);
  const s = db.settings;
  const today = todayISO();
  const chartW = Math.min(width, 720) - sp.lg * 2 - 34;
  const services = db.services.filter((x) => x.vehicleId === v.id).sort((a, b) => b.date.localeCompare(a.date));
  const sev = st.service.remaining <= 0 ? "urgent" : st.service.remaining <= Math.max(300, st.service.interval * 0.1) ? "upcoming" : "ok";

  const expiry = (label: string, date?: string, testID?: string) => {
    const d = date ? daysBetween(today, date) : undefined;
    return (
      <View style={{ flex: 1 }} testID={testID}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Icon name={label === "Insurance" ? "shield-car" : "smoke"} size={16} color={colors.muted} />
          <Eyebrow>{label}</Eyebrow>
        </View>
        {d === undefined ? (
          <T muted style={{ fontSize: 13 }}>Not set</T>
        ) : (
          <>
            <T v="mono" style={{ marginBottom: 6 }}>{d < 0 ? `expired ${-d}d ago` : `${d} days`}</T>
            <Countdown remaining={d} window={365} />
            <T muted style={{ fontSize: 11, marginTop: 4 }}>{fmtDate(date)}</T>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header
        title={v.name}
        testID="vehicle-detail-header"
        right={
          <>
            <IconButton icon="pencil-outline" testID="vehicle-edit-button" label="Edit" onPress={() => setSheet("edit")} />
            <IconButton icon="delete-outline" testID="vehicle-delete-button" label="Delete" onPress={() => setSheet("delete")} />
          </>
        }
      />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 96, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <Card testID="vehicle-art">
          <View style={{ alignItems: "center" }}>
            {v.cover ? (
              <Image source={{ uri: v.cover }} style={{ width: 220, height: 140, borderRadius: 12, marginBottom: 8 }} contentFit="cover" />
            ) : (
              <VehicleArt body={vehicleBody(v)} width={220} color={colors.onSurface} accent={colors.brandPrimary} />
            )}
            <T muted style={{ fontSize: 12 }}>{[v.make, v.model, fuelLabel(v)].filter(Boolean).join(" · ")}</T>
          </View>
        </Card>
        <Card testID="vehicle-service-card">
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Eyebrow style={{ flex: 1 }}>Since last service</Eyebrow>
            <StatusBadge severity={sev as any} />
          </View>
          <View style={{ alignItems: "center", marginTop: 4 }}>
            <Gauge value={st.service.since} max={st.service.interval} size={230} label={`${num(st.service.since, 0)} ${s.distanceUnit}`} testID="vehicle-gauge" />
          </View>
          <T v="h2" style={{ textAlign: "center" }} testID="vehicle-service-remaining">
            {st.service.remaining > 0 ? `≈ ${num(st.service.remaining, 0)} ${s.distanceUnit} until service` : `Overdue by ${num(-st.service.remaining, 0)} ${s.distanceUnit}`}
          </T>
          <T muted style={{ textAlign: "center", marginTop: 2 }}>
            Interval ~{num(st.service.interval, 0)} {s.distanceUnit} · {st.service.fromHistory ? "learned from your history" : "your setting"}
          </T>
          <Press testID="vehicle-why-button" onPress={() => setSheet("why")} style={[styles.why, { borderColor: colors.borderStrong }]}>
            <Icon name="help-circle-outline" size={16} />
            <T v="caption">Why this estimate?</T>
          </Press>
        </Card>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { l: "Avg mileage", val: isFinite(st.avgMileage) ? num(st.avgMileage, 1) : "—", u: `${s.distanceUnit}/${s.volumeUnit}`, id: "avg" },
            { l: "Cost / " + s.distanceUnit, val: isFinite(st.costPerKm) ? num(st.costPerKm, 2) : "—", u: s.currency, id: "cpk" },
            { l: "Odometer", val: num(st.odometer, 0), u: s.distanceUnit, id: "odo" },
          ].map((m) => (
            <View key={m.id} testID={`vehicle-stat-${m.id}`} style={[styles.stat, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Eyebrow style={{ fontSize: 9 }}>{m.l}</Eyebrow>
              <T v="monoLg" style={{ marginTop: 4 }}>{m.val}</T>
              <T muted style={{ fontSize: 11 }}>{m.u}</T>
            </View>
          ))}
        </View>

        <Card>
          <View style={{ flexDirection: "row", gap: 16 }}>
            {expiry("Insurance", v.insuranceExpiry, "vehicle-insurance")}
            {expiry("PUC", v.pucExpiry, "vehicle-puc")}
          </View>
        </Card>
        <VehicleCare vehicle={v} />
        <VehicleJourneySection vehicle={v} />

        <Card testID="vehicle-mileage-chart">
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Eyebrow style={{ flex: 1 }}>Mileage trend</Eyebrow>
            {isFinite(st.lastMileage) ? <T v="mono" style={{ fontSize: 12 }}>last {num(st.lastMileage, 1)}</T> : null}
          </View>
          {st.mileage.length >= 2 ? (
            <>
              <LineChart data={st.mileage.map((m) => m.value)} width={chartW} height={120} showAvg />
              <T muted style={{ fontSize: 11, marginTop: 6 }}>Dashed line = your average. Each point is one fill-up.</T>
            </>
          ) : (
            <T muted>Log at least 3 fill-ups to see your mileage trend.</T>
          )}
          <View style={{ flexDirection: "row", marginTop: 12, gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Fuel this month</Eyebrow>
              <Amount value={st.monthFuel} v="mono" />
            </View>
            <View style={{ flex: 1 }}>
              <Eyebrow>Fuel all-time</Eyebrow>
              <Amount value={st.totalFuelCost} v="mono" />
            </View>
          </View>
        </Card>

        <Segmented testID="vehicle-log-tabs" value={tab} onChange={setTab} options={[{ value: "fuel", label: `Fuel · ${st.fuel.length}` }, { value: "service", label: `Service · ${services.length}` }, { value: "linked", label: "Linked" }]} />

        {tab === "fuel" && (
          <View style={[styles.list, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} testID="vehicle-fuel-list">
            {st.fuel.length === 0 ? (
              <T muted style={{ padding: 14 }}>No fuel entries yet.</T>
            ) : (
              [...st.fuel].reverse().map((f, i, arr) => {
                const prev = arr[i + 1];
                const km = prev ? (f.odometer - prev.odometer) / f.litres : NaN;
                return (
                  <Press key={f.id} testID={`fuel-row-${i}`} onPress={() => router.push(`/record/fuel/${f.id}`)} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                    <Icon name="gas-station-outline" size={20} color={colors.muted} />
                    <View style={{ flex: 1 }}>
                      <T v="label">{fmtDate(f.date)}</T>
                      <T muted style={{ fontSize: 12 }}>{num(f.odometer, 0)} {s.distanceUnit} · {f.litres} {s.volumeUnit} @ {num(f.price, 2)}</T>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Amount value={f.total} />
                      <T v="mono" muted style={{ fontSize: 11 }}>{isFinite(km) ? `${num(km, 1)} /${s.volumeUnit}` : "first fill"}</T>
                    </View>
                  </Press>
                );
              })
            )}
          </View>
        )}
        {tab === "service" && (
          <View testID="vehicle-service-list">
            {services.length === 0 ? (
              <T muted>No services yet.</T>
            ) : (
              services.map((x, i) => (
                <Press key={x.id} testID={`service-row-${i}`} onPress={() => router.push(`/record/service/${x.id}`)} style={styles.tl}>
                  <View style={{ alignItems: "center", width: 28 }}>
                    <View style={[styles.node, { backgroundColor: colors.surfaceInverse }]}>
                      <Icon name={KIND_ICON[x.kind]} size={14} color={colors.onSurfaceInverse} />
                    </View>
                    {i < services.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: colors.borderStrong }} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 16 }}>
                    <View style={{ flexDirection: "row" }}>
                      <T v="label" style={{ flex: 1 }}>{SERVICE_LABEL[x.kind]}</T>
                      <Amount value={x.cost} />
                    </View>
                    <T muted style={{ fontSize: 12 }}>{fmtDate(x.date)} · {num(x.odometer, 0)} {s.distanceUnit}</T>
                    {Object.keys(x.details).length ? <T style={{ fontSize: 12, marginTop: 2 }}>{Object.values(x.details).join(" · ")}</T> : null}
                  </View>
                </Press>
              ))
            )}
          </View>
        )}
        {tab === "linked" && <LinkedSection refTo={{ kind: "vehicle", id: v.id }} />}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 12, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Button label="Log fuel" icon="gas-station-outline" style={{ flex: 1 }} onPress={() => setSheet("fuel")} testID="vehicle-log-fuel-button" />
        <Button kind="secondary" label="Log service" icon="wrench-outline" style={{ flex: 1 }} onPress={() => setSheet("service")} testID="vehicle-log-service-button" />
      </View>

      {sheet === "fuel" ? <FuelSheet visible onClose={() => setSheet(null)} vehicle={v} /> : null}
      {sheet === "service" ? <ServiceSheet visible onClose={() => setSheet(null)} vehicle={v} /> : null}
      {sheet === "edit" ? <VehicleSheet visible onClose={() => setSheet(null)} vehicle={v} /> : null}
      <WhySheet
        visible={sheet === "why"}
        onClose={() => setSheet(null)}
        title={`${v.name} service estimate`}
        why={{ summary: st.service.explanation, facts: st.service.facts, rule: "Interval = average of the gaps between your general/oil services (needs 3+ services). Otherwise your configured interval is used.", ranking: "Becomes Upcoming within 10% of the interval (min 300 km), Urgent when exceeded." }}
      />
      <Sheet visible={sheet === "delete"} onClose={() => setSheet(null)} title={`Delete ${v.name}?`} testID="vehicle-delete-sheet">
        <T style={{ marginBottom: 16 }}>Removes the vehicle, its fuel and service logs, and the expenses that were auto-created from them.</T>
        <Button
          kind="danger"
          label="Delete vehicle"
          icon="delete-outline"
          testID="vehicle-delete-confirm"
          onPress={() => {
            update((d) => deleteVehicle(d, v.id));
            setSheet(null);
            router.back();
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  why: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, marginTop: 12 },
  stat: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: 12 },
  list: { borderWidth: 1, borderRadius: radius.lg },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, minHeight: 60 },
  tl: { flexDirection: "row", gap: 12 },
  node: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actions: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
}));
