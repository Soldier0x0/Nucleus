import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useTheme } from "@/src/theme";
import { useOnline } from "@/src/core/useOnline";
import { Place } from "@/src/core/types";
import { Weather, weather, wmo } from "@/src/core/online";
import { Card, Eyebrow, Icon, T } from "./ui";

/** Weather card: renders only from Online data or cache. Credits Open-Meteo per its licence. */
export function WeatherCard({ place, testID = "weather-card", from, to }: { place: Place; testID?: string; from?: string; to?: string }) {
  const { online, log } = useOnline();
  const { colors } = useTheme();
  const [w, setW] = useState<{ w: Weather; at: string; stale: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    weather(online, log, place).then((r) => alive && (setW(r), setLoading(false)));
    return () => {
      alive = false;
    };
  }, [online, place.lat, place.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w)
    return (
      <Card testID={testID}>
        <Eyebrow>Weather · {place.name.split(",")[0]}</Eyebrow>
        <T muted style={{ marginTop: 6 }}>{loading ? "Loading…" : online ? "Weather unavailable right now." : "Turn Online on to fetch weather."}</T>
      </Card>
    );
  const [label, icon] = wmo(w.w.current.code);
  const days = w.w.daily.filter((d) => (!from || d.date >= from) && (!to || d.date <= to));
  return (
    <Card testID={testID}>
      <Eyebrow>Weather · {place.name.split(",")[0]}{w.stale ? " · cached" : ""}</Eyebrow>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
        <Icon name={icon} size={40} color={colors.brandPrimary} />
        <View style={{ flex: 1 }}>
          <T v="monoXl" testID={`${testID}-temp`}>{Math.round(w.w.current.temp)}°C</T>
          <T muted numberOfLines={1}>{label} · wind {Math.round(w.w.current.wind)} km/h{w.w.aqi !== undefined ? ` · AQI ${w.w.aqi}` : ""}</T>
        </View>
        {w.w.sunrise ? (
          <View style={{ alignItems: "flex-end" }}>
            <T v="mono" style={{ fontSize: 12 }}>↑ {w.w.sunrise}</T>
            <T v="mono" style={{ fontSize: 12 }}>↓ {w.w.sunset}</T>
          </View>
        ) : null}
      </View>
      {days.length ? (
        <View style={{ flexDirection: "row", marginTop: 12, gap: 4 }}>
          {days.slice(0, 7).map((d) => (
            <View key={d.date} style={{ flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surfaceTertiary }}>
              <T muted style={{ fontSize: 10 }}>{new Date(d.date).toLocaleDateString("en-US", { weekday: "short" })}</T>
              <Icon name={wmo(d.code)[1]} size={18} />
              <T v="mono" style={{ fontSize: 11 }}>{Math.round(d.max)}°</T>
              <T v="mono" muted style={{ fontSize: 10 }}>{Math.round(d.min)}°</T>
            </View>
          ))}
        </View>
      ) : null}
      <T muted style={{ fontSize: 10, marginTop: 8 }}>Weather data by Open-Meteo.com (CC BY 4.0) · updated {new Date(w.at).toLocaleString()}</T>
    </Card>
  );
}
