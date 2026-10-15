import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView } from "react-native-gesture-handler";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { addWaterTime, formatWaterTime, removeWaterTime } from "@/src/core/water";
import { requestPermission } from "@/src/core/notify";
import { Header } from "@/src/components/Header";
import { Button, Card, IconButton, T } from "@/src/components/ui";
import { ModuleGate } from "@/src/components/ModuleGate";
import { useToast } from "@/src/components/Toast";
import { useRealSession } from "@/src/components/useRealSession";

/** Reminders at times the person sets. Nothing is counted. */
export default function HealthScreen() {
  const real = useRealSession();
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const on = db.settings.modules.find((m) => m.id === "health")?.enabled !== false;
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (real && !on) router.replace("/");
  }, [real, on, router]);

  if (!real || !on) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const add = async () => {
    const perm = await requestPermission();
    if (!perm.granted) {
      toast("Notifications are off", "bell-off-outline");
      return;
    }
    if (db.water.times.some((time) => time.hour === hour && time.minute === minute)) {
      toast("That time is already on the list");
      return;
    }
    if (db.water.times.length >= 8) {
      toast("Eight reminders is the limit");
      return;
    }
    update((d) => ({ ...d, water: addWaterTime(d.water, hour, minute) }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="health-screen">
      <Header title="Health" testID="health-header" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 28, gap: 14, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <Card testID="health-medicines-link" onPress={() => router.push("/health/medicines")}>
          <T v="label">Medicines</T>
          <T muted>{db.medicines.length ? `${db.medicines.filter((m) => m.active).length} active` : "Add a medicine and the times you take it"}</T>
        </Card>
        <T>A water reminder at the time you set. Nothing is counted.</T>
        <T muted>If that time is inside quiet hours, the reminder moves to when quiet hours end.</T>
        <Card testID="health-clock">
          <T v="label">Time</T>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
            <IconButton icon="minus" label="Earlier hour" testID="health-hour-minus" onPress={() => setHour((value) => (value + 23) % 24)} />
            <T v="h2" style={{ flex: 1, textAlign: "center" }} testID="health-hour">{formatWaterTime(hour, minute, db.settings.timeFormat)}</T>
            <IconButton icon="plus" label="Later hour" testID="health-hour-plus" onPress={() => setHour((value) => (value + 1) % 24)} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <IconButton icon="minus" label="Earlier minutes" testID="health-minute-minus" onPress={() => setMinute((value) => (value + 45) % 60)} />
            <T muted style={{ flex: 1, textAlign: "center" }}>Minutes step by 15</T>
            <IconButton icon="plus" label="Later minutes" testID="health-minute-plus" onPress={() => setMinute((value) => (value + 15) % 60)} />
          </View>
          <Button label="Add reminder" testID="health-add" style={{ marginTop: 8 }} onPress={() => add().catch(() => toast("Could not add that time"))} />
        </Card>
        {db.water.times.map((time) => (
          <Card key={time.id} testID={`health-time-${time.id}`}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <T v="h2" style={{ flex: 1 }}>{formatWaterTime(time.hour, time.minute, db.settings.timeFormat)}</T>
              <Button label="Remove" kind="ghost" testID={`health-remove-${time.id}`} onPress={() => update((d) => ({ ...d, water: removeWaterTime(d.water, time.id) }))} />
            </View>
          </Card>
        ))}
      </ScrollView>
      <ModuleGate id="health" name="Health" icon="cup-water" />
    </View>
  );
}
