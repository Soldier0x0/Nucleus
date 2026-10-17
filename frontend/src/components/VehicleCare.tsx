import React, { useState } from "react";
import { View } from "react-native";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { vehicleOwnership } from "@/src/core/life";
import type { Vehicle, WearPart } from "@/src/core/types";
import { fmtDate, money, num, parseNum, uid } from "@/src/core/format";
import { currentOdometer } from "@/src/core/intelligence";
import { costPerKmLine, tankCapacityLine } from "@/src/core/vehicleMath";
import { Button, Card, Chip, Eyebrow, T } from "./ui";
import { Sheet } from "./Sheet";
import { DateField, Field } from "./inputs";
import { useToast } from "./Toast";

const KINDS: { id: WearPart["kind"]; label: string }[] = [
  { id: "tyre", label: "Tyres" },
  { id: "battery", label: "Battery" },
  { id: "chain", label: "Chain" },
  { id: "brake", label: "Brakes" },
  { id: "other", label: "Other" },
];

/** True cost, and the parts that wear out, for one vehicle. */
export function VehicleCare({ vehicle }: { vehicle: Vehicle }) {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const [add, setAdd] = useState(false);
  const own = vehicleOwnership(db, vehicle.id);
  const parts = db.parts.filter((p) => p.vehicleId === vehicle.id);
  const odo = currentOdometer(db, vehicle);
  const unit = db.settings.distanceUnit;
  const cur = db.settings.currency;
  const perKmLine = own ? costPerKmLine(own.perKm, unit) : null;
  const mine = db.fuel.filter((row) => row.vehicleId === vehicle.id);
  const tankLine = mine.length ? tankCapacityLine(mine, vehicle.usableTank ?? vehicle.tankLitres) : "";

  return (
    <>
      {own && own.total > 0 ? (
        <Card testID="vehicle-ownership">
          <Eyebrow>True cost</Eyebrow>
          <T v="monoLg" style={{ marginTop: 4 }}>{money(own.total, cur)}</T>
          <T muted style={{ fontSize: 12, marginTop: 4 }}>
            Fuel {money(own.fuel, cur)} · service {money(own.service, cur)}
            {own.other > 0 ? ` · other ${money(own.other, cur)}` : ""}
            {perKmLine ? ` · ${perKmLine}` : ""}
            {tankLine ? ` · ${tankLine}` : ""}
          </T>
        </Card>
      ) : null}
      <Card testID="vehicle-parts">
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Eyebrow style={{ flex: 1 }}>Parts that wear</Eyebrow>
          <Button small kind="secondary" icon="plus" label="Add" testID="vehicle-part-add" onPress={() => setAdd(true)} />
        </View>
        {parts.length === 0 ? <T muted style={{ marginTop: 8 }}>Tyres, battery, chain. A kilometre and an interval, and Attention will say when they are due.</T> : parts.map((p) => {
          const since = p.odometer != null ? odo - p.odometer : undefined;
          const left = since != null && p.everyKm ? p.everyKm - since : undefined;
          return (
            <View key={p.id} testID={`vehicle-part-${p.id}`} style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.divider }}>
              <T v="label">{p.name}</T>
              <T muted style={{ fontSize: 12 }}>
                {[p.installedOn ? fmtDate(p.installedOn) : "", p.odometer != null ? `at ${num(p.odometer, 0)} ${unit}` : "", left != null ? (left <= 0 ? "due now" : `${num(left, 0)} ${unit} left`) : ""].filter(Boolean).join(" · ")}
              </T>
            </View>
          );
        })}
      </Card>
      {add ? <PartSheet vehicle={vehicle} onClose={() => setAdd(false)} /> : null}
    </>
  );
}

function PartSheet({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { update } = useStore();
  const toast = useToast();
  const [kind, setKind] = useState<WearPart["kind"]>("tyre");
  const [name, setName] = useState("Tyres");
  const [odo, setOdo] = useState("");
  const [every, setEvery] = useState(kind === "tyre" ? "15000" : kind === "chain" ? "20000" : "");
  const [date, setDate] = useState<string | undefined>();
  const save = () => {
    if (!name.trim()) return toast("Name the part", "tire");
    const part: WearPart = { id: uid(), vehicleId: vehicle.id, kind, name: name.trim(), odometer: odo ? parseNum(odo) : undefined, everyKm: every ? parseNum(every) : undefined, installedOn: date };
    update((d) => ({ ...d, parts: [...d.parts, part] }));
    toast(`${part.name} recorded`, "tire");
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title="Add a part" testID="part-sheet" footer={<Button label="Save part" icon="check" testID="part-save" onPress={save} />}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {KINDS.map((k) => (
          <Chip key={k.id} label={k.label} selected={kind === k.id} testID={`part-kind-${k.id}`} onPress={() => { setKind(k.id); setName(k.label); }} />
        ))}
      </View>
      <Field label="Name" testID="part-name" value={name} onChangeText={setName} />
      <Field numeric label="Odometer when fitted" testID="part-odo" value={odo} onChangeText={setOdo} placeholder="Optional" />
      <Field numeric label="Replace every" unit="km" testID="part-every" value={every} onChangeText={setEvery} placeholder="Optional" />
      <DateField label="Fitted on" optional testID="part-date" value={date} onChange={setDate} />
    </Sheet>
  );
}
