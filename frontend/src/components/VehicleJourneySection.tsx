import React, { useState } from "react";
import { View } from "react-native";
import { addOdometerLog, addVehicleJourney, closeVehicleJourney } from "@/src/core/actions";
import type { Vehicle } from "@/src/core/types";
import { currentOdometer } from "@/src/core/intelligence";
import { fmtDate, num, parseNum, todayISO, uid } from "@/src/core/format";
import { useStore } from "@/src/core/store";
import { Card, Button, Eyebrow, T } from "./ui";
import { DateField, Field, TimeField } from "./inputs";
import { Sheet } from "./Sheet";

export function VehicleJourneySection({ vehicle }: { vehicle: Vehicle }) {
  const { db, update } = useStore();
  const [odoSheet, setOdoSheet] = useState(false);
  const [journeySheet, setJourneySheet] = useState(false);
  const odoNow = currentOdometer(db, vehicle);
  const logs = db.odometerLogs.filter((row) => row.vehicleId === vehicle.id).sort((a, b) => b.at.localeCompare(a.at));
  const journeys = db.vehicleJourneys.filter((row) => row.vehicleId === vehicle.id).sort((a, b) => b.startAt.localeCompare(a.startAt));
  const openJourney = journeys.find((row) => !row.endAt);
  const [odo, setOdo] = useState(String(odoNow));
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("12:00");
  const [startOdo, setStartOdo] = useState(String(odoNow));
  const [endOdo, setEndOdo] = useState(String(odoNow));
  return (
    <Card testID="vehicle-journey-card">
      <Eyebrow>Journeys & odometer</Eyebrow>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 8 }}>
        <Button small kind="secondary" label="Timed odo" testID="vehicle-odo-log" onPress={() => setOdoSheet(true)} />
        {openJourney ? (
          <Button
            small
            label="End journey"
            testID="vehicle-journey-end"
            onPress={() => {
              setEndOdo(String(odoNow));
              setJourneySheet(true);
            }}
          />
        ) : (
          <Button small kind="secondary" label="Start journey" testID="vehicle-journey-start" onPress={() => update((d) => addVehicleJourney(d, { id: uid(), vehicleId: vehicle.id, startAt: new Date().toISOString(), startOdometer: odoNow }))} />
        )}
      </View>
      {logs[0] ? <T muted style={{ fontSize: 12 }}>Last odo log: {fmtDate(logs[0].at.slice(0, 10))} {logs[0].at.slice(11, 16)} · {num(logs[0].odometer, 0)}</T> : null}
      {journeys[0] ? (
        <T muted style={{ fontSize: 12, marginTop: 4 }}>
          {journeys[0].endOdometer != null
            ? `Last ride: ${num(journeys[0].endOdometer - journeys[0].startOdometer, 0)} ${db.settings.distanceUnit}`
            : "Ride in progress"}
        </T>
      ) : null}
      <Sheet visible={odoSheet} onClose={() => setOdoSheet(false)} title="Odometer reading" footer={<Button label="Save" icon="check" testID="vehicle-odo-save" onPress={() => {
        const O = parseNum(odo);
        const parts = time.match(/^(\d{1,2}):(\d{2})$/);
        if (!parts || isNaN(O)) return;
        const at = `${date}T${parts[1].padStart(2, "0")}:${parts[2]}:00`;
        update((d) => addOdometerLog(d, { id: uid(), vehicleId: vehicle.id, at, odometer: O }));
        setOdoSheet(false);
      }} />}>
        <Field numeric label="Odometer" unit={db.settings.distanceUnit} value={odo} onChangeText={setOdo} testID="vehicle-odo-value" />
        <DateField label="Date" value={date} onChange={(v) => setDate(v ?? todayISO())} testID="vehicle-odo-date" />
        <TimeField label="Time" value={time} onChange={setTime} testID="vehicle-odo-time" />
      </Sheet>
      <Sheet visible={journeySheet} onClose={() => setJourneySheet(false)} title="End journey" footer={<Button label="Save end" icon="flag-checkered" testID="vehicle-journey-save" onPress={() => {
        if (!openJourney) return;
        const O = parseNum(endOdo);
        if (isNaN(O)) return;
        update((d) => closeVehicleJourney(d, openJourney.id, new Date().toISOString(), O));
        setJourneySheet(false);
      }} />}>
        <Field numeric label="End odometer" unit={db.settings.distanceUnit} value={endOdo} onChangeText={setEndOdo} testID="vehicle-journey-end-odo" />
      </Sheet>
    </Card>
  );
}
