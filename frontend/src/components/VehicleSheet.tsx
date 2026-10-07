import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "@/src/core/store";
import { upsertVehicle } from "@/src/core/actions";
import type { Vehicle } from "@/src/core/types";
import { parseNum, uid } from "@/src/core/format";
import { BODY_LABEL, bodiesFor, inferBody } from "@/src/core/life";
import type { FuelType, HybridFrom, VehicleBody } from "@/src/core/types";
import { Sheet } from "./Sheet";
import { DateField, Field } from "./inputs";
import { Button, Chip, Eyebrow, Segmented, T } from "./ui";
import { Image } from "expo-image";
import { VehicleArt } from "./VehicleArt";
import { pickSmallPhoto } from "./PhotoPick";
import { useTheme } from "@/src/theme";
import { useToast } from "./Toast";

export function VehicleSheet({ visible, onClose, vehicle }: { visible: boolean; onClose: () => void; vehicle?: Vehicle }) {
  const { update, db } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const [bodyLocked, setBodyLocked] = useState(!!vehicle?.body);
  const [f, setF] = useState(() => ({
    name: vehicle?.name ?? "",
    type: vehicle?.type ?? ("car" as Vehicle["type"]),
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    plate: vehicle?.plate ?? "",
    fuelType: vehicle?.fuelType ?? ("petrol" as Vehicle["fuelType"]),
    hybridFrom: (vehicle?.hybridFrom ?? "petrol") as HybridFrom,
    body: (vehicle?.body ?? inferBody({ type: vehicle?.type ?? "car", name: vehicle?.name, make: vehicle?.make, model: vehicle?.model })) as VehicleBody,
    initialOdometer: vehicle ? String(vehicle.initialOdometer) : "",
    serviceIntervalKm: vehicle ? String(vehicle.serviceIntervalKm) : "",
    insuranceExpiry: vehicle?.insuranceExpiry,
    pucExpiry: vehicle?.pucExpiry,
    tankLitres: vehicle?.tankLitres != null ? String(vehicle.tankLitres) : "",
    cover: vehicle?.cover,
  }));
  const [err, setErr] = useState<string>();
  const set = (p: Partial<typeof f>) => setF((x) => {
    const next = { ...x, ...p };
    if (!bodyLocked && ("name" in p || "make" in p || "model" in p || "type" in p)) next.body = inferBody(next);
    if ("type" in p && !bodiesFor(next.type).includes(next.body)) next.body = inferBody(next);
    return next;
  });
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
      hybridFrom: f.fuelType === "hybrid" ? f.hybridFrom : undefined,
      body: f.body,
      initialOdometer: odo,
      serviceIntervalKm: parseNum(f.serviceIntervalKm) || defaultInterval,
      insuranceExpiry: f.insuranceExpiry,
      pucExpiry: f.pucExpiry,
      ...(f.cover ? { cover: f.cover } : {}),
      ...(f.tankLitres ? { tankLitres: parseNum(f.tankLitres) } : {}),
    };
    update((d) => upsertVehicle(d, v));
    onClose();
    toast(vehicle ? "Vehicle updated" : `${v.name} added`, "car-side");
    if (!vehicle) router.push(`/vehicles/${v.id}`);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={vehicle ? "Edit vehicle" : "Add vehicle"} testID="vehicle-sheet" footer={<Button label="Save vehicle" icon="check" onPress={save} testID="vehicle-save-button" />}>
      <Segmented testID="vehicle-type" value={f.type} onChange={(v) => set({ type: v })} options={[{ value: "car", label: "Car" }, { value: "bike", label: "Bike" }, { value: "other", label: "Other" }]} />
      <View style={{ alignItems: "center", marginTop: 12, marginBottom: 4 }}>
        {f.cover ? (
          <Image source={{ uri: f.cover }} style={{ width: "100%", height: 140, borderRadius: 12, marginBottom: 8 }} contentFit="cover" />
        ) : (
          <VehicleArt body={f.body} color={colors.onSurface} accent={colors.brandPrimary} />
        )}
        <Button
          small
          kind="secondary"
          icon="image-outline"
          label={f.cover ? "Change cover photo" : "Add cover photo"}
          testID="vehicle-cover-photo"
          onPress={async () => {
            const next = await pickSmallPhoto();
            if (next === "too-big") return toast("That photo is too large.", "image-off-outline");
            if (next === "denied") return toast("Photo access is off.", "image-off-outline");
            if (next) set({ cover: next });
          }}
        />
        {f.cover ? <Button small kind="ghost" label="Remove cover" testID="vehicle-cover-clear" onPress={() => set({ cover: undefined })} /> : null}
        <T muted style={{ fontSize: 12, marginTop: 4 }}>{BODY_LABEL[f.body]} · gallery cover is optional</T>
      </View>
      <View style={{ height: 8 }} />
      <Field label="Name" testID="vehicle-name-input" value={f.name} onChangeText={(t) => (set({ name: t }), setErr(undefined))} placeholder="e.g. Activa, Family car" error={err} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field style={{ flex: 1 }} label="Make" testID="vehicle-make-input" value={f.make} onChangeText={(t) => set({ make: t })} placeholder="Honda" />
        <Field style={{ flex: 1 }} label="Model" testID="vehicle-model-input" value={f.model} onChangeText={(t) => set({ model: t })} placeholder="Activa 6G" />
      </View>
      <Field label="Registration (optional)" testID="vehicle-plate-input" value={f.plate} onChangeText={(t) => set({ plate: t })} autoCapitalize="characters" />
      <Eyebrow style={{ marginBottom: 8 }}>Looks like</Eyebrow>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {bodiesFor(f.type).map((b) => (
          <Chip key={b} label={BODY_LABEL[b]} selected={f.body === b} onPress={() => { setBodyLocked(true); set({ body: b }); }} testID={`vehicle-body-${b}`} />
        ))}
      </View>
      <Eyebrow style={{ marginBottom: 8 }}>Fuel</Eyebrow>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {([["petrol", "Petrol"], ["diesel", "Diesel"], ["cng", "CNG"], ["electric", "Electric"], ["hybrid", "Hybrid"], ["other", "Other"]] as [FuelType, string][]).map(([t, label]) => (
          <Chip key={t} label={label} selected={f.fuelType === t} onPress={() => set({ fuelType: t })} testID={`vehicle-fuel-${t}`} />
        ))}
      </View>
      {f.fuelType === "hybrid" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <Chip label="Petrol + electric" selected={f.hybridFrom === "petrol"} onPress={() => set({ hybridFrom: "petrol" })} testID="vehicle-hybrid-petrol" />
          <Chip label="Diesel + electric" selected={f.hybridFrom === "diesel"} onPress={() => set({ hybridFrom: "diesel" })} testID="vehicle-hybrid-diesel" />
        </View>
      ) : <View style={{ height: 4 }} />}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field style={{ flex: 1 }} numeric label="Current odometer" unit={dist} testID="vehicle-odometer-input" value={f.initialOdometer} onChangeText={(t) => set({ initialOdometer: t })} placeholder="0" />
        <Field style={{ flex: 1 }} numeric label="Service every" unit={dist} testID="vehicle-interval-input" value={f.serviceIntervalKm} onChangeText={(t) => set({ serviceIntervalKm: t })} placeholder={String(defaultInterval)} />
      </View>
      <T muted style={{ fontSize: 12, marginTop: -4, marginBottom: 12 }}>After 3 logged services Nucleus learns your real interval.</T>
      <Field label="Tank size (optional)" numeric unit="L" testID="vehicle-tank-input" value={f.tankLitres} onChangeText={(t) => set({ tankLitres: t })} placeholder="For range estimate after a full fill" />
      <DateField label="Insurance expiry" optional testID="vehicle-insurance-date" value={f.insuranceExpiry} onChange={(v) => set({ insuranceExpiry: v })} />
      <DateField label="PUC / emission expiry" optional testID="vehicle-puc-date" value={f.pucExpiry} onChange={(v) => set({ pucExpiry: v })} />
    </Sheet>
  );
}
