import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "@/src/core/store";
import { upsertVehicle } from "@/src/core/actions";
import type { Vehicle } from "@/src/core/types";
import { parseNum, uid } from "@/src/core/format";
import { Sheet } from "./Sheet";
import { DateField, Field } from "./inputs";
import { Button, Chip, Eyebrow, Segmented, T } from "./ui";
import { useToast } from "./Toast";

export function VehicleSheet({ visible, onClose, vehicle }: { visible: boolean; onClose: () => void; vehicle?: Vehicle }) {
  const { update, db } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [f, setF] = useState(() => ({
    name: vehicle?.name ?? "",
    type: vehicle?.type ?? ("car" as Vehicle["type"]),
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    plate: vehicle?.plate ?? "",
    fuelType: vehicle?.fuelType ?? ("petrol" as Vehicle["fuelType"]),
    initialOdometer: vehicle ? String(vehicle.initialOdometer) : "",
    serviceIntervalKm: vehicle ? String(vehicle.serviceIntervalKm) : "",
    insuranceExpiry: vehicle?.insuranceExpiry,
    pucExpiry: vehicle?.pucExpiry,
  }));
  const [err, setErr] = useState<string>();
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const defaultInterval = f.type === "bike" ? 3000 : 10000;
  const dist = db.settings.distanceUnit;

  const save = () => {
    if (!f.name.trim()) return setErr("Give your vehicle a name");
    const odo = f.initialOdometer ? parseNum(f.initialOdometer) : 0;
    if (isNaN(odo) || odo < 0) return setErr(undefined);
    const v: Vehicle = {
      id: vehicle?.id ?? uid(),
      createdAt: vehicle?.createdAt ?? new Date().toISOString(),
      name: f.name.trim(),
      type: f.type,
      make: f.make || undefined,
      model: f.model || undefined,
      plate: f.plate || undefined,
      fuelType: f.fuelType,
      initialOdometer: odo,
      serviceIntervalKm: parseNum(f.serviceIntervalKm) || defaultInterval,
      insuranceExpiry: f.insuranceExpiry,
      pucExpiry: f.pucExpiry,
    };
    update((d) => upsertVehicle(d, v));
    onClose();
    toast(vehicle ? "Vehicle updated" : `${v.name} added`, "car-side");
    if (!vehicle) router.push(`/vehicles/${v.id}`);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={vehicle ? "Edit vehicle" : "Add vehicle"} testID="vehicle-sheet" footer={<Button label="Save vehicle" icon="check" onPress={save} testID="vehicle-save-button" />}>
      <Segmented testID="vehicle-type" value={f.type} onChange={(v) => set({ type: v })} options={[{ value: "car", label: "Car" }, { value: "bike", label: "Bike" }, { value: "other", label: "Other" }]} />
      <View style={{ height: 12 }} />
      <Field label="Name" testID="vehicle-name-input" value={f.name} onChangeText={(t) => (set({ name: t }), setErr(undefined))} placeholder="e.g. Activa, Family car" error={err} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field style={{ flex: 1 }} label="Make" testID="vehicle-make-input" value={f.make} onChangeText={(t) => set({ make: t })} placeholder="Honda" />
        <Field style={{ flex: 1 }} label="Model" testID="vehicle-model-input" value={f.model} onChangeText={(t) => set({ model: t })} placeholder="Activa 6G" />
      </View>
      <Field label="Registration (optional)" testID="vehicle-plate-input" value={f.plate} onChangeText={(t) => set({ plate: t })} autoCapitalize="characters" />
      <Eyebrow style={{ marginBottom: 8 }}>Fuel</Eyebrow>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {(["petrol", "diesel", "cng", "electric", "other"] as const).map((t) => (
          <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} selected={f.fuelType === t} onPress={() => set({ fuelType: t })} testID={`vehicle-fuel-${t}`} />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field style={{ flex: 1 }} numeric label="Current odometer" unit={dist} testID="vehicle-odometer-input" value={f.initialOdometer} onChangeText={(t) => set({ initialOdometer: t })} placeholder="0" />
        <Field style={{ flex: 1 }} numeric label="Service every" unit={dist} testID="vehicle-interval-input" value={f.serviceIntervalKm} onChangeText={(t) => set({ serviceIntervalKm: t })} placeholder={String(defaultInterval)} />
      </View>
      <T muted style={{ fontSize: 12, marginTop: -4, marginBottom: 12 }}>After 3 logged services Tessera learns your real interval.</T>
      <DateField label="Insurance expiry" optional testID="vehicle-insurance-date" value={f.insuranceExpiry} onChange={(v) => set({ insuranceExpiry: v })} />
      <DateField label="PUC / emission expiry" optional testID="vehicle-puc-date" value={f.pucExpiry} onChange={(v) => set({ pucExpiry: v })} />
    </Sheet>
  );
}
