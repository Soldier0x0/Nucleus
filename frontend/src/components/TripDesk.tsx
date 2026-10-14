import { useEffect, useState } from "react";
import { Share, TextInput, View } from "react-native";
import { useStore } from "@/src/core/store";
import { useOnline } from "@/src/core/useOnline";
import { useTheme } from "@/src/theme";
import { todayISO, uid } from "@/src/core/format";
import { vehicleStats } from "@/src/core/intelligence";
import { rangeLeft, reuseMarkedStops, serviceLeft, timeline, weatherAlong, weatherReminder, type MarkedStop } from "@/src/core/tripMath";
import { shareStop } from "@/src/core/shareLine";
import { suggestShared } from "@/src/core/recordLinks";
import type { Trip } from "@/src/core/types";
import { upsertTrip } from "@/src/core/domains";
import { WeatherCard } from "./WeatherCard";
import { Button, Card, Eyebrow, T } from "./ui";

function marked(trip: Trip): MarkedStop[] {
  return trip.itinerary.filter((stop) => stop.stop === "fuel" || stop.stop === "snack").map((stop) => ({
    id: stop.id,
    kind: stop.stop === "snack" ? "snack" : "fuel",
    name: stop.title,
    at: `${stop.date}T${stop.time || "00:00"}`,
  }));
}

/** Timeline, range, service, weather, and stops. On the trip itself, not on a map. */
export function TripDesk({ trip }: { trip: Trip }) {
  const { db, update } = useStore();
  const { online } = useOnline();
  const { colors } = useTheme();
  const [person, setPerson] = useState("");
  const vehicle = db.vehicles.find((item) => item.id === db.settings.defaultVehicleId) ?? db.vehicles[0];
  const stats = vehicle ? vehicleStats(db, vehicle) : null;
  const lastFill = stats?.fuel.at(-1);
  const mileage = stats && Number.isFinite(stats.lastMileage) ? stats.lastMileage : stats && Number.isFinite(stats.avgMileage) ? stats.avgMileage : 0;
  const driven = stats && lastFill ? Math.max(0, stats.odometer - lastFill.odometer) : 0;
  const range = mileage > 0 && lastFill ? rangeLeft(mileage, lastFill.litres, driven) : null;
  const service = stats && vehicle ? serviceLeft(stats.odometer, stats.service.lastOdo, stats.service.interval) : null;
  const cities = [trip.destination, ...trip.itinerary.map((stop) => stop.place || "")].filter(Boolean);
  const weather = weatherAlong(online, cities);
  const stops = timeline(marked(trip));
  const past = db.trips.filter((item) => item.id !== trip.id).flatMap(marked);
  const reuse = reuseMarkedStops(past, stops);
  const remind = weatherReminder(!!trip.weatherSaved, !!trip.weatherReminded);
  const [showRemind] = useState(remind);
  useEffect(() => {
    if (!remind) return;
    update((d) => upsertTrip(d, { ...trip, weatherReminded: true }));
  }, [remind, trip, update]);
  const links = suggestShared({
    debits: db.txns.filter((row) => row.category === "Fuel" && !row.transfer).map((row) => ({ id: row.id, date: row.date, amount: row.amount })),
    receipts: [],
    trips: [{ id: trip.id, start: trip.start, end: trip.end }],
    fuel: db.fuel.map((fill) => ({ id: fill.id, date: fill.date, total: fill.total })),
    periods: [],
    missedWork: [],
  });

  const addStop = (kind: "fuel" | "snack", name: string) => {
    update((d) => upsertTrip(d, {
      ...trip,
      itinerary: [...trip.itinerary, { id: uid(), date: todayISO(), time: "12:00", title: name, stop: kind }],
    }));
  };

  return (
    <Card testID="trip-desk">
      <Eyebrow>This trip</Eyebrow>
      <T muted style={{ marginTop: 6 }}>A timeline on this phone. Weather is fetched when you are online. There is no offline map.</T>
      {stops.length === 0 ? <T style={{ marginTop: 8 }}>No fuel or snack stops yet.</T> : stops.map((stop) => (
        <View key={stop.id} style={{ marginTop: 8 }}>
          <T v="label">{stop.kind === "fuel" ? "Fuel" : "Snack"} · {stop.name}</T>
          <T muted>{stop.at}</T>
          <Button small kind="secondary" disabled={!person.trim()} label={`Hand this stop to ${person || "someone"}`} testID={`trip-share-${stop.id}`} onPress={() => person && Share.share({ message: shareStop(person, { name: stop.name }) })} style={{ marginTop: 6 }} />
        </View>
      ))}
      <TextInput testID="trip-share-person" value={person} onChangeText={setPerson} placeholder="One person" placeholderTextColor={colors.muted} style={{ marginTop: 10, height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <Button small label="Mark fuel" testID="trip-mark-fuel" onPress={() => addStop("fuel", "Fuel stop")} />
        <Button small kind="secondary" label="Mark snack" testID="trip-mark-snack" onPress={() => addStop("snack", "Snack stop")} />
      </View>
      {range ? <T style={{ marginTop: 10 }} testID="trip-range">{range.warn ? `About ${range.remainingKm} km left. Fill up before the range runs out.` : `About ${range.remainingKm} km left from the last fill.`}</T> : <T muted style={{ marginTop: 10 }}>Log a fill and some mileage to see the range.</T>}
      {service != null ? <T style={{ marginTop: 6 }} testID="trip-service">{service <= 0 ? "Service is due from this vehicle's own kilometers." : `Service in about ${service} km, from this vehicle's own interval.`}</T> : null}
      {showRemind ? (
        <View style={{ marginTop: 10 }}>
          <T>Save the weather before you leave. None is saved yet.</T>
          <Button small label="Save weather" testID="trip-save-weather" onPress={() => update((d) => upsertTrip(d, { ...trip, weatherSaved: true, weatherReminded: true }))} style={{ marginTop: 6 }} />
        </View>
      ) : trip.weatherSaved ? <T style={{ marginTop: 10 }}>Weather is saved on this phone.</T> : null}
      {weather.available ? <T style={{ marginTop: 6 }}>Along the way: {weather.cities.join(", ")}</T> : <T muted style={{ marginTop: 6 }}>Weather stays empty until this phone is online.</T>}
      {online && trip.place ? <View style={{ marginTop: 10 }}><WeatherCard place={trip.place} from={trip.start} to={trip.end} testID="trip-route-weather" /></View> : null}
      {reuse.length ? (
        <View style={{ marginTop: 10 }}>
          <Eyebrow>Stops from an earlier trip</Eyebrow>
          {reuse.map((stop) => (
            <Button key={stop.id} small kind="ghost" label={`Use ${stop.name}`} testID={`trip-reuse-${stop.id}`} onPress={() => addStop(stop.kind === "snack" ? "snack" : "fuel", stop.name)} style={{ marginTop: 6 }} />
          ))}
        </View>
      ) : null}
      {links.length ? <T style={{ marginTop: 10 }}>Linked to a fuel record on this trip&apos;s dates.</T> : null}
    </Card>
  );
}
