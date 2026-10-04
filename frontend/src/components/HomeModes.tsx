import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LayoutAnimation, Platform, ScrollView, Switch, TextInput, UIManager, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { homeCard } from "@/src/core/homeCards";
import { homeFace, type HomeWeather } from "@/src/core/homeFace";
import { presentHome, type HomePresentation } from "@/src/core/layouts";
import { weather, wmo } from "@/src/core/online";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { todayISO } from "@/src/core/format";
import {
  ADHD_BUFFER_MS,
  adhdBuddy,
  adhdOpen,
  adhdTimer,
  adhdView,
  finishAdhdTask,
  lastPresetThing,
  parkAdhdTask,
  homePresetTiles,
  presetThingLabel,
  presetTileTitle,
  recallAdhdTask,
  rowFlex,
  rememberPreset,
  reviewAdhdDay,
  setAdhdBuddy,
  setAdhdMotion,
  startAdhdTask,
  swipePages,
  swipeScreens,
  swipeStartIndex,
  swipeWrap,
  toggleTileSize,
  typeAdhdDraft,
  withTileSizes,
} from "@/src/core/presets";
import { dismissHeadsUp, nextHeadsUp, rememberHeadsUp } from "@/src/core/proactive";
import type { HomePresetId } from "@/src/core/types";
import { Button, Card, Eyebrow, Icon, T } from "./ui";
import { Ring } from "./charts";
import { Sheet } from "./Sheet";
import { WeatherCard } from "./WeatherCard";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function PresetGrid({
  preset,
  layoutFor,
  emptyCopy,
}: {
  preset: HomePresetId;
  layoutFor?: (page: HomePresetId) => HomePresentation;
  emptyCopy?: (id: string) => { title: string; line: string; route: string };
}) {
  const { db, update, session } = useStore();
  const router = useRouter();
  const { colors, sp, layout } = useTheme();
  const presented = layoutFor
    ? layoutFor(preset)
    : presentHome(layout.layout, withTileSizes(db, homePresetTiles(db, preset, session)));
  void emptyCopy;
  const [forecast, setForecast] = useState<HomeWeather | null>(null);
  const city = db.settings.homeCity;
  useEffect(() => {
    if (!city) {
      setForecast(null);
      return;
    }
    let alive = true;
    weather(db.settings.online, () => {}, city).then((result) => {
      if (!alive || !result) return;
      const [label] = wmo(result.w.current.code);
      setForecast({ temp: result.w.current.temp, label, feels: result.w.current.feels, wind: result.w.current.wind });
    });
    return () => {
      alive = false;
    };
  }, [city, db.settings.online]);
  const lastId = lastPresetThing(db, preset);
  const lastLabel = presetThingLabel(db, lastId);
  const routeForRemembered = (id: string) => {
    if (db.txns.some((row) => row.id === id)) return `/money?focus=${id}&field=note`;
    if (db.trips.some((row) => row.id === id)) return `/travel/${id}`;
    if (db.notes.some((row) => row.id === id)) return `/notes?id=${id}&field=body`;
    if (db.vehicles.some((row) => row.id === id)) return `/vehicles/${id}`;
    return "/";
  };
  const open = (id: string, route: string) => {
    update((current) => rememberPreset(current, preset, id));
    router.push(route as never);
  };
  const resize = (id: string, size: "large" | "small") => {
    if (!db.settings.reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    update((current) => toggleTileSize(current, id, size));
  };
  return (
    <View style={{ gap: sp.md }} testID={`today-preset-${preset}-grid`}>
      {lastLabel ? (
        <Card testID={`today-preset-last-${preset}`} onPress={() => open(lastId, routeForRemembered(lastId))}>
          <T>{lastLabel}</T>
        </Card>
      ) : null}
      {presented.rows.map((row, index) => {
        const flexes = rowFlex(row);
        const loneSmall = flexes.length === 1 && flexes[0].span === 1;
        return (
          <View key={`${row.items.map((item) => item.id).join("-")}-${index}`} style={{ flexDirection: "row", gap: sp.md, alignItems: "stretch" }}>
            {row.items.map((item) => {
              const shown = homeCard(db, item.id, item.id === "weather" ? forecast : null);
              const face = homeFace(db, item.id, item.id === "weather" ? forecast : null);
              const title = presetTileTitle(item.id);
              const hold = () => resize(item.id, item.size);
              if (item.id === "weather" && city) {
                return (
                  <View key={item.id} style={{ flex: 1 }}>
                    <WeatherCard place={city} testID={`today-slot-${item.id}`} onPress={() => open(item.id, shown.route)} onLongPress={hold} />
                  </View>
                );
              }
              return (
                <View key={item.id} style={{ flex: 1 }}>
                  <Card testID={`today-slot-${item.id}`} onPress={() => open(item.id, face.route || shown.route)} onLongPress={hold}>
                    <Eyebrow>{face.eyebrow || title}</Eyebrow>
                    {item.id === "attention" && face.counts ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
                        <Ring value={face.counts.urgent + face.counts.upcoming > 0 ? 1 : 0} size={64} stroke={6}>
                          <T v="monoXl">{face.figure}</T>
                        </Ring>
                        <View style={{ flex: 1, gap: 6 }}>
                          <T>{face.detail}</T>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            <CountPill icon="alert-octagon" label={`${face.counts.urgent} urgent`} color={colors.error} />
                            <CountPill icon="clock-alert-outline" label={`${face.counts.upcoming} upcoming`} color={colors.warning} />
                            <CountPill icon="information-outline" label={`${face.counts.info} info`} color={colors.info} />
                          </View>
                        </View>
                      </View>
                    ) : item.id === "budget" ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
                        <Ring value={face.meter ?? 0} size={72} stroke={8} />
                        <T v="monoXl">{face.figure}</T>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
                        <Icon name={face.icon || shown.icon} size={28} color={colors.onSurface} />
                        <View style={{ flex: 1 }}>
                          <T v="monoXl">{face.figure}</T>
                          {face.detail ? <T muted numberOfLines={2}>{face.detail}</T> : null}
                        </View>
                      </View>
                    )}
                    {face.lines.map((line) => (
                      <View key={line.title} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <Icon name={line.icon} size={16} color={colors.muted} />
                        <T muted numberOfLines={1} style={{ flex: 1 }}>{line.title}</T>
                      </View>
                    ))}
                  </Card>
                </View>
              );
            })}
            {loneSmall ? <View style={{ flex: 1 }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function CountPill({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name={icon} size={14} color={color} />
      <T v="caption" color={color}>{label}</T>
    </View>
  );
}

export function SwipeHome({
  preset,
  layoutFor,
  emptyCopy,
  below,
}: {
  preset: HomePresetId;
  layoutFor?: (page: HomePresetId) => HomePresentation;
  emptyCopy?: (id: string) => { title: string; line: string; route: string };
  below?: (page: HomePresetId) => React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const { sp } = useTheme();
  const { setSettings } = useStore();
  const circle = swipeScreens(preset);
  const pages = swipePages(preset);
  const pageW = Math.min(width, 720);
  const [frameH, setFrameH] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const fromSwipe = useRef(false);
  const start = swipeStartIndex(preset);

  useLayoutEffect(() => {
    if (fromSwipe.current) {
      fromSwipe.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ x: start * pageW, animated: false });
  }, [start, pageW]);

  return (
    <View style={{ flex: 1 }} onLayout={(event) => setFrameH(event.nativeEvent.layout.height)}>
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      nestedScrollEnabled
      decelerationRate="fast"
      showsHorizontalScrollIndicator={false}
      testID="today-swipe-home"
      style={{ flex: 1, width: pageW, alignSelf: "center", height: frameH || undefined }}
      contentOffset={{ x: start * pageW, y: 0 }}
      onMomentumScrollEnd={(event) => {
        const raw = Math.round(event.nativeEvent.contentOffset.x / pageW);
        const nextIndex = swipeWrap(raw, circle.length);
        if (raw >= circle.length) scrollRef.current?.scrollTo({ x: nextIndex * pageW, animated: false });
        const next = circle[nextIndex];
        if (!next || next === preset) return;
        fromSwipe.current = true;
        setSettings({ homePreset: next });
      }}
    >
      {pages.map((page, index) => (
        <View key={`${page}-${index}`} style={{ width: pageW, height: frameH || undefined }}>
          <ScrollView nestedScrollEnabled style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: sp.lg, paddingBottom: 24, gap: sp.md }}>
            {page === "adhd" ? <AdhdPanel /> : <PresetGrid preset={page} layoutFor={layoutFor} emptyCopy={emptyCopy} />}
            {below ? below(page) : null}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
    </View>
  );
}

export function AdhdPanel() {
  const { db, update } = useStore();
  const router = useRouter();
  const { colors, sp } = useTheme();
  const view = adhdView(db);
  const step = adhdOpen(db);
  const buddy = adhdBuddy(db);
  const day = reviewAdhdDay(db, []);
  const task = db.settings.adhd.tasks.find((row) => !row.parked);
  const now = Date.now();
  const clock = task
    ? adhdTimer({
        startedAt: task.timerStartedAt > 0 ? task.timerStartedAt : now,
        now,
        lastMs: db.settings.adhd.kindMs[task.kind] ?? 0,
        bufferMs: ADHD_BUFFER_MS,
      })
    : null;
  const [line, setLine] = useState("");
  const [more, setMore] = useState(false);
  const parked = db.settings.adhd.tasks.filter((row) => row.parked);
  const rest = db.settings.adhd.tasks.filter((row) => !row.parked).slice(1);
  return (
    <View style={{ gap: sp.md }} testID="today-adhd">
      <Card testID="today-adhd-next">
        <T style={{ fontSize: 28, lineHeight: 34 }}>{view.next?.line ?? "Next"}</T>
        {clock ? <T testID="today-adhd-timer" style={{ fontSize: 18, marginTop: 8 }}>{clock.label}</T> : null}
        {step ? (
          <TextInput
            testID="today-adhd-draft"
            value={step.draft || step.seed}
            onChangeText={(text) => update((current) => typeAdhdDraft(current, text))}
            placeholder={step.seed || "One line"}
            placeholderTextColor={colors.muted}
            style={{ marginTop: 12, fontSize: 20, color: colors.onSurface, minHeight: 48 }}
          />
        ) : null}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {step ? <Button label="Open" testID="today-adhd-open" onPress={() => router.push(step.route as never)} /> : null}
          {task ? <Button kind="secondary" label="Park" testID="today-adhd-park" onPress={() => update((current) => parkAdhdTask(current, task.id))} /> : null}
          {task ? <Button kind="secondary" label="Done" testID="today-adhd-done" onPress={() => update((current) => finishAdhdTask(current, task.id))} /> : null}
        </View>
      </Card>
      <TextInput
        testID="today-adhd-line"
        value={line}
        onChangeText={setLine}
        placeholder="One line"
        placeholderTextColor={colors.muted}
        style={{ fontSize: 20, color: colors.onSurface, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12 }}
      />
      <Button
        label="Start"
        testID="today-adhd-start"
        onPress={() => {
          const text = line.trim();
          if (!text) return;
          update((current) => startAdhdTask(current, text));
          setLine("");
        }}
      />
      {view.rest > 0 || parked.length ? <Button kind="secondary" label="More" testID="today-adhd-more" onPress={() => setMore(true)} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T>Motion</T>
        <Switch testID="today-adhd-motion" value={db.settings.adhd.motionOn} onValueChange={(on) => update((current) => setAdhdMotion(current, on))} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T>Buddy</T>
        <Switch testID="today-adhd-buddy" value={db.settings.adhd.buddyOn} onValueChange={(on) => update((current) => setAdhdBuddy(current, on))} />
      </View>
      {buddy.line ? <T testID="today-adhd-buddy-line">{buddy.line}</T> : null}
      {db.settings.adhd.finished.length ? (
        <View testID="today-adhd-finished">
          {db.settings.adhd.finished.map((mark, index) => (
            <T key={`${mark.line}-${index}`}>{`· ${mark.line}`}</T>
          ))}
        </View>
      ) : (
        <T testID="today-adhd-break">{day.label === "break" ? "Break" : day.label}</T>
      )}
      <Sheet visible={more} onClose={() => setMore(false)} title="More" testID="today-adhd-sheet">
        {rest.map((row) => (
          <T key={row.id} style={{ fontSize: 18, marginBottom: 8 }}>{row.line}</T>
        ))}
        {parked.map((row) => (
          <Button key={row.id} kind="secondary" label={row.line} testID={`today-adhd-recall-${row.id}`} onPress={() => update((current) => recallAdhdTask(current, row.id))} />
        ))}
      </Sheet>
    </View>
  );
}

export function HeadsUpCard() {
  const { db, update } = useStore();
  const { colors } = useTheme();
  if (db.settings.homePreset === "adhd") return null;
  const one = nextHeadsUp(db, todayISO());
  if (!one) return null;
  return (
    <Card testID="today-heads-up">
      <T style={{ color: colors.onSurface }}>{one.line}</T>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        {one.actions.map((action) => (
          <Button
            key={action}
            kind="secondary"
            label={action}
            testID={`today-heads-up-${action}`}
            onPress={() => update((current) => rememberHeadsUp(current, one.id, action === "Yes" ? "Yes" : "No"))}
          />
        ))}
        <Button kind="secondary" label="Dismiss" testID="today-heads-up-dismiss" onPress={() => update((current) => dismissHeadsUp(current, one.id))} />
      </View>
    </Card>
  );
}
