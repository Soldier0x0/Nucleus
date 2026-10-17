import React, { useEffect, useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { Image } from "expo-image";
import { useStore } from "@/src/core/store";
import { useOnline } from "@/src/core/useOnline";
import { fuelStations } from "@/src/core/online";
import { combineStations, mapsRouteLink, stationLabel } from "@/src/core/stations";
import type { FuelFillKind, FuelLevel, ServiceKind, Station, Vehicle } from "@/src/core/types";
import { addFuel, addService, SERVICE_LABEL } from "@/src/core/actions";
import { pickPaperDocument, pickPaperPhoto } from "@/src/core/paperFiles";
import { money, num, parseNum, todayISO, uid } from "@/src/core/format";
import { currentOdometer } from "@/src/core/intelligence";
import { fuelMileagePoints, usableTankEstimate } from "@/src/core/vehicleMath";
import { PART_LABEL, preTicked, vehicleParts, type PartId } from "@/src/core/serviceCatalog";
import { Sheet } from "./Sheet";
import { DateField, Field, TimeField } from "./inputs";
import { Button, Chip, ChipRow, Eyebrow, Icon, IconButton, Press, T } from "./ui";
import { useToast } from "./Toast";
import { useTheme } from "@/src/theme";

export function FuelSheet({ visible, onClose, vehicle }: { visible: boolean; onClose: () => void; vehicle: Vehicle }) {
  const { db, update } = useStore();
  const toast = useToast();
  const { colors } = useTheme();
  const lastPrice = db.recents[`fuelPrice:${vehicle.id}`] ?? "";
  const odoNow = currentOdometer(db, vehicle);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [odo, setOdo] = useState("");
  const [litres, setLitres] = useState("");
  const [price, setPrice] = useState(lastPrice);
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("12:00");
  const [fillKind, setFillKind] = useState<FuelFillKind>("partial");
  const [level, setLevel] = useState<FuelLevel | undefined>(undefined);
  const [station, setStation] = useState<Station | undefined>(undefined);
  const [stationOpen, setStationOpen] = useState(false);
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

  // All three typed and they disagree — the sheet stops here until one is fixed.
  const mismatch = useMemo(() => {
    const L = parseNum(litres), P = parseNum(price), T = parseNum(total);
    if (isNaN(L) || isNaN(P) || isNaN(T) || !(L > 0)) return false;
    const tol = Math.max(1, T * 0.01);
    return Math.abs(L * P - T) > tol;
  }, [litres, price, total]);

  const O = parseNum(odo);
  const dist = !isNaN(O) ? O - odoNow : NaN;
  const L = derived?.field === "litres" ? derived.value : parseNum(litres);
  const mine = db.fuel.filter((row) => row.vehicleId === vehicle.id);
  const anchor = fillKind !== "partial";
  const preview = !isNaN(dist) && dist > 0 && L > 0 ? dist / L : NaN;
  // A plausibility guard: the cycle this fill closes pays well above what the
  // ladder of previous cycles ever reached, so a pump stop was likely missed.
  const points = fuelMileagePoints(mine);
  const historic = points.slice(0, -1).map((p) => p.value).sort((a, b) => a - b);
  const median = historic.length ? (historic.length % 2 === 1 ? historic[(historic.length - 1) / 2] : (historic[historic.length / 2 - 1] + historic[historic.length / 2]) / 2) : 0;
  const missed = anchor && isFinite(preview) && preview > 0 && median > 0 && preview > median * 2.2;

  // A debit you captured from a bank notice today can carry the total.
  const upiCandidate = useMemo(() => {
    if (total || derived) return null;
    const rows = db.txns
      .filter((row) => row.type === "expense" && !row.transfer && row.category !== "Fuel" && row.amount > 0)
      .filter((row) => db.recents[`fuel-amount-used:${row.id}`] !== "1");
    const next = rows[0];
    if (!next) return null;
    return { txn: next, amount: next.amount };
  }, [db.txns, db.recents, total, derived]);

  const save = () => {
    const e: Record<string, string> = {};
    const P = derived?.field === "price" ? derived.value : parseNum(price);
    const Tt = derived?.field === "total" ? derived.value : parseNum(total);
    if (!isNaN(O) && O < odoNow && mine.length) e.odo = `Not behind the last ${num(odoNow, 0)}`;
    if (!(L > 0)) e.litres = "Enter litres (or price + total)";
    if (isNaN(P) || isNaN(Tt)) e.total = "Enter any two of litres, price, total";
    if (mismatch && !e.total) e.total = "Doesn't match litres × price. Fix one of them.";
    setErrs(e);
    if (Object.keys(e).length) return;
    const parts = time.match(/^(\d{1,2}):(\d{2})$/);
    const loggedAt = parts ? `${date}T${parts[1].padStart(2, "0")}:${parts[2]}:00` : undefined;
    const entry = {
      id: uid(),
      vehicleId: vehicle.id,
      date,
      ...(loggedAt ? { loggedAt } : {}),
      fillKind,
      ...(fillKind === "partial" && level ? { levelChip: level } : {}),
      odometer: isNaN(O) ? odoNow : O,
      ...(isNaN(O) ? { odometerEstimated: true } : {}),
      litres: Number(L.toFixed(2)),
      price: Number(P.toFixed(2)),
      total: Number(Tt.toFixed(2)),
      ...(photo ? { photo } : {}),
      ...(station ? { station: station.name } : {}),
    };
    update((d) => {
      const next = addFuel(d, entry);
      // A level-chip fill teaches the usable tank size; keep the freshest fold.
      const est = usableTankEstimate(next.fuel.filter((row) => row.vehicleId === vehicle.id));
      const vehicles = est && est > 0 ? next.vehicles.map((v) => (v.id === vehicle.id && v.usableTank !== est ? { ...v, usableTank: est } : v)) : next.vehicles;
      return { ...next, vehicles, recents: { ...d.recents, [`fuelPrice:${vehicle.id}`]: String(entry.price) } };
    });
    onClose();
    const linked = s.autoLinkExpenses && s.modules.find((m) => m.id === "money")?.enabled;
    toast(linked ? `Fuel logged · ${money(entry.total, s.currency)} added to Money` : "Fuel logged", "gas-station-outline");
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Log fuel · ${vehicle.name}`} testID="fuel-sheet" footer={<Button label="Save fuel entry" icon="check" onPress={save} testID="fuel-save-button" />}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <Button small kind="secondary" icon="camera-outline" label="Fuel receipt photo" testID="fuel-photo-pick" onPress={async () => {
          const next = await pickPaperPhoto();
          if (!next || typeof next === "string") return;
          setPhoto(next.uri);
        }} />
        {photo ? <Button small kind="ghost" icon="close" label="Remove" testID="fuel-photo-clear" onPress={() => setPhoto(undefined)} /> : null}
      </View>
      {photo ? <Image source={{ uri: photo }} style={{ width: "100%", height: 140, borderRadius: 12, marginBottom: 12, backgroundColor: colors.surfaceTertiary }} contentFit="cover" testID="fuel-photo-preview" /> : null}
      <Field numeric label="Odometer" unit={s.distanceUnit} testID="fuel-odometer-input" value={odo} onChangeText={setOdo} placeholder="Optional" error={errs.odo} hint={!isNaN(dist) && dist > 0 ? `+${num(dist, 0)} ${s.distanceUnit} since last reading` : `Last reading ${num(odoNow, 0)}`} />
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Field style={{ flex: 1 }} numeric label={energy ? "Energy" : "Quantity"} unit={qtyUnit} testID="fuel-litres-input" value={derived?.field === "litres" ? "" : litres} placeholder={derived?.field === "litres" ? num(derived.value, 2) : "0.00"} onChangeText={setLitres} error={errs.litres} />
        {energy ? null : <Button small kind="ghost" icon="cup-water" label="+1 L can" testID="fuel-can-add" onPress={() => setLitres(String(Number(parseNum(litres) || 0) + 1))} />}
      </View>
      <Field numeric label="Price" unit={`/${qtyUnit}`} testID="fuel-price-input" value={derived?.field === "price" ? "" : price} placeholder={derived?.field === "price" ? num(derived.value, 2) : "0.00"} onChangeText={setPrice} />
      <Field numeric label="Total paid" unit={s.currency} testID="fuel-total-input" value={derived?.field === "total" ? "" : total} placeholder={derived?.field === "total" ? num(derived.value, 2) : "0.00"} onChangeText={setTotal} error={errs.total} hint={mismatch ? undefined : derived ? `Auto-calculated ${derived.field}: ${num(derived.value, 2)} (shown in grey)` : "Enter any two — the third is calculated"} />
      {upiCandidate && !mismatch ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }} testID="fuel-upi-row">
          <Button small kind="secondary" icon="bank" label={`Use ${money(upiCandidate.amount, s.currency)} from your bank notice`} testID="fuel-upi-use" onPress={() => { setTotal(String(upiCandidate.amount)); update((d) => ({ ...d, recents: { ...d.recents, [`fuel-amount-used:${upiCandidate.txn.id}`]: "1" } })); }} />
          <Button small kind="ghost" icon="close" label="Not fuel" testID="fuel-upi-dismiss" onPress={() => update((d) => ({ ...d, recents: { ...d.recents, [`fuel-amount-used:${upiCandidate.txn.id}`]: "1" } }))} />
        </View>
      ) : null}
      <Eyebrow style={{ marginBottom: 8 }}>Tank state</Eyebrow>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <Chip label="To my usual full" selected={fillKind === "full"} testID="fuel-state-full" onPress={() => { setFillKind("full"); setLevel(undefined); }} />
        <Chip label="Was empty before this" selected={fillKind === "empty"} testID="fuel-state-empty" onPress={() => { setFillKind("empty"); setLevel(undefined); }} />
        <Chip label="Partial" selected={fillKind === "partial"} testID="fuel-state-partial" onPress={() => setFillKind("partial")} />
      </View>
      {fillKind === "partial" ? (
        <Eyebrow style={{ marginBottom: 8, marginTop: 4 }}>Where the tank sat</Eyebrow>
      ) : null}
      {fillKind === "partial" ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Chip label="Reserve" selected={level === "reserve"} testID="fuel-level-reserve" onPress={() => setLevel(level === "reserve" ? undefined : "reserve")} />
          <Chip label="¼" selected={level === "quarter"} testID="fuel-level-quarter" onPress={() => setLevel(level === "quarter" ? undefined : "quarter")} />
          <Chip label="½" selected={level === "half"} testID="fuel-level-half" onPress={() => setLevel(level === "half" ? undefined : "half")} />
          <Chip label="¾" selected={level === "three-quarter"} testID="fuel-level-threequarter" onPress={() => setLevel(level === "three-quarter" ? undefined : "three-quarter")} />
        </View>
      ) : null}
      {station ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.divider, marginBottom: 8 }} testID="fuel-station-row">
          <Icon name="gas-station-outline" size={18} color={colors.brandPrimary} />
          <T v="label" style={{ flex: 1 }}>{stationLabel(station)}</T>
          <IconButton icon="close" label="Not this pump" testID="fuel-station-clear" onPress={() => setStation(undefined)} />
        </View>
      ) : (
        <Button small kind="secondary" icon="magnify" label="Find stations" testID="fuel-station-open" onPress={() => setStationOpen(true)} />
      )}
      <DateField label="Date" value={date} onChange={(v) => setDate(v ?? todayISO())} testID="fuel-date" />
      <TimeField label="Time" value={time} onChange={setTime} testID="fuel-time" />
      {anchor && isFinite(preview) ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 8, backgroundColor: colors.brandTertiary }} testID="fuel-mileage-preview">
          <Icon name="speedometer" size={20} color={colors.onBrandTertiary} />
          <T v="mono" color={colors.onBrandTertiary}>≈ {num(preview, 1)} {s.distanceUnit}/{s.volumeUnit} since the last landmark</T>
        </View>
      ) : (
        <T muted style={{ fontSize: 12 }}>Counts toward the next landmark. Distance waits for the next “to my usual full”.</T>
      )}
      {missed ? <T muted style={{ fontSize: 12, marginTop: 8 }}>Missed a fill? The ladder of cycles says something is off.</T> : null}
      <StationPicker
        visible={stationOpen}
        onClose={() => setStationOpen(false)}
        station={station}
        onPick={(row) => {
          setStation(row);
          setStationOpen(false);
        }}
      />
    </Sheet>
  );
}

/** Favorites first, then company pumps, then the nearest map dots. Cached, works offline. */
export function StationPicker({ visible, onClose, station, onPick }: { visible: boolean; onClose: () => void; station?: Station; onPick: (row: Station) => void }) {
  const { db, update } = useStore();
  const { online, log } = useOnline();
  const { colors } = useTheme();
  const home = db.settings.homeCity;
  const [list, setList] = useState<(Station & { distance: number })[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !home) return;
    let alive = true;
    setLoading(true);
    fuelStations(online, log, home.lat, home.lon)
      .then((r) => {
        if (!alive) return;
        setList(combineStations(db.stations, r?.list ?? [], home) as (Station & { distance: number })[]);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setList(combineStations(db.stations, [], home) as (Station & { distance: number })[]);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const tag = (row: Station, patch: Partial<Station>) =>
    update((d) => {
      const stations = [...d.stations];
      const at = stations.findIndex((x) => x.id === row.id);
      if (at >= 0) stations[at] = { ...stations[at], ...patch };
      else stations.push({ ...row, ...patch });
      return { ...d, stations: stations.slice(-200) };
    });

  const combined = useMemo(() => {
    if (list) return list;
    if (home) return combineStations(db.stations, [], home) as (Station & { distance: number })[];
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, db.stations.length]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Fuel stations" testID="fuel-station-sheet">
      {home ? null : <T muted style={{ marginBottom: 12 }}>Add a home city under Today's weather first. Only the rounded town coords leave the phone, exactly like the weather ask.</T>}
      <T muted style={{ fontSize: 12, marginBottom: 8 }}>Your favorites first, then company-owned pumps, then the map by distance. Cached, so the list works offline.</T>
      {home && !online && !list ? <T muted style={{ fontSize: 12, marginBottom: 8 }}>Online is off — showing your saved pumps and favorites.</T> : null}
      {station ? (
        <T muted style={{ fontSize: 12, marginBottom: 4 }} testID="fuel-station-current">This fill: {stationLabel(station)}</T>
      ) : null}
      {loading ? <T muted style={{ marginTop: 8 }}>Finding pumps…</T> : null}
      {combined.slice(0, 24).map((row) => (
        <View key={row.id} testID={`fuel-station-${row.id}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.divider }}>
          <Press onPress={() => onPick(row)} testID={`fuel-station-name-${row.id}`} accessibilityLabel={`Choose ${stationLabel(row)}`} style={{ flex: 1 }}>
            <T v="label">{stationLabel(row)}</T>
          </Press>
          <T muted style={{ fontSize: 12 }}>{row.distance < 1 ? "<1 km" : `${Math.round(row.distance)} km`}</T>
          <IconButton icon={row.favorite ? "star" : "star-outline"} label={row.favorite ? "Unfavorite pump" : "Favorite pump"} testID={`fuel-station-fav-${row.id}`} onPress={() => tag(row, { favorite: !row.favorite })} filled={row.favorite} />
          <IconButton icon="storefront-outline" label="Mark company pump" testID={`fuel-station-coco-${row.id}`} onPress={() => tag(row, { coco: !row.coco })} filled={row.coco} />
          <IconButton icon="map" label="Route preview to the pin" testID={`fuel-station-map-${row.id}`} onPress={() => Linking.openURL(mapsRouteLink(row)).catch(() => {})} />
        </View>
      ))}
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
  const [billFile, setBillFile] = useState<string | undefined>();
  const [billMime, setBillMime] = useState<string | undefined>();
  const partList = vehicleParts(vehicle).filter((p) => p.on);
  const [parts, setParts] = useState<PartId[]>(() => preTicked(db, vehicle, todayISO()));

  const save = () => {
    const O = parseNum(odo);
    if (isNaN(O)) return setErr("Enter the odometer reading");
    const C = cost ? parseNum(cost) : 0;
    const clean = Object.fromEntries(Object.entries(details).filter(([k, v]) => v && KIND_FIELDS[kind].some((f) => f.key === k)));
    update((d) =>
      addService(d, {
        id: uid(),
        vehicleId: vehicle.id,
        date,
        odometer: O,
        kind,
        ...(parts.length ? { parts } : {}),
        cost: isNaN(C) ? 0 : C,
        details: clean,
        ...(billFile ? { billFile, billMime } : {}),
      }),
    );
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
      <Eyebrow style={{ marginBottom: 4, marginTop: 8 }}>Parts done (due ones are ticked)</Eyebrow>
      <View style={{ marginHorizontal: -16 }}>
        <ChipRow testID="service-parts-row">
          {partList.map((p) => (
            <Chip key={p.id} label={PART_LABEL[p.id]} selected={parts.includes(p.id)} onPress={() => setParts((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]))} testID={`service-part-${p.id}`} />
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
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <Button
          small
          kind="secondary"
          icon="image-outline"
          label="Bill photo"
          testID="service-bill-photo"
          onPress={async () => {
            const next = await pickPaperPhoto();
            if (!next || typeof next === "string") return;
            setBillFile(next.uri);
            setBillMime(next.mime);
          }}
        />
        <Button
          small
          kind="secondary"
          icon="file-pdf-box"
          label="Bill PDF"
          testID="service-bill-pdf"
          onPress={async () => {
            const next = await pickPaperDocument();
            if (!next || typeof next === "string") return;
            setBillFile(next.uri);
            setBillMime(next.mime);
          }}
        />
      </View>
      {billFile ? (
        <>
          <T muted style={{ fontSize: 12, marginBottom: 8 }}>Bill attached ({billMime === "application/pdf" ? "PDF" : "image"})</T>
          <Button small kind="ghost" label="Remove bill" testID="service-bill-clear" onPress={() => { setBillFile(undefined); setBillMime(undefined); }} style={{ marginBottom: 8 }} />
        </>
      ) : null}
      {kind === "general" || kind === "oil" ? <T muted style={{ fontSize: 12 }}>Counts toward your learned service interval.</T> : null}
    </Sheet>
  );
}

export { KIND_ICON };
