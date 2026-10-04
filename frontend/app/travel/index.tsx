import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { useOnline } from "@/src/core/useOnline";
import { geocode } from "@/src/core/online";
import { newDocs, readiness, tripStatus, upsertTrip } from "@/src/core/domains";
import type { Place, TransitKind, Trip, TripMode } from "@/src/core/types";
import { transitLabel } from "@/src/core/transit";
import { addDays, fmtDate, num, parseNum, todayISO, uid } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Amount, Button, Card, EmptyState, Eyebrow, IconButton, Press, T } from "@/src/components/ui";
import { Ring } from "@/src/components/charts";
import { Sheet } from "@/src/components/Sheet";
import { DateField, Field } from "@/src/components/inputs";
import { useToast } from "@/src/components/Toast";
import { ModuleGate } from "@/src/components/ModuleGate";

export function TripSheet({ visible, onClose, trip }: { visible: boolean; onClose: () => void; trip?: Trip }) {
  const { db, update } = useStore();
  const { online, log } = useOnline();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(trip?.name ?? "");
  const [dest, setDest] = useState(trip?.destination ?? "");
  const [place, setPlace] = useState<Place | undefined>(trip?.place);
  const [matches, setMatches] = useState<Place[]>([]);
  const [start, setStart] = useState(trip?.start ?? addDays(todayISO(), 14));
  const [end, setEnd] = useState(trip?.end ?? addDays(todayISO(), 17));
  const [trav, setTrav] = useState(String(trip?.travellers ?? 1));
  const [budget, setBudget] = useState(trip?.budget ? String(trip.budget) : "");
  const [err, setErr] = useState<string>();
  const [mode, setMode] = useState<TripMode>(trip?.mode === "public" ? "public" : "personal");
  const [transit, setTransit] = useState<TransitKind>(trip?.transit ?? "metro");
  const save = () => {
    if (!name.trim() || !dest.trim()) return setErr("Name and destination are required");
    if (end < start) return setErr("End date must be after start");
    const t: Trip = { id: trip?.id ?? uid(), createdAt: trip?.createdAt ?? new Date().toISOString(), packing: trip?.packing ?? [], itinerary: trip?.itinerary ?? [], docs: trip?.docs ?? newDocs(), name: name.trim(), destination: dest.trim(), place, start, end, travellers: Math.max(1, parseNum(trav) || 1), budget: parseNum(budget) || 0, mode, ...(mode === "public" ? { transit } : {}) };
    update((d) => upsertTrip(d, t));
    onClose();
    toast(trip ? "Trip updated" : `${t.name} created`, "bag-suitcase-outline");
    if (!trip) router.push(`/travel/${t.id}`);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={trip ? "Edit trip" : "New trip"} testID="trip-sheet" footer={<Button label="Save trip" icon="check" onPress={save} testID="trip-save-button" />}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <Press testID="trip-mode-personal" onPress={() => setMode("personal")} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
          <T v="label">Personal vehicle</T>
        </Press>
        <Press testID="trip-mode-public" onPress={() => setMode("public")} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
          <T v="label">Public transport</T>
        </Press>
      </View>
      {mode === "public" ? (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <Press testID="trip-transit-metro" onPress={() => setTransit("metro")} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
            <T v="label">{transitLabel("metro")}</T>
          </Press>
          <Press testID="trip-transit-train" onPress={() => setTransit("train")} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
            <T v="label">{transitLabel("train")}</T>
          </Press>
          <Press testID="trip-transit-cab" onPress={() => setTransit("cab")} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
            <T v="label">Cab or taxi</T>
          </Press>
          <Press testID="trip-transit-bus" onPress={() => setTransit("bus")} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
            <T v="label">{transitLabel("bus")}</T>
          </Press>
        </View>
      ) : null}
      <Field label="Trip name" testID="trip-name-input" value={name} onChangeText={(t) => (setName(t), setErr(undefined))} placeholder="Goa 2027" error={err} />
      <Field label="Destination" testID="trip-destination-input" value={dest} onChangeText={(t) => (setDest(t), setPlace(undefined))} placeholder="Goa, India" hint={place ? `Located: ${place.name}` : online ? "Tap 'Find place' to enable weather & holidays" : "Turn Online on to look up weather & holidays"} />
      {online ? <Button small kind="ghost" icon="map-search-outline" label="Find place" testID="trip-find-place" onPress={async () => setMatches(await geocode(online, log, dest))} style={{ marginBottom: 8 }} /> : null}
      {matches.map((m, i) => (
        <Press key={i} testID={`trip-place-${i}`} onPress={() => (setPlace(m), setMatches([]))} style={{ paddingVertical: 10 }}>
          <T v="label">{m.name}</T>
        </Press>
      ))}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><DateField label="Start" value={start} onChange={(v) => setStart(v ?? todayISO())} testID="trip-start" /></View>
        <View style={{ flex: 1 }}><DateField label="End" value={end} onChange={(v) => setEnd(v ?? todayISO())} testID="trip-end" /></View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field style={{ flex: 1 }} numeric label="Travellers" testID="trip-travellers-input" value={trav} onChangeText={setTrav} />
        <Field style={{ flex: 1 }} numeric label="Budget" unit={db.settings.currency} testID="trip-budget-input" value={budget} onChangeText={setBudget} placeholder="0" />
      </View>
    </Sheet>
  );
}

