import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useStore } from "@/src/core/store";
import { addFuel, addService, SERVICE_LABEL } from "@/src/core/actions";
import type { ServiceKind, Vehicle } from "@/src/core/types";
import { money, num, parseNum, todayISO, uid } from "@/src/core/format";
import { currentOdometer } from "@/src/core/intelligence";
import { Sheet } from "./Sheet";
import { DateField, Field } from "./inputs";
import { Button, Chip, ChipRow, Eyebrow, Icon, T } from "./ui";
import { useToast } from "./Toast";
import { useTheme } from "@/src/theme";

export function FuelSheet({ visible, onClose, vehicle }: { visible: boolean; onClose: () => void; vehicle: Vehicle }) {
  const { db, update } = useStore();
  const toast = useToast();
  const { colors } = useTheme();
  const lastPrice = db.recents[`fuelPrice:${vehicle.id}`] ?? "";
  const odoNow = currentOdometer(db, vehicle);
  const [odo, setOdo] = useState("");
  const [litres, setLitres] = useState("");
  const [price, setPrice] = useState(lastPrice);
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [errs, setErrs] = useState<Record<string, string>>({});
  const s = db.settings;
  const energy = vehicle.fuelType === "electric";
  const qtyUnit = energy ? "kWh" : s.volumeUnit;

  // Fill in the missing value from the other two.
  const derived = useMemo(() => {
    const L = parseNum(litres), P = parseNum(price), T = parseNum(total);
    if (!isNaN(L) && !isNaN(P) && isNaN(T)) return { field: "total", value: L * P };
    if (!isNaN(L) && !isNaN(T) && isNaN(P) && L > 0) return { field: "price", value: T / L };
    if (!isNaN(P) && !isNaN(T) && isNaN(L) && P > 0) return { field: "litres", value: T / P };
    return null;
  }, [litres, price, total]);

  const O = parseNum(odo);
  const dist = !isNaN(O) ? O - odoNow : NaN;
  const L = derived?.field === "litres" ? derived.value : parseNum(litres);
  const preview = !isNaN(dist) && dist > 0 && L > 0 ? dist / L : NaN;

  const save = () => {
    const e: Record<string, string> = {};
    const P = derived?.field === "price" ? derived.value : parseNum(price);
    const Tt = derived?.field === "total" ? derived.value : parseNum(total);
    if (isNaN(O)) e.odo = "Enter the odometer reading";
    else if (O < odoNow && db.fuel.some((f) => f.vehicleId === vehicle.id)) e.odo = `Must be at least ${num(odoNow, 0)}`;
    if (!(L > 0)) e.litres = "Enter litres (or price + total)";
    if (isNaN(P) || isNaN(Tt)) e.total = "Enter any two of litres, price, total";
    setErrs(e);
    if (Object.keys(e).length) return;
    const entry = { id: uid(), vehicleId: vehicle.id, date, odometer: O, litres: Number(L.toFixed(2)), price: Number(P.toFixed(2)), total: Number(Tt.toFixed(2)) };
    update((d) => ({ ...addFuel(d, entry), recents: { ...d.recents, [`fuelPrice:${vehicle.id}`]: String(entry.price) } }));
    onClose();
    const linked = s.autoLinkExpenses && s.modules.find((m) => m.id === "money")?.enabled;
    toast(linked ? `Fuel logged · ${money(entry.total, s.currency)} added to Money` : "Fuel logged", "gas-station-outline");
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Log fuel · ${vehicle.name}`} testID="fuel-sheet" footer={<Button label="Save fuel entry" icon="check" onPress={save} testID="fuel-save-button" />}>
      <Field numeric label="Odometer" unit={s.distanceUnit} testID="fuel-odometer-input" value={odo} onChangeText={setOdo} placeholder={String(odoNow)} error={errs.odo} hint={!isNaN(dist) && dist > 0 ? `+${num(dist, 0)} ${s.distanceUnit} since last reading` : `Last reading ${num(odoNow, 0)}`} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field style={{ flex: 1 }} numeric label={energy ? "Energy" : "Quantity"} unit={qtyUnit} testID="fuel-litres-input" value={derived?.field === "litres" ? "" : litres} placeholder={derived?.field === "litres" ? num(derived.value, 2) : "0.00"} onChangeText={setLitres} error={errs.litres} />
        <Field style={{ flex: 1 }} numeric label="Price" unit={`/${qtyUnit}`} testID="fuel-price-input" value={derived?.field === "price" ? "" : price} placeholder={derived?.field === "price" ? num(derived.value, 2) : "0.00"} onChangeText={setPrice} />
      </View>
      <Field numeric label="Total paid" unit={s.currency} testID="fuel-total-input" value={derived?.field === "total" ? "" : total} placeholder={derived?.field === "total" ? num(derived.value, 2) : "0.00"} onChangeText={setTotal} error={errs.total} hint={derived ? `Auto-calculated ${derived.field}: ${num(derived.value, 2)} (shown in grey)` : "Enter any two — the third is calculated"} />
      <DateField label="Date" value={date} onChange={(v) => setDate(v ?? todayISO())} testID="fuel-date" />
      {isFinite(preview) ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 8, backgroundColor: colors.brandTertiary }} testID="fuel-mileage-preview">
          <Icon name="speedometer" size={20} color={colors.onBrandTertiary} />
          <T v="mono" color={colors.onBrandTertiary}>≈ {num(preview, 1)} {s.distanceUnit}/{s.volumeUnit} this fill</T>
        </View>
      ) : null}
    </Sheet>
  );
}

const KIND_ICON: Record<ServiceKind, string> = { general: "wrench-outline", oil: "oil", tyre: "tire", battery: "car-battery", brakes: "car-brake-alert", repair: "hammer-wrench", other: "dots-horizontal-circle-outline" };

/** Adaptive form: fields change with the service type. */
const KIND_FIELDS: Record<ServiceKind, { key: string; label: string; placeholder?: string; numeric?: boolean }[]> = {
  general: [{ key: "workshop", label: "Workshop", placeholder: "Authorized service centre" }],
  oil: [
    { key: "grade", label: "Oil grade", placeholder: "10W-30" },
    { key: "quantity", label: "Quantity", placeholder: "0.8 L" },
  ],
  tyre: [
    { key: "size", label: "Tyre size", placeholder: "90/100-10" },
    { key: "position", label: "Position", placeholder: "Front / Rear / Both" },
    { key: "brand", label: "Brand", placeholder: "MRF" },
    { key: "warranty", label: "Warranty", placeholder: "3 years" },
  ],
  battery: [
    { key: "brand", label: "Brand", placeholder: "Exide" },
    { key: "capacity", label: "Capacity", placeholder: "5 Ah" },
    { key: "warranty", label: "Warranty", placeholder: "24 months" },
  ],
  brakes: [{ key: "part", label: "Part", placeholder: "Pads / Shoes / Fluid" }],
  repair: [{ key: "issue", label: "Issue fixed", placeholder: "Clutch cable" }],
  other: [{ key: "what", label: "What was done", placeholder: "Washing, accessories…" }],
};

export function ServiceSheet({ visible, onClose, vehicle }: { visible: boolean; onClose: () => void; vehicle: Vehicle }) {
  const { db, update } = useStore();
  const toast = useToast();
  const s = db.settings;
  const odoNow = currentOdometer(db, vehicle);
  const [kind, setKind] = useState<ServiceKind>("general");
  const [odo, setOdo] = useState(String(odoNow));
  const [cost, setCost] = useState("");
  const [date, setDate] = useState(todayISO());
  const [details, setDetails] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string>();

  const save = () => {
    const O = parseNum(odo);
    if (isNaN(O)) return setErr("Enter the odometer reading");
    const C = cost ? parseNum(cost) : 0;
    const clean = Object.fromEntries(Object.entries(details).filter(([k, v]) => v && KIND_FIELDS[kind].some((f) => f.key === k)));
    update((d) => addService(d, { id: uid(), vehicleId: vehicle.id, date, odometer: O, kind, cost: isNaN(C) ? 0 : C, details: clean }));
    onClose();
    toast(`${SERVICE_LABEL[kind]} logged${C > 0 && s.autoLinkExpenses ? " · expense linked" : ""}`, KIND_ICON[kind]);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Log service · ${vehicle.name}`} testID="service-sheet" footer={<Button label="Save service" icon="check" onPress={save} testID="service-save-button" />}>
      <Eyebrow style={{ marginBottom: 4 }}>Type</Eyebrow>
      <View style={{ marginHorizontal: -16 }}>
        <ChipRow testID="service-kind-row">
          {(Object.keys(KIND_FIELDS) as ServiceKind[]).map((k) => (
            <Chip key={k} label={SERVICE_LABEL[k]} icon={KIND_ICON[k]} selected={kind === k} onPress={() => setKind(k)} testID={`service-kind-${k}`} />
          ))}
        </ChipRow>
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Field style={{ flex: 1 }} numeric label="Odometer" unit={s.distanceUnit} testID="service-odometer-input" value={odo} onChangeText={(t) => (setOdo(t), setErr(undefined))} error={err} />
        <Field style={{ flex: 1 }} numeric label="Cost" unit={s.currency} testID="service-cost-input" value={cost} onChangeText={setCost} placeholder="0" />
      </View>
      {KIND_FIELDS[kind].map((f) => (
        <Field key={kind + f.key} label={f.label} testID={`service-detail-${f.key}`} value={details[f.key] ?? ""} placeholder={f.placeholder} onChangeText={(t) => setDetails((d) => ({ ...d, [f.key]: t }))} />
      ))}
      <DateField label="Date" value={date} onChange={(v) => setDate(v ?? todayISO())} testID="service-date" />
      {kind === "general" || kind === "oil" ? <T muted style={{ fontSize: 12 }}>Counts toward your learned service interval.</T> : null}
    </Sheet>
  );
}

export { KIND_ICON };
