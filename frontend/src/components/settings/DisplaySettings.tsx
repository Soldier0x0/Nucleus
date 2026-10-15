import React, { useEffect, useState } from "react";
import { ScrollView, Switch, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { accents, radius, THEMES, useTheme } from "@/src/theme";
import { geocode } from "@/src/core/online";
import { locationPhase, placeFromFix } from "@/src/core/locationAsk";
import { cleanCallName } from "@/src/core/greeting";
import type { Place } from "@/src/core/types";
import { useStore } from "@/src/core/store";
import { CURRENCIES } from "@/src/core/format";
import { LauncherPicker } from "@/src/components/LauncherPicker";
import { LookPicker } from "@/src/components/LookPicker";
import { Field } from "@/src/components/inputs";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { Button, Chip, ChipRow, Icon, Press, Segmented, T } from "@/src/components/ui";
import { Row, Section, SettingsScreen, settingsStyles, useSettingsAnchor, useSwitchColors } from "./parts";

const REOPEN_CHOICES: { hours: number; label: string }[] = [
  { hours: 0, label: "Off" },
  { hours: 1, label: "1 hour" },
  { hours: 3, label: "3 hours" },
  { hours: 12, label: "12 hours" },
  { hours: 24, label: "24 hours" },
];

/** Display: appearance, You, defaults, online, home tiles and accessibility. */
export function DisplaySettings() {
  const { db, setSettings, update, session } = useStore();
  const s = db.settings;
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const sw = useSwitchColors();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencies = [...CURRENCIES].sort((a, b) => a.localeCompare(b, "en"));
  const [city, setCity] = useState("");
  const [cityMatches, setCityMatches] = useState<Place[]>([]);
  const [showLog, setShowLog] = useState(false);
  const locationOnce = locationPhase({ asked: s.locationAsked, granted: s.locationGranted, read: !!s.locationRead });
  useEffect(() => {
    if (locationOnce !== "read") return;
    let cancelled = false;
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }).then((pos) => {
      if (cancelled) return;
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setSettings({ locationRead: { lat, lon }, homeCity: placeFromFix({ lat, lon }, "This phone"), locationAsked: true, locationGranted: true });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locationOnce, setSettings]);
  const params = useLocalSearchParams<{ section?: string }>();
  const storedAnchor = useSettingsAnchor();
  const anchor = params.section === "weather" ? "online" : storedAnchor;
  return (
    <SettingsScreen title="Display" testID="settings-display" anchor={anchor}>
      {session === "real" ? (
        <Section title="You" anchor="you">
          <View style={{ padding: 12 }}>
            <Field label="What should I call you?" testID="settings-call-name" value={s.givenName ?? ""} onChangeText={(v) => setSettings({ givenName: cleanCallName(v) || undefined, nameAsked: true })} placeholder="Harsha" autoCapitalize="words" hint="Shown on Today. A decoy PIN does not see this." />
          </View>
        </Section>
      ) : null}

      <Section title="Appearance" anchor="appearance">
        <View style={{ padding: 12, gap: 12 }}>
          <T v="label">Color</T>
          <View style={{ marginHorizontal: -12 }}>
            <ChipRow testID="settings-theme-row">
              {[["system", "System", undefined], ...Object.entries(THEMES).map(([k, t]) => [k, t.name, t.swatch])].map(([k, n, swatch]) => (
                <Press key={k} testID={`settings-theme-${k}`} onPress={() => setSettings({ theme: k as any, appearanceChosen: true })} accessibilityState={{ selected: s.theme === k }} style={[settingsStyles.swatchWrap, { borderColor: s.theme === k ? colors.onSurface : colors.border }]}>
                  <View style={[settingsStyles.swatch, { backgroundColor: swatch ?? colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong }]}>{s.theme === k ? <Icon name="check" size={14} color={k === "paper" ? "#111418" : "#FFFFFF"} /> : null}</View>
                  <T v="caption">{n}</T>
                </Press>
              ))}
            </ChipRow>
          </View>
          <LookPicker />
          <Segmented testID="settings-density" value={s.density} onChange={(v) => setSettings({ density: v })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "dense", label: "Dense" }]} />
          <LauncherPicker />
        </View>
        <View style={{ marginHorizontal: -4, paddingBottom: 4 }}>
          <ChipRow testID="settings-accent-row">
            {Object.entries(accents).map(([k, a]) => (
              <Press key={k} testID={`settings-accent-${k}`} onPress={() => setSettings({ accent: k })} accessibilityLabel={`${a.name} accent`} accessibilityState={{ selected: s.accent === k }} style={[settingsStyles.swatchWrap, { borderColor: s.accent === k ? colors.onSurface : colors.border }]}>
                <View style={[settingsStyles.swatch, { backgroundColor: a.base }]}>{s.accent === k ? <Icon name="check" size={14} color="#FFFFFF" /> : null}</View>
                <T v="caption">{a.name}</T>
              </Press>
            ))}
          </ChipRow>
        </View>
      </Section>

      <Section title="Online (optional)" testID="settings-weather" anchor="online">
        <Row first icon="web" label="Online features" sub={s.online ? "On · rates, weather, holidays. Only queries leave the device." : "Off · no network requests at all"} right={<Switch testID="settings-online-switch" value={s.online} onValueChange={(v) => setSettings({ online: v })} {...sw} />} />
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
          <T v="label" style={{ marginBottom: 6 }}>Home city (weather)</T>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput testID="settings-city-input" value={city} onChangeText={setCity} placeholder={s.homeCity?.name ?? "e.g. Bengaluru"} placeholderTextColor={colors.muted} style={{ flex: 1, height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
            <Button small label="Find" testID="settings-city-find" disabled={!s.online || !city.trim()} onPress={async () => setCityMatches(await geocode(s.online, (e) => update((d) => ({ ...d, netlog: [e, ...d.netlog].slice(0, 300) })), city))} />
          </View>
          {cityMatches.map((m, i) => (
            <Press key={i} testID={`settings-city-result-${i}`} onPress={() => (setSettings({ homeCity: m }), setCityMatches([]), setCity(""), toast(`Home city: ${m.name}`, "map-marker-outline"))} style={{ paddingVertical: 10 }}>
              <T numberOfLines={1}>{m.name}</T>
            </Press>
          ))}
          {s.homeCity ? <T muted style={{ fontSize: 12, marginTop: 6 }}>Current: {s.homeCity.name}. The forecast uses about 1 km, not your street, and prefers a land reading.</T> : null}
          {locationPhase({ asked: s.locationAsked, granted: s.locationGranted, read: !!s.locationRead }) === "ask" ? (
            <Button small label="Use this phone's location once" testID="settings-location-once" onPress={async () => {
              const result = await Location.requestForegroundPermissionsAsync();
              if (!result.granted) setSettings({ locationAsked: true, locationGranted: false });
              else setSettings({ locationAsked: true, locationGranted: true });
            }} style={{ marginTop: 8 }} />
          ) : null}
          {locationPhase({ asked: s.locationAsked, granted: s.locationGranted, read: !!s.locationRead }) === "stop" && s.locationAsked && !s.locationGranted ? (
            <T muted style={{ fontSize: 12, marginTop: 6 }}>{"Location stays off. Nucleus cannot turn the phone's location switch on or off."}</T>
          ) : null}
          {!s.online ? <T muted style={{ fontSize: 12, marginTop: 6 }}>Turn Online on to search for a city.</T> : null}
        </View>
        <Row icon="format-list-bulleted" label="Network log" sub={`${db.netlog.length} request${db.netlog.length === 1 ? "" : "s"} ever made`} testID="settings-netlog-button" onPress={() => setShowLog(true)} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
      </Section>

      <Section title="Defaults" anchor="defaults">
        <View style={{ padding: 12 }}>
          <Press testID="settings-currency-row" onPress={() => setCurrencyOpen(true)} style={{ height: 46, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 16, justifyContent: "center", backgroundColor: colors.surfaceTertiary }}>
            <T>{s.currency}</T>
          </Press>
        </View>
        <View style={{ padding: 12, paddingTop: 4, gap: 10 }}>
          <Segmented testID="settings-distance" value={s.distanceUnit} onChange={(v) => setSettings({ distanceUnit: v })} options={[{ value: "km", label: "km" }, { value: "mi", label: "miles" }]} />
          <Segmented testID="settings-volume" value={s.volumeUnit} onChange={(v) => setSettings({ volumeUnit: v })} options={[{ value: "L", label: "Litres" }, { value: "gal", label: "Gallons" }]} />
          <Segmented testID="settings-temp" value={s.tempUnit} onChange={(v) => setSettings({ tempUnit: v })} options={[{ value: "C", label: "°C" }, { value: "F", label: "°F" }]} />
          <Segmented testID="settings-time" value={s.timeFormat} onChange={(v) => setSettings({ timeFormat: v })} options={[{ value: "12h", label: "12-hour" }, { value: "24h", label: "24-hour" }]} />
          <T muted style={{ fontSize: 12 }}>Distance, fuel volume, temperature and time are what your records use. Length, weight, cooking measures, speed, area, data, pressure and energy are in Tools.</T>
        </View>
        <Row icon="link-variant" label="Auto-link vehicle costs to Money" sub="Fuel & service costs create linked expenses" right={<Switch testID="settings-autolink-switch" value={s.autoLinkExpenses} onValueChange={(v) => setSettings({ autoLinkExpenses: v })} {...sw} />} />
        <Row icon="restore" label="Reopen last screen" sub="Hours a cold start may come back to where you were. Off always lands on Favourites." />
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <ChipRow testID="settings-reopen-hours">
            {REOPEN_CHOICES.map((choice) => (
              <Chip key={choice.hours} label={choice.label} selected={(s.reopenHours ?? 0) === choice.hours} testID={`settings-reopen-${choice.hours}`} onPress={() => setSettings({ reopenHours: choice.hours })} />
            ))}
          </ChipRow>
        </View>
      </Section>

      <Section title="Home screen" anchor="home">
        <Row first icon="widgets-outline" label="Widgets and shortcuts" sub="Countdown, budget, trip, maintenance, battery, the next cycle window, and a long-press on the icon" testID="settings-shortcuts" onPress={() => router.push("/shortcuts")} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        <Row icon="package-variant-closed" label="Packs" sub="Share templates, tools, checklists and rules by file" testID="settings-packs" onPress={() => router.push("/packs")} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
      </Section>

      <Section title="Accessibility" anchor="accessibility">
        <Row first icon="contrast-circle" label="High contrast" sub="Stronger text, borders and dividers" right={<Switch testID="settings-contrast-switch" value={s.highContrast} onValueChange={(v) => setSettings({ highContrast: v })} {...sw} />} />
        <Row icon="gesture-tap-button" label="Large touch targets" sub="Bigger buttons and chips" right={<Switch testID="settings-largetouch-switch" value={s.largeTouch} onValueChange={(v) => setSettings({ largeTouch: v })} {...sw} />} />
        <Row icon="motion-outline" label="Reduce motion" sub="Skip tile animations and press effects" right={<Switch testID="settings-motion-switch" value={s.reducedMotion} onValueChange={(v) => setSettings({ reducedMotion: v })} {...sw} />} />
      </Section>

      <Sheet visible={showLog} onClose={() => setShowLog(false)} title="Network log" testID="netlog-sheet">
        {db.netlog.length === 0 ? <T muted testID="netlog-empty">No requests have ever been made. Nucleus has been fully offline.</T> : db.netlog.slice(0, 100).map((e) => (
          <View key={e.id} style={{ flexDirection: "row", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <Icon name={e.ok ? "check-circle-outline" : "alert-circle-outline"} size={16} color={e.ok ? colors.success : colors.error} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="label" numberOfLines={1}>{e.service}</T>
              <T muted style={{ fontSize: 12 }} numberOfLines={1}>asked: {e.query} · {new Date(e.at).toLocaleString()}</T>
            </View>
          </View>
        ))}
      </Sheet>

      <Sheet visible={currencyOpen} onClose={() => setCurrencyOpen(false)} title="Currency" testID="settings-currency-sheet">
        <ScrollView style={{ maxHeight: 360 }}>
          {currencies.map((c) => (
            <Press key={c} testID={`settings-currency-${c}`} onPress={() => (setSettings({ currency: c }), setCurrencyOpen(false))} style={{ minHeight: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.divider, opacity: s.currency === c ? 1 : 0.85 }}>
              <T v="label">{c}</T>
            </Press>
          ))}
        </ScrollView>
      </Sheet>
    </SettingsScreen>
  );
}
