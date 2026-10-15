import React, { useState } from "react";
import { TextInput, View } from "react-native";
import { addOdometerLog, addVehicleJourney, closeVehicleJourney, setJourneyChecklist, upsertVehicle } from "@/src/core/actions";
import type { ChecklistItem, Vehicle } from "@/src/core/types";
import { currentOdometer } from "@/src/core/intelligence";
import { RIDE_CHECKLIST_DEFAULTS, newRideChecklist, rideChecklistProgress, rideChecklistTemplate, toggleRideChecklistItem } from "@/src/core/rideChecklists";
import { fmtDate, num, parseNum, todayISO, uid } from "@/src/core/format";
import { useStore } from "@/src/core/store";
import { useTheme } from "@/src/theme";
import { Card, Button, Eyebrow, Icon, IconButton, Press, T } from "./ui";
import { DateField, Field, TimeField } from "./inputs";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

export function VehicleJourneySection({ vehicle }: { vehicle: Vehicle }) {
  const { db, update } = useStore();
  const toast = useToast();
  const { colors } = useTheme();
  const [odoSheet, setOdoSheet] = useState(false);
  const [journeySheet, setJourneySheet] = useState(false);
  const [templateSheet, setTemplateSheet] = useState(false);
  const odoNow = currentOdometer(db, vehicle);
  const logs = db.odometerLogs.filter((row) => row.vehicleId === vehicle.id).sort((a, b) => b.at.localeCompare(a.at));
  const journeys = db.vehicleJourneys.filter((row) => row.vehicleId === vehicle.id).sort((a, b) => b.startAt.localeCompare(a.startAt));
  const openJourney = journeys.find((row) => !row.endAt);
  const ride = openJourney ?? journeys[0];
  const [endOdo, setEndOdo] = useState(String(odoNow));
  const progress = ride?.checklist?.length ? rideChecklistProgress(ride.checklist) : null;
  const tick = (item: ChecklistItem) => {
    if (!ride) return;
    update((d) => setJourneyChecklist(d, ride.id, toggleRideChecklistItem(ride.checklist ?? [], item.id)));
  };
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
          <Button
            small
            kind="secondary"
            label="Start journey"
            testID="vehicle-journey-start"
            onPress={() =>
              update((d) =>
                addVehicleJourney(d, { id: uid(), vehicleId: vehicle.id, startAt: new Date().toISOString(), startOdometer: odoNow, checklist: newRideChecklist(rideChecklistTemplate(vehicle)) }),
              )
            }
          />
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
      {ride ? (
        <View style={{ marginTop: 12 }} testID="ride-checklist">
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Eyebrow style={{ flex: 1 }}>Ride checklist</Eyebrow>
            {progress ? <T muted style={{ fontSize: 12 }} testID="ride-checklist-progress">{progress.done}/{progress.total} done</T> : null}
          </View>
          {!ride.checklist?.length ? (
            <Button
              small
              kind="secondary"
              label="Add checklist to this ride"
              testID="ride-checklist-add"
              style={{ marginTop: 8 }}
              onPress={() => update((d) => setJourneyChecklist(d, ride.id, newRideChecklist(rideChecklistTemplate(vehicle))))}
            />
          ) : (
            ride.checklist.map((item) => (
              <Press
                key={item.id}
                testID={`ride-check-${item.id}`}
                onPress={() => tick(item)}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.done }}
                accessibilityLabel={item.text}
              >
                <Icon name={item.done ? "checkbox-marked-circle-outline" : "checkbox-blank-circle-outline"} size={20} color={item.done ? colors.success : colors.muted} />
                <T style={{ flex: 1, textDecorationLine: item.done ? "line-through" : "none" }} muted={item.done}>{item.text}</T>
              </Press>
            ))
          )}
          <Button small kind="ghost" icon="tune-variant" label="Edit checklist template" testID="ride-checklist-template" style={{ marginTop: 6 }} onPress={() => setTemplateSheet(true)} />
        </View>
      ) : null}
      {odoSheet ? <OdometerSheet vehicle={vehicle} onClose={() => setOdoSheet(false)} /> : null}
      {templateSheet ? <RideTemplateSheet vehicle={vehicle} onClose={() => setTemplateSheet(false)} /> : null}
      <Sheet visible={journeySheet} onClose={() => setJourneySheet(false)} title="End journey" footer={<Button label="Save end" icon="flag-checkered" testID="vehicle-journey-save" onPress={() => {
        if (!openJourney) return;
        const O = parseNum(endOdo);
        if (isNaN(O)) return toast("Enter a valid odometer", "speedometer");
        update((d) => closeVehicleJourney(d, openJourney.id, new Date().toISOString(), O));
        setJourneySheet(false);
      }} />}>
        <Field numeric label="End odometer" unit={db.settings.distanceUnit} value={endOdo} onChangeText={setEndOdo} testID="vehicle-journey-end-odo" />
      </Sheet>
    </Card>
  );
}

