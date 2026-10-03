import React, { useEffect, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Device from "expo-device";
import * as Battery from "expo-battery";
import { Accelerometer, Barometer, Gyroscope, LightSensor, Magnetometer } from "expo-sensors";
import { radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { exportData } from "@/src/core/exports";
import { num, todayISO } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Button, Card, Chip, ChipRow, Eyebrow, Icon, Press, T } from "@/src/components/ui";
import { LineChart } from "@/src/components/charts";
import { useToast } from "@/src/components/Toast";
import { ModuleGate } from "@/src/components/ModuleGate";

type SensorId = "accelerometer" | "gyroscope" | "magnetometer";
const SENSORS: { id: SensorId; label: string; icon: string; unit: string; mod: any }[] = [
  { id: "accelerometer", label: "Accelerometer", icon: "axis-arrow", unit: "g", mod: Accelerometer },
  { id: "gyroscope", label: "Gyroscope", icon: "rotate-3d-variant", icon2: "", unit: "rad/s", mod: Gyroscope } as any,
  { id: "magnetometer", label: "Magnetometer", icon: "magnet", unit: "µT", mod: Magnetometer },
];

export default function Lab() {
  const { db } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [sensor, setSensor] = useState<SensorId>("accelerometer");
  const [xyz, setXyz] = useState({ x: 0, y: 0, z: 0 });
  const [history, setHistory] = useState<number[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [recording, setRecording] = useState<{ t: number; x: number; y: number; z: number }[] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lux, setLux] = useState<number | null>(null);
  const [hpa, setHpa] = useState<number | null>(null);
  const [lightOk, setLightOk] = useState<boolean | null>(null);
  const [baroOk, setBaroOk] = useState<boolean | null>(null);
  const [battery, setBattery] = useState<{ level: number; state: number; saver: boolean } | null>(null);
  const [touches, setTouches] = useState<{ x: number; y: number }[]>([]);
  const [fill, setFill] = useState<string | null>(null);
  const started = useRef(false);

  // Sensors run only while this screen is mounted — nothing samples in the background.
  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    let alive = true;
    const meta = SENSORS.find((s) => s.id === sensor)!;
    setHistory([]);
    (async () => {
      const ok = Platform.OS !== "web" ? await meta.mod.isAvailableAsync().catch(() => false) : false;
      if (!alive) return;
      setAvailable(ok);
      if (!ok) return;
      meta.mod.setUpdateInterval(120);
      sub = meta.mod.addListener((d: any) => {
        setXyz(d);
        setHistory((h) => [...h.slice(-59), Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z)]);
        setRecording((r) => (r ? [...r, { t: Date.now(), x: d.x, y: d.y, z: d.z }] : r));
      });
      started.current = true;
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [sensor]);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(id);
  }, [recording === null]);

  useEffect(() => {
    if (Platform.OS === "web") {
      setLightOk(false);
      setBaroOk(false);
      return;
    }
    let alive = true;
    let lightSub: { remove: () => void } | undefined;
    let baroSub: { remove: () => void } | undefined;
    (async () => {
      const [light, baro] = await Promise.all([LightSensor.isAvailableAsync().catch(() => false), Barometer.isAvailableAsync().catch(() => false)]);
      if (!alive) return;
      setLightOk(light);
      setBaroOk(baro);
      if (light) {
        LightSensor.setUpdateInterval(500);
        lightSub = LightSensor.addListener(({ illuminance }) => alive && setLux(illuminance));
      }
      if (baro) {
        Barometer.setUpdateInterval(1000);
        baroSub = Barometer.addListener(({ pressure }) => alive && setHpa(pressure));
      }
    })();
    return () => {
      alive = false;
      lightSub?.remove();
      baroSub?.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let alive = true;
    (async () => {
      const [level, state, saver] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync(), Battery.isLowPowerModeEnabledAsync()]);
      if (alive) setBattery({ level, state, saver });
    })().catch(() => {});
    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) => alive && setBattery((b) => (b ? { ...b, level: batteryLevel } : b)));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const heading = (() => {
    if (sensor !== "magnetometer") return undefined;
    let a = Math.atan2(xyz.y, xyz.x) * (180 / Math.PI);
    if (a < 0) a += 360;
    return a;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Phone Lab" testID="lab-header" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: sp.md, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <Card testID="lab-device-card">
          <Eyebrow>This device</Eyebrow>
          {(
            [
              ["Make & model", [Device.brand, Device.modelName].filter(Boolean).join(" ") || "—"],
              ["System", `${Device.osName ?? Platform.OS} ${Device.osVersion ?? ""}`.trim()],
              ["Device type", Device.deviceType !== null ? ["unknown", "phone", "tablet", "desktop", "TV"][Device.deviceType] ?? "—" : "—"],
              ["Memory", Device.totalMemory ? `${num(Device.totalMemory / 1024 ** 3, 1)} GB` : "—"],
              ["Real device", Device.isDevice ? "yes" : "no (emulator or browser)"],
            ] as [string, string][]
          ).map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", marginTop: 8 }}>
              <T muted style={{ flex: 1 }}>
                {k}
              </T>
              <T v="mono" style={{ flexShrink: 1, textAlign: "right" }} numberOfLines={1}>
                {v}
              </T>
            </View>
          ))}
        </Card>

        <Card testID="lab-battery-card">
          <Eyebrow>Battery</Eyebrow>
          {battery ? (
            <>
              <T v="display" style={{ marginTop: 6 }} testID="lab-battery-level">
                {num(battery.level * 100, 0)}%
              </T>
              <T muted>
                {[undefined, "unknown", "unplugged", "charging", "full"][battery.state + 1] ?? "unknown"}
                {battery.saver ? " · battery saver on" : ""}
              </T>
            </>
          ) : (
            <T muted style={{ marginTop: 6 }}>Battery details need the installed app.</T>
          )}
        </Card>

        <Card testID="lab-environment-card">
          <Eyebrow>Light and air pressure</Eyebrow>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <T muted>Light</T>
              <T v="monoLg" testID="lab-lux">{lightOk === false ? "Not available" : lux === null ? "—" : `${num(lux, 0)} lux`}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T muted>Barometer</T>
              <T v="monoLg" testID="lab-pressure">{baroOk === false ? "Not available" : hpa === null ? "—" : `${num(hpa, 0)} hPa`}</T>
            </View>
          </View>
          <T muted style={{ fontSize: 12, marginTop: 8 }}>These stay on only while Phone Lab is open. A phone without the sensor says so.</T>
        </Card>

        <Card testID="lab-sensor-card">
          <Eyebrow>Sensors · live only while this screen is open</Eyebrow>
          <View style={{ marginHorizontal: -16, marginTop: 4 }}>
            <ChipRow testID="lab-sensor-row">
              {SENSORS.map((s) => (
                <Chip key={s.id} label={s.label} icon={s.icon} selected={sensor === s.id} testID={`lab-sensor-${s.id}`} onPress={() => setSensor(s.id)} />
              ))}
            </ChipRow>
          </View>
          {available === false ? (
            <T muted testID="lab-sensor-unavailable">
              {Platform.OS === "web" ? "Sensors are only readable in the installed app on a real device." : "This device does not report that sensor."}
            </T>
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                {(["x", "y", "z"] as const).map((k) => (
                  <View key={k} style={{ flex: 1 }}>
                    <Eyebrow>{k.toUpperCase()}</Eyebrow>
                    <T v="mono" testID={`lab-axis-${k}`}>{num(xyz[k], 3)}</T>
                  </View>
                ))}
              </View>
              {heading !== undefined ? (
                <T v="monoLg" style={{ marginTop: 8 }} testID="lab-heading">
                  {num(heading, 0)}° · {["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(heading / 45) % 8]}
                </T>
              ) : null}
              {history.length > 2 ? (
                <View style={{ marginTop: 12 }}>
                  <LineChart data={history} width={260} height={90} testID="lab-sensor-chart" />
                </View>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <Button
                  small
                  label={recording ? `Stop · ${String(Math.floor(elapsed / 60000)).padStart(2, "0")}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")} · ${recording.length}` : "Record samples"}
                  icon={recording ? "stop-circle-outline" : "record-circle-outline"}
                  testID="lab-record-button"
                  onPress={() => {
                    if (recording) {
                      const rows = [["time_ms", "x", "y", "z"], ...recording.map((r) => [r.t, r.x, r.y, r.z])];
                      const text = rows.map((r) => r.join(",")).join("\n");
                      setRecording(null);
                      if (Platform.OS === "web") {
                        const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
                        const a = (globalThis as any).document.createElement("a");
                        a.href = url;
                        a.download = `nucleus-${sensor}-${todayISO()}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                      toast(`${rows.length - 1} samples exported`, "download-outline");
                    } else setRecording([]);
                  }}
                />
                <Button small kind="secondary" label="Reset graph" icon="refresh" testID="lab-reset-button" onPress={() => setHistory([])} />
              </View>
            </>
          )}
        </Card>

        <Card testID="lab-touch-card">
          <Eyebrow>Touch test · tap anywhere in the box</Eyebrow>
          <Press
            testID="lab-touch-area"
            haptic={false}
            onPress={(e: any) => setTouches((t) => [...t.slice(-60), { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }])}
            style={[styles.touch, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary }]}
          >
            {touches.map((p, i) => (
              <View key={i} style={{ position: "absolute", left: p.x - 4, top: p.y - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary }} />
            ))}
          </Press>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <Button small kind="secondary" label={`Clear (${touches.length})`} icon="eraser" testID="lab-touch-clear" onPress={() => setTouches([])} />
            <Button small kind="secondary" label="Vibrate" icon="vibrate" testID="lab-vibrate-button" onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})} />
          </View>
        </Card>

        <Card testID="lab-display-card">
          <Eyebrow>Display test · a flat colour finds dead pixels</Eyebrow>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF"].map((c) => (
              <Press key={c} testID={`lab-fill-${c.slice(1)}`} onPress={() => setFill(c)} style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: c, borderWidth: 1, borderColor: colors.borderStrong }} />
            ))}
          </View>
          <T muted style={{ fontSize: 12, marginTop: 8 }}>Tap a swatch to fill the screen, then tap again to come back.</T>
        </Card>

        <T muted style={{ fontSize: 12 }}>Nothing here is stored or sent. Sensors stop the moment you leave this screen, so Phone Lab costs no battery in the background.</T>
      </ScrollView>

      {fill ? (
        <Press testID="lab-fill-overlay" onPress={() => setFill(null)} style={[StyleSheet.absoluteFill, { backgroundColor: fill, alignItems: "center", justifyContent: "flex-end", paddingBottom: insets.bottom + 28 }]}>
          <T color={fill === "#FFFFFF" || fill === "#00FF00" ? "#111418" : "#FFFFFF"}>Tap to return</T>
        </Press>
      ) : null}
      <ModuleGate id="lab" name="Phone Lab" icon="chip" />
      {db.settings.onboarded ? null : null}
    </View>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  touch: { height: 160, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", marginTop: 10, overflow: "hidden" },
}));
