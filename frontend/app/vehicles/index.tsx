import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { vehicleStats } from "@/src/core/intelligence";
import { fuelLabel, vehicleBody } from "@/src/core/life";
import { num } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { VehicleArt } from "@/src/components/VehicleArt";
import { Button, Card, EmptyState, Eyebrow, IconButton, T } from "@/src/components/ui";
import { Bar } from "@/src/components/charts";
import { VehicleSheet } from "@/src/components/VehicleSheet";
import { ModuleGate } from "@/src/components/ModuleGate";

export default function Vehicles() {
  const { db, setSettings } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [add, setAdd] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Vehicles" testID="vehicles-header" right={<IconButton icon="plus" testID="vehicles-add-button" label="Add vehicle" onPress={() => setAdd(true)} />} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {db.vehicles.length === 0 ? (
          <EmptyState testID="vehicles-empty" icon="car-side" title="No vehicles yet" body="Add a car or bike to track fuel, mileage, services and expiry dates." action={<Button label="Add vehicle" icon="plus" onPress={() => setAdd(true)} testID="vehicles-empty-add-button" />} />
        ) : (
          db.vehicles.map((v) => {
            const st = vehicleStats(db, v);
            const isDefault = db.settings.defaultVehicleId === v.id;
            return (
              <Card key={v.id} testID={`vehicle-card-${v.id}`} onPress={() => router.push(`/vehicles/${v.id}`)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[styles.ic, { backgroundColor: colors.surfaceTertiary }]}>
                    <VehicleArt body={vehicleBody(v)} width={72} color={colors.onSurface} accent={colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="h2">{v.name}</T>
                    <T muted style={{ fontSize: 12 }}>{[v.make, v.model, v.plate, fuelLabel(v)].filter(Boolean).join(" · ")}</T>
                  </View>
                  <IconButton icon={isDefault ? "star" : "star-outline"} label="Set default" testID={`vehicle-default-${v.id}`} onPress={() => setSettings({ defaultVehicleId: v.id })} />
                </View>
                <View style={{ flexDirection: "row", marginTop: 14, gap: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Eyebrow>Odometer</Eyebrow>
                    <T v="mono">{num(st.odometer, 0)} {db.settings.distanceUnit}</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Eyebrow>Mileage</Eyebrow>
                    <T v="mono">{isFinite(st.avgMileage) ? `${num(st.avgMileage, 1)} /${db.settings.volumeUnit}` : "—"}</T>
                  </View>
                </View>
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <T v="caption" muted>Service cycle</T>
                    <T v="caption">{st.service.remaining > 0 ? `${num(st.service.remaining, 0)} left` : "overdue"}</T>
                  </View>
                  <Bar value={st.service.since} max={st.service.interval} />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
      {add ? <VehicleSheet visible={add} onClose={() => setAdd(false)} /> : null}
      <ModuleGate id="vehicles" name="Vehicles" icon="car-side" />
    </View>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({ ic: { width: 84, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", overflow: "hidden" } }));
