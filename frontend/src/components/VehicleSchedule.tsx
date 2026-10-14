import React, { useState } from "react";
import { Switch, View } from "react-native";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { upsertVehicle } from "@/src/core/actions";
import { fmtDate, num, parseNum, todayISO } from "@/src/core/format";
import { PART_LABEL, serviceSchedule, vehicleParts, type PartSetting } from "@/src/core/serviceCatalog";
import type { Vehicle } from "@/src/core/types";
import { Button, Card, Eyebrow, Icon, T } from "./ui";
import { Field } from "./inputs";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

/** Per-part schedule on the vehicle screen, plus the manual "copy from booklet" interval form. */
export function VehicleSchedule({ vehicle }: { vehicle: Vehicle }) {
  const { db } = useStore();
  const { colors } = useTheme();
  const [edit, setEdit] = useState(false);
  const rows = serviceSchedule(db, vehicle, todayISO());
  const tone = { due: colors.error, soon: colors.warning, ok: colors.success };
  return (
    <Card testID="vehicle-schedule-card">
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Eyebrow style={{ flex: 1 }}>Service schedule</Eyebrow>
        <Button small kind="ghost" icon="tune-variant" label="Intervals" testID="vehicle-schedule-edit" onPress={() => setEdit(true)} />
      </View>
      {rows.map((d) => (
        <View key={d.part.id} testID={`schedule-${d.part.id}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
          <Icon name={d.state === "ok" ? "check-circle-outline" : "alert-circle-outline"} size={18} color={tone[d.state]} />
          <T style={{ flex: 1 }}>{PART_LABEL[d.part.id]}</T>
          <T muted style={{ fontSize: 12 }}>
            {d.kmLeft <= 0 ? `${num(-d.kmLeft, 0)} km past` : `${num(d.kmLeft, 0)} km`} · {d.daysLeft <= 0 ? "date passed" : `by ${fmtDate(d.dueDate)}`}
          </T>
        </View>
      ))}
      {edit ? <IntervalSheet vehicle={vehicle} onClose={() => setEdit(false)} /> : null}
    </Card>
  );
}

function IntervalSheet({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { update } = useStore();
  const toast = useToast();
  const [parts, setParts] = useState<PartSetting[]>(vehicleParts(vehicle));
  const [liquid, setLiquid] = useState((vehicle.cooling ?? (vehicle.type === "car" ? "liquid" : "air")) === "liquid");
  const set = (id: PartSetting["id"], patch: Partial<PartSetting>) => setParts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const save = () => {
    const cooling = liquid ? "liquid" : "air";
    const oil = parts.find((p) => p.id === "engine_oil");
    update((d) => upsertVehicle(d, { ...vehicle, cooling, parts, serviceIntervalKm: oil?.everyKm || vehicle.serviceIntervalKm }));
    toast("Intervals saved", "wrench-outline");
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title="Service intervals" testID="interval-sheet" footer={<Button label="Save intervals" icon="check" testID="interval-save" onPress={save} />}>
      <T muted style={{ marginBottom: 12 }}>Copy the numbers from your service booklet. Whichever comes first, km or months, makes a part due.</T>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <T style={{ flex: 1 }}>Liquid-cooled engine (shows coolant)</T>
        <Switch value={liquid} onValueChange={setLiquid} testID="interval-liquid" />
      </View>
      {parts.map((p) => (
        <View key={p.id} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <T v="label" style={{ flex: 1 }}>{PART_LABEL[p.id]}</T>
            <Switch value={p.on} onValueChange={(on) => set(p.id, { on })} testID={`interval-on-${p.id}`} />
          </View>
          {p.on ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Field style={{ flex: 1 }} numeric label="Every" unit="km" value={String(p.everyKm)} onChangeText={(t) => set(p.id, { everyKm: Math.max(1, parseNum(t) || 0) })} testID={`interval-km-${p.id}`} />
              <Field style={{ flex: 1 }} numeric label="Or every" unit="months" value={String(p.everyMonths)} onChangeText={(t) => set(p.id, { everyMonths: Math.max(1, parseNum(t) || 0) })} testID={`interval-months-${p.id}`} />
            </View>
          ) : null}
        </View>
      ))}
    </Sheet>
  );
}