export default function Travel() {
  const { db } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [add, setAdd] = useState(false);
  const trips = [...db.trips].sort((a, b) => (tripStatus(a) === "past" ? 1 : 0) - (tripStatus(b) === "past" ? 1 : 0) || a.start.localeCompare(b.start));
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Travel" testID="travel-header" right={<IconButton icon="plus" testID="travel-add-button" label="New trip" onPress={() => setAdd(true)} />} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {trips.length === 0 ? (
          <EmptyState testID="travel-empty" icon="bag-suitcase-outline" title="No trips yet" body="Plan a trip with packing templates, a day-by-day itinerary, documents and a budget." action={<Button label="Plan a trip" icon="plus" onPress={() => setAdd(true)} testID="travel-empty-add-button" />} />
        ) : (
          trips.map((t) => {
            const r = readiness(db, t);
            const st = tripStatus(t);
            return (
              <Card key={t.id} testID={`trip-card-${t.id}`} onPress={() => router.push(`/travel/${t.id}`)} style={{ opacity: st === "past" ? 0.7 : 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Ring value={r.score} size={76} stroke={8}>
                    <T v="mono" style={{ fontSize: 13 }}>{num(r.score * 100, 0)}%</T>
                  </Ring>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Eyebrow numberOfLines={1}>{st === "upcoming" ? `in ${r.daysToStart} days` : st === "ongoing" ? "happening now" : "completed"}</Eyebrow>
                    <T v="h2" numberOfLines={1}>{t.name}</T>
                    <T muted numberOfLines={1} style={{ fontSize: 12 }}>{t.destination} · {fmtDate(t.start)} · {r.days}d</T>
                    <View style={{ flexDirection: "row", gap: 4, marginTop: 4, alignItems: "center" }}>
                      <Amount value={r.spent} style={{ fontSize: 12 }} />
                      {t.budget ? <T muted v="mono" style={{ fontSize: 12 }}>/ {num(t.budget, 0)}</T> : null}
                    </View>
                  </View>
                </View>
                {st !== "past" && r.missing.length ? <T style={{ fontSize: 12, marginTop: 10, color: colors.warning }} numberOfLines={2}>{r.missing.join(" · ")}</T> : null}
              </Card>
            );
          })
        )}
      </ScrollView>
      {add ? <TripSheet visible onClose={() => setAdd(false)} /> : null}
      <ModuleGate id="travel" name="Travel" icon="bag-suitcase-outline" />
    </View>
  );
}