/** Timed odometer reading. Shared by the vehicle screen stat and the journey card. */
export function OdometerSheet({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [odo, setOdo] = useState(() => String(currentOdometer(db, vehicle)));
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("12:00");
  return (
    <Sheet visible onClose={onClose} title="Odometer reading" testID="odo-sheet" footer={<Button label="Save" icon="check" testID="vehicle-odo-save" onPress={() => {
      const O = parseNum(odo);
      const parts = time.match(/^(\d{1,2}):(\d{2})$/);
      if (!parts) return toast("Enter a time as HH:MM", "clock-outline");
      if (isNaN(O)) return toast("Enter a valid odometer", "speedometer");
      const at = `${date}T${parts[1].padStart(2, "0")}:${parts[2]}:00`;
      update((d) => addOdometerLog(d, { id: uid(), vehicleId: vehicle.id, at, odometer: O }));
      onClose();
    }} />}>
      <Field numeric label="Odometer" unit={db.settings.distanceUnit} value={odo} onChangeText={setOdo} testID="vehicle-odo-value" />
      <DateField label="Date" value={date} onChange={(v) => setDate(v ?? todayISO())} testID="vehicle-odo-date" />
      <TimeField label="Time" value={time} onChange={setTime} testID="vehicle-odo-time" />
    </Sheet>
  );
}

/** Edit the vehicle's saved template. Rides already started keep their own copy. */
function RideTemplateSheet({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { update } = useStore();
  const toast = useToast();
  const { colors } = useTheme();
  const [items, setItems] = useState<string[]>(() => rideChecklistTemplate(vehicle));
  const [draft, setDraft] = useState("");
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setItems((cur) => [...cur, text.slice(0, 60)].slice(0, 30));
    setDraft("");
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title="Ride checklist template"
      testID="ride-template-sheet"
      footer={<Button label="Save template" icon="check" testID="ride-template-save" onPress={() => {
        update((d) => upsertVehicle(d, { ...vehicle, rideChecklist: items }));
        toast("Checklist template saved", "format-list-checks");
        onClose();
      }} />}
    >
      <T muted style={{ marginBottom: 10 }}>New rides copy this list. Ticking items on a ride never changes the template.</T>
      {items.map((text, index) => (
        <View key={`${text}-${index}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 }}>
          <Icon name="format-list-checks" size={18} color={colors.muted} />
          <T style={{ flex: 1 }} numberOfLines={1}>{text}</T>
          <IconButton icon="close" label={`Remove ${text}`} testID={`ride-template-remove-${index}`} onPress={() => setItems((cur) => cur.filter((_, i) => i !== index))} />
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
        <TextInput
          testID="ride-template-input"
          value={draft}
          onChangeText={setDraft}
          placeholder="Add an item"
          placeholderTextColor={colors.muted}
          onSubmitEditing={add}
          style={{ flex: 1, height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }}
        />
        <IconButton icon="plus" label="Add item" testID="ride-template-add" onPress={add} />
      </View>
      <Button small kind="ghost" label="Reset to the default list" testID="ride-template-reset" style={{ marginTop: 8 }} onPress={() => setItems([...RIDE_CHECKLIST_DEFAULTS[vehicle.type]])} />
    </Sheet>
  );
}
