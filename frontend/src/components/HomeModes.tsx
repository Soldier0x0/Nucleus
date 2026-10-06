import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LayoutAnimation, Platform, ScrollView, Switch, TextInput, UIManager, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { homeCard } from "@/src/core/homeCards";
import { homeFace, type HomeWeather } from "@/src/core/homeFace";
import { edgeScrollDelta, homeBoardCanMove, homeDropIndex, neighborShift, reorderHomeTiles, type TileBox } from "@/src/core/homeOrder";
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
  resizeHomeTile,
  reviewAdhdDay,
  setAdhdBuddy,
  setAdhdMotion,
  startAdhdTask,
  swipeScreens,
  swipeStartIndex,
  swipeWrap,
  openBoards,
  typeAdhdDraft,
  withTileSizes,
} from "@/src/core/presets";
import { dismissHeadsUp, nextHeadsUp, rememberHeadsUp } from "@/src/core/proactive";
import type { HomePresetId } from "@/src/core/types";
import { Button, Card, Eyebrow, Icon, T } from "./ui";
import { Ring } from "./charts";
import { Sheet } from "./Sheet";
import { HeadingTile } from "./HeadingTile";
import { WeatherCard } from "./WeatherCard";

const NAMED_TILES = new Set(["docgaps", "docids", "docinsurance", "doctrips", "docfiles", "billdue", "rent", "emi", "subs", "billpaid"]);

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function PresetGrid({
  preset,
  layoutFor,
  emptyCopy,
  onDragging,
  onDragY,
}: {
  preset: HomePresetId;
  layoutFor?: (page: HomePresetId) => HomePresentation;
  emptyCopy?: (id: string) => { title: string; line: string; route: string };
  onDragging?: (active: boolean) => void;
  onDragY?: (y: number) => void;
}) {
  const { db, update, session } = useStore();
  const router = useRouter();
  const { colors, sp, layout } = useTheme();
  const presented = layoutFor
    ? layoutFor(preset)
    : presentHome(layout.layout, withTileSizes(db, homePresetTiles(db, preset, session)));
  void emptyCopy;
  const [forecast, setForecast] = useState<HomeWeather | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
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
  const canMove = homeBoardCanMove(preset);
  const frames = useRef<TileBox[]>([]);
  const idsRef = useRef<string[]>([]);
  const onDraggingRef = useRef(onDragging);
  onDraggingRef.current = onDragging;
  const reduced = db.settings.reducedMotion;
  idsRef.current = presented.rows.flatMap((row) => row.items.map((item) => item.id));
  frames.current.length = idsRef.current.length;
  const remember = (index: number, box: TileBox) => {
    frames.current[index] = box;
  };
  const settle = () => {
    setDrag(null);
    onDraggingRef.current?.(false);
  };
  const point = (index: number, x: number, y: number) => {
    const to = homeDropIndex(index, { x, y }, frames.current);
    setDrag((prev) => (prev && prev.from === index && prev.to === to ? prev : { from: index, to }));
    onDragY?.(y);
  };
  const changeWidth = (id: string, shown: "large" | "small", request: "large" | "small" | "flip") => {
    let size: "large" | "small";
    switch (request) {
      case "large":
      case "small":
        size = request;
        break;
      case "flip":
        size = shown === "large" ? "small" : "large";
        break;
      default: {
        const unreachable: never = request;
        return unreachable;
      }
    }
    if (size === shown) return;
    if (!reduced) LayoutAnimation.configureNext({ duration: 280, update: { type: LayoutAnimation.Types.easeInEaseOut } });
    update((current) => resizeHomeTile(current, id, size));
  };
  const commitMove = (from: number, to: number) => {
    const id = idsRef.current[from];
    if (!id || from === to) {
      settle();
      return;
    }
    if (!reduced) {
      LayoutAnimation.configureNext({ duration: 280, update: { type: LayoutAnimation.Types.easeInEaseOut } });
    }
    update((current) => reorderHomeTiles(current, preset, id, to));
  };
  useEffect(() => () => onDraggingRef.current?.(false), []);
  let cursor = 0;
  const half = sp.md / 2;
  return (
    <View style={{ overflow: "visible" }} testID={`today-preset-${preset}-grid`}>
      {lastLabel ? (
        <Card testID={`today-preset-last-${preset}`} onPress={() => open(lastId, routeForRemembered(lastId))}>
          <T>{lastLabel}</T>
        </Card>
      ) : null}
      <View style={{ marginHorizontal: -half, marginBottom: -sp.md, marginTop: lastLabel ? sp.md : 0, overflow: "visible" }}>
      {presented.rows.map((row) => {
        const flexes = rowFlex(row);
        return (
          <View key={row.items.map((item) => item.id).join("-")} style={{ flexDirection: "row", alignItems: row.items.length > 1 ? "stretch" : "flex-start", overflow: "visible" }}>
            {row.items.map((item, itemIndex) => {
              const shown = homeCard(db, item.id, item.id === "weather" ? forecast : null);
              const face = homeFace(db, item.id, item.id === "weather" ? forecast : null);
              const title = presetTileTitle(item.id);
              const slot = cursor;
              cursor += 1;
              const full = flexes[itemIndex]?.span === 2;
              const nudge = drag ? neighborShift(slot, drag.from, drag.to) : 0;
              const marked = !!drag && drag.to === slot && drag.from !== slot;
              const cardStyle = full ? undefined : { flex: 1, justifyContent: "space-between" as const };
              const body = item.id === "weather" && city ? (
                <WeatherCard place={city} testID={`today-slot-${item.id}`} />
              ) : item.id === "heading" ? (
                <HeadingTile testID={`today-slot-${item.id}`} />
              ) : (
                <Card testID={`today-slot-${item.id}`} style={cardStyle}>
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
                    ) : NAMED_TILES.has(item.id) ? (
                      <View style={{ gap: 6, marginTop: 8 }}>
                        {shown.lines.map((line, index) => (
                          <T key={`${item.id}-${index}`}>{line}</T>
                        ))}
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
              );
              return (
                <HeldTile
                  key={item.id}
                  index={slot}
                  full={full}
                  gap={half}
                  enabled={canMove}
                  reduced={reduced}
                  frames={frames}
                  nudge={nudge}
                  marked={marked}
                  onOpen={() => open(item.id, face.route || shown.route)}
                  onMeasure={remember}
                  onCommit={commitMove}
                  onLift={() => {
                    onDraggingRef.current?.(true);
                    setDrag({ from: slot, to: slot });
                  }}
                  onDragPoint={(x, y) => point(slot, x, y)}
                  onSettle={settle}
                  onResize={(request) => changeWidth(item.id, item.size, request)}
                >
                  {body}
                </HeldTile>
              );
            })}
          </View>
        );
      })}
      </View>
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

function onLongPress() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function HeldTile({
  index,
  full,
  gap,
  enabled,
  reduced,
  frames,
  nudge,
  marked,
  onOpen,
  onMeasure,
  onCommit,
  onLift,
  onDragPoint,
  onSettle,
  onResize,
  children,
}: {
  index: number;
  full: boolean;
  gap: number;
  enabled: boolean;
  reduced: boolean;
  frames: { current: TileBox[] };
  nudge: -1 | 0 | 1;
  marked: boolean;
  onOpen: () => void;
  onMeasure: (index: number, box: TileBox) => void;
  onCommit: (from: number, to: number) => void;
  onLift: () => void;
  onDragPoint: (x: number, y: number) => void;
  onSettle: () => void;
  onResize: (request: "large" | "small" | "flip") => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const aside = useSharedValue(0);
  const scale = useSharedValue(1);
  const lifted = useSharedValue(0);
  const reducedSv = useSharedValue(reduced ? 1 : 0);
  reducedSv.value = reduced ? 1 : 0;
  const host = useRef<View>(null);
  const alive = useRef(true);
  const [hot, setHot] = useState(false);
  const api = useRef({
    lift: () => {},
    release: (_x: number, _y: number) => {},
    cancel: () => {},
    open: () => {},
    settle: () => {},
  });
  const callLift = useRef(() => api.current.lift()).current;
  const dragRef = useRef(onDragPoint);
  dragRef.current = onDragPoint;
  const callMove = useRef((x: number, y: number) => dragRef.current(x, y)).current;
  const callRelease = useRef((x: number, y: number) => api.current.release(x, y)).current;
  const callCancel = useRef(() => api.current.cancel()).current;
  const callOpen = useRef(() => api.current.open()).current;
  const callSettle = useRef(() => api.current.settle()).current;
  useEffect(() => () => {
    alive.current = false;
  }, []);
  useEffect(() => {
    const target = nudge * 18;
    aside.value = reduced ? target : withSpring(target, { damping: 16, stiffness: 180 });
  }, [aside, nudge, reduced]);
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      host.current?.measureInWindow((x, y, w, h) => {
        if (w <= 0 || h <= 0) return;
        onMeasure(index, { x, y, w, h });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [index, onMeasure]);
  api.current.lift = () => {
    setHot(true);
    onLongPress();
    onLift();
  };
  api.current.open = () => onOpen();
  api.current.cancel = () => {
    setHot(false);
    onSettle();
  };
  api.current.settle = () => {
    if (!alive.current) return;
    setHot(false);
    onSettle();
  };
  api.current.release = (x, y) => {
    const from = index;
    const to = homeDropIndex(from, { x, y }, frames.current);
    const own = frames.current[from];
    const target = frames.current[to];
    const stay = to === from || !own || !target;
    if (stay) {
      tx.value = reduced ? 0 : withSpring(0);
      ty.value = reduced ? 0 : withSpring(0);
      scale.value = reduced ? 1 : withSpring(1);
      lifted.value = 0;
      setHot(false);
      onSettle();
      return;
    }
    if (reduced) {
      tx.value = 0;
      ty.value = 0;
      scale.value = 1;
      lifted.value = 0;
      setHot(false);
      onCommit(from, to);
      onSettle();
      return;
    }
    const ease = { duration: 280, easing: Easing.inOut(Easing.ease) };
    scale.value = withSpring(1);
    ty.value = withTiming(0, ease);
    tx.value = withTiming(0, ease, (finished) => {
      "worklet";
      if (finished === false) return;
      lifted.value = 0;
      runOnJS(callSettle)();
    });
    onCommit(from, to);
  };
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value + aside.value }, { translateY: ty.value }, { scale: scale.value }],
    zIndex: lifted.value > 0 ? 20 : 0,
    elevation: lifted.value > 0 ? 12 : 0,
  }));
  const gesture = useMemo(() => {
    if (!enabled) {
      return Gesture.Tap().onEnd((_event, success) => {
        if (success) runOnJS(callOpen)();
      });
    }
    const pan = Gesture.Pan()
      .activateAfterLongPress(320)
      .onStart(() => {
        lifted.value = 1;
        scale.value = reducedSv.value ? 1.04 : withSpring(1.04);
        runOnJS(callLift)();
      })
      .onUpdate((event) => {
        tx.value = event.translationX;
        ty.value = event.translationY;
        runOnJS(callMove)(event.absoluteX, event.absoluteY);
      })
      .onEnd((event) => {
        runOnJS(callRelease)(event.absoluteX, event.absoluteY);
      })
      .onFinalize((_event, success) => {
        if (success) return;
        tx.value = reducedSv.value ? 0 : withSpring(0);
        ty.value = reducedSv.value ? 0 : withSpring(0);
        scale.value = reducedSv.value ? 1 : withSpring(1);
        lifted.value = 0;
        runOnJS(callCancel)();
      });
    const tap = Gesture.Tap().maxDuration(320).onEnd((_event, success) => {
      if (success) runOnJS(callOpen)();
    });
    return Gesture.Exclusive(pan, tap);
  }, [callCancel, callLift, callMove, callOpen, callRelease, enabled, lifted, reducedSv, scale, tx, ty]);
  return (
    <View
      ref={host}
      collapsable={false}
      style={{ flex: full ? undefined : 1, width: full ? "100%" : undefined, alignSelf: "stretch", paddingHorizontal: gap, marginBottom: gap * 2, overflow: "visible", zIndex: hot ? 4 : 0, elevation: hot ? 12 : 0 }}
      onLayout={() => {
        host.current?.measureInWindow((x, y, w, h) => {
          if (w <= 0 || h <= 0) return;
          onMeasure(index, { x, y, w, h });
        });
      }}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ flex: full ? undefined : 1, borderRadius: 16, borderWidth: marked ? 2 : 0, borderColor: colors.brandPrimary, borderStyle: "dashed" }, style]}>{children}</Animated.View>
      </GestureDetector>
      <TileWidth onResize={onResize} />
    </View>
  );
}

function TileWidth({ onResize }: { onResize: (request: "large" | "small" | "flip") => void }) {
  const { colors } = useTheme();
  const api = useRef({
    end: (_dx: number) => {},
    flip: () => {},
  });
  const callEnd = useRef((dx: number) => api.current.end(dx)).current;
  const callFlip = useRef(() => api.current.flip()).current;
  api.current.end = (dx) => {
    if (dx >= 16) onResize("large");
    else if (dx <= -16) onResize("small");
  };
  api.current.flip = () => onResize("flip");
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-12, 12])
      .failOffsetY([-18, 18])
      .onEnd((event) => {
        runOnJS(callEnd)(event.translationX);
      });
    const tap = Gesture.Tap().onEnd((_event, success) => {
      if (success) runOnJS(callFlip)();
    });
    return Gesture.Exclusive(pan, tap);
  }, [callEnd, callFlip]);
  return (
    <GestureDetector gesture={gesture}>
      <View
        testID="today-tile-resize"
        accessibilityRole="button"
        accessibilityLabel="Make this tile small or wide"
        style={{ position: "absolute", right: 0, bottom: 0, width: 44, height: 44, alignItems: "flex-end", justifyContent: "flex-end", padding: 6, zIndex: 6 }}
      >
        <Icon name="resize-bottom-right" size={16} color={colors.muted} />
      </View>
    </GestureDetector>
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
  const { db, setSettings } = useStore();
  const catalog = swipeScreens(preset);
  const openIds = openBoards(db);
  const circle = catalog.filter((id) => openIds.includes(id));
  const pages = circle[0] ? [...circle, circle[0]] : catalog;
  const pageW = Math.min(width, 720);
  const [frameH, setFrameH] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const pageRefs = useRef<Array<ScrollView | null>>([]);
  const pageOffset = useRef<number[]>([]);
  const pageBox = useRef<{ y: number; h: number }[]>([]);
  const fromSwipe = useRef(false);
  const start = Math.max(0, circle.indexOf(catalog[swipeStartIndex(preset)] ?? preset));
  const followFinger = (index: number, y: number) => {
    const box = pageBox.current[index];
    if (!box) return;
    const delta = edgeScrollDelta(y, box.y, box.h);
    if (!delta) return;
    const next = Math.max(0, (pageOffset.current[index] ?? 0) + delta);
    pageOffset.current[index] = next;
    pageRefs.current[index]?.scrollTo({ y: next, animated: false });
  };
  const lockScroll = (locked: boolean) => {
    scrollRef.current?.setNativeProps({ scrollEnabled: !locked });
    for (const row of pageRefs.current) row?.setNativeProps({ scrollEnabled: !locked });
  };

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
          <ScrollView
            ref={(node) => { pageRefs.current[index] = node; }}
            nestedScrollEnabled
            scrollEventThrottle={16}
            onScroll={(event) => { pageOffset.current[index] = event.nativeEvent.contentOffset.y; }}
            onLayout={(event) => {
              const height = event.nativeEvent.layout.height;
              event.currentTarget.measureInWindow((_x: number, y: number, _w: number, h: number) => {
                if (h > 0) pageBox.current[index] = { y, h };
                else if (height > 0) pageBox.current[index] = { y: 0, h: height };
              });
            }}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: sp.lg, paddingBottom: 24, gap: sp.md, overflow: "visible" }}
          >
            {page === "adhd" ? <AdhdPanel /> : <PresetGrid preset={page} layoutFor={layoutFor} emptyCopy={emptyCopy} onDragging={lockScroll} onDragY={(y) => followFinger(index, y)} />}
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
