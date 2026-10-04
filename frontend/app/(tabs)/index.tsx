import React, { useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { usesNativeTabs } from "@/src/navigation";
import { monthTotals, vehicleStats } from "@/src/core/intelligence";
import { morningLine, weekLeft } from "@/src/core/life";
import { visibleAttention } from "@/src/core/attention";
import { daysBetween, fmtDate, money, monthKey, num, relDays, todayISO } from "@/src/core/format";
import { Amount, Card, EmptyState, Eyebrow, Icon, Press, T, Button } from "@/src/components/ui";
import { Gauge, Ring } from "@/src/components/charts";
import { WeatherCard } from "@/src/components/WeatherCard";
import { CaptureBar } from "@/src/components/CaptureBar";
import { BoardSheet } from "@/src/components/BoardSheet";
import { Sheet } from "@/src/components/Sheet";
import { DragRow, moveItem, ReorderGroup } from "@/src/components/Reorderable";
import { TILE_META } from "@/src/core/modules";
import { presentHome } from "@/src/core/layouts";
import { PRESET_CHOICES, presetBoard, showsCustomizeHome, tilePlaceholder } from "@/src/core/presets";
import { AdhdPanel, HeadsUpCard, PresetGrid, SwipeHome } from "@/src/components/HomeModes";
import { ChipRow, Chip } from "@/src/components/ui";
import { useReminderSync } from "@/src/core/useReminders";
import type { Board } from "@/src/core/types";
import { homeSchedule, readiness, tripStatus } from "@/src/core/domains";
import { homeLine, oneDueToday } from "@/src/core/dueGreeting";
import { repeatingBills } from "@/src/core/moneyDesk";
import { choreDueDate } from "@/src/core/domains";

export default function Today() {
  const { db, setSettings, session } = useStore();
  const { colors, sp, a11y, layout } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const on = (id: string) => db.settings.modules.find((m) => m.id === id)?.enabled;
  const items = visibleAttention(db);
  const count = { urgent: items.filter((i) => i.severity === "urgent").length, upcoming: items.filter((i) => i.severity === "upcoming").length, info: items.filter((i) => i.severity === "info").length };
  const today = todayISO();
  const d = new Date();
  const hour = d.getHours();
  const dues = [
    ...(session === "real" && on("money") ? db.subscriptions.filter((sub) => sub.active && sub.nextRenewal === today).map((sub) => ({ title: sub.name, date: today })) : []),
    ...(session === "real" && on("money") ? repeatingBills(db.txns).filter((bill) => bill.next === today).map((bill) => ({ title: bill.name, date: today })) : []),
    ...db.chores.filter((chore) => choreDueDate(chore, today) === 0).map((chore) => ({ title: chore.name, date: today })),
  ];
  const greeting = homeLine(hour, session === "real" ? db.settings.givenName : undefined, oneDueToday(dues, today)?.title ?? null);
  const contentW = Math.min(width, 720) - sp.lg * 2;
  const boards = db.settings.boards;
  const activeBoard = boards.find((b) => b.id === db.settings.activeBoardId);
  const preset = db.settings.homePreset;
  const customPresented = presentHome(layout.layout, presetBoard(db, "custom", session));
  const anyModule = db.settings.modules.some((m) => m.enabled);
  const [boardSheet, setBoardSheet] = useState<null | { board: Board | null }>(null);
  const [arrange, setArrange] = useState(false);
  useReminderSync();

  const placeholder = (id: string, idx: number) => {
    const copy = tilePlaceholder(id);
    return (
      <Animated.View key={id} entering={a11y.reducedMotion ? undefined : FadeInDown.delay(60 * idx).duration(260)}>
        <Card testID={`today-${id}-tile`} onPress={() => router.push(copy.route as never)} onLongPress={() => setArrange(true)} style={customPresented.cardMin > 0 ? { minHeight: customPresented.cardMin } : undefined}>
          <Eyebrow>{copy.title}</Eyebrow>
          <T v="h2" style={{ marginTop: 6 }}>{copy.line}</T>
        </Card>
      </Animated.View>
    );
  };

  const renderTile = (id: string, idx: number) => {
    const delay = 60 * idx;
    if (id === "attention") {
      const needs = count.urgent + count.upcoming;
      return (
        <Animated.View key={id} entering={a11y.reducedMotion ? undefined : FadeInDown.delay(delay).duration(260)}>
          <Card testID="today-attention-tile" onPress={() => router.push("/(tabs)/attention")} onLongPress={() => setArrange(true)} tone={needs ? "inverse" : "default"}>
            <Eyebrow style={{ color: needs ? colors.onSurfaceInverse : colors.muted, opacity: 0.8 }}>Attention</Eyebrow>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 6 }}>
              <T v="display" color={needs ? colors.onSurfaceInverse : colors.onSurface} testID="today-attention-count" style={{ fontSize: 44, lineHeight: 50 }}>
                {needs}
              </T>
              <T v="h2" color={needs ? colors.onSurfaceInverse : colors.onSurface} style={{ marginBottom: 8, flex: 1 }}>
                {needs === 1 ? "thing needs attention" : needs ? "things need attention" : "All caught up"}
              </T>
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
              {(
                [
                  ["urgent", "alert-octagon", colors.error],
                  ["upcoming", "clock-alert-outline", colors.warning],
                  ["info", "information-outline", colors.info],
                ] as const
              ).map(([k, ic, c]) => (
                <View key={k} style={[styles.pill, { borderColor: needs ? colors.onSurfaceInverse + "40" : colors.border }]}>
                  <Icon name={ic} size={14} color={c} />
                  <T v="mono" color={needs ? colors.onSurfaceInverse : colors.onSurface} style={{ fontSize: 12 }}>
                    {count[k]} {k}
                  </T>
                </View>
              ))}
            </View>
            {items.slice(0, 3).map((it) => (
              <View key={it.key} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                <Icon name={it.icon} size={16} color={needs ? colors.onSurfaceInverse : colors.muted} />
                <T numberOfLines={1} color={needs ? colors.onSurfaceInverse : colors.onSurface} style={{ flex: 1, fontSize: 13 }}>
                  {it.title}
                </T>
              </View>
            ))}
          </Card>
        </Animated.View>
      );
    }
    if (id === "weather") {
      if (!db.settings.homeCity) return placeholder(id, idx);
      return (
        <Animated.View key={id} entering={a11y.reducedMotion ? undefined : FadeInDown.delay(delay).duration(260)}>
          <WeatherCard place={db.settings.homeCity} testID="today-weather-tile" />
        </Animated.View>
      );
    }
    if (id === "trip") {
      const t = [...db.trips].filter((x) => tripStatus(x) !== "past").sort((a, b) => a.start.localeCompare(b.start))[0];
      if (!t) return placeholder(id, idx);
      const r = readiness(db, t);
      return (
        <Animated.View key={id} entering={a11y.reducedMotion ? undefined : FadeInDown.delay(delay).duration(260)}>
          <Card testID="today-trip-tile" onPress={() => router.push(`/travel/${t.id}`)} onLongPress={() => setArrange(true)}>
            <Eyebrow>Next trip</Eyebrow>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 }}>
              <Ring value={r.score} size={80} stroke={8}><T v="mono" style={{ fontSize: 13 }}>{num(r.score * 100, 0)}%</T></Ring>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="h2" numberOfLines={1}>{t.name}</T>
                <T v="mono" style={{ fontSize: 13 }}>{r.daysToStart > 0 ? `starts in ${r.daysToStart} days` : "happening now"}</T>
                <T muted style={{ fontSize: 12 }} numberOfLines={1}>{r.missing.length ? `${r.missing.length} need attention · ${r.missing[0]}` : "All set"}</T>
              </View>
            </View>
          </Card>
        </Animated.View>
      );
    }
    if (id === "home") {
      const n = homeSchedule(db)[0];
      if (!n) return placeholder(id, idx);
      return (
        <Animated.View key={id} entering={a11y.reducedMotion ? undefined : FadeInDown.delay(delay).duration(260)}>
          <Card testID="today-home-tile" onPress={() => router.push("/home")} onLongPress={() => setArrange(true)}>
            <Eyebrow>Home · next maintenance</Eyebrow>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
              <View style={[styles.daybox, { backgroundColor: n.days <= 7 ? colors.brandTertiary : colors.surfaceTertiary }]}>
                <T v="monoLg" style={{ fontSize: 16 }}>{n.days < 0 ? "!" : n.days}</T>
                <T muted style={{ fontSize: 9 }}>{n.days < 0 ? "late" : "days"}</T>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="label" numberOfLines={1}>{n.p.name}</T>
                <T muted style={{ fontSize: 12 }} numberOfLines={1}>{n.a.name} · {fmtDate(n.due)}</T>
              </View>
            </View>
          </Card>
        </Animated.View>
      );
    }
    if (id === "budget") {
      const mt = monthTotals(db, monthKey(today));
      const b = db.budget.monthly;
      const pct = b > 0 ? mt.spent / b : 0;
      return (
        <Animated.View key={id} entering={a11y.reducedMotion ? undefined : FadeInDown.delay(delay).duration(260)}>
          <Card testID="today-budget-tile" onPress={() => router.push("/money")} onLongPress={() => setArrange(true)}>
            <Eyebrow>Money · this month</Eyebrow>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 }}>
              <Ring value={pct} size={96} stroke={10}>
                <T v="monoLg" testID="today-budget-pct">{b > 0 ? `${num(pct * 100, 0)}%` : "—"}</T>
              </Ring>
              <View style={{ flex: 1 }}>
                <Amount value={mt.spent} v="monoXl" testID="today-spent" />
                <T muted>{b > 0 ? "spent of budget" : "spent · no budget set"}</T>
                {b > 0 ? <Amount value={b} v="mono" style={{ marginTop: 2, color: colors.muted }} /> : null}
                {b > 0 ? (
                  <T muted style={{ fontSize: 12, marginTop: 6 }} testID="today-week-left">
                    {money(Math.max(0, weekLeft(db, today).thisWeek), db.settings.currency, { decimals: false })} left to spend this week
                  </T>
                ) : mt.categories[0] ? (
                  <T muted style={{ fontSize: 12, marginTop: 6 }}>
                    Top: {mt.categories[0][0]}
                  </T>
                ) : null}
              </View>
            </View>
          </Card>
        </Animated.View>
      );
    }
    if (id === "vehicle") {
      const v = db.vehicles.find((x) => x.id === db.settings.defaultVehicleId) ?? db.vehicles[0];
      if (!v)
        return (
          <Animated.View key={id} entering={a11y.reducedMotion ? undefined : FadeInDown.delay(delay).duration(260)}>
            <Card testID="today-vehicle-tile" onPress={() => router.push("/vehicles")} onLongPress={() => setArrange(true)}>
              <Eyebrow>Vehicles</Eyebrow>
              <T v="h2" style={{ marginTop: 6 }}>Add your first vehicle</T>
              <T muted>Track mileage, service intervals and expiry dates.</T>
            </Card>
          </Animated.View>
        );
      const st = vehicleStats(db, v);
      const ins = v.insuranceExpiry ? daysBetween(today, v.insuranceExpiry) : undefined;
      return (
        <Animated.View key={id} entering={a11y.reducedMotion ? undefined : FadeInDown.delay(delay).duration(260)}>
          <Card testID="today-vehicle-tile" onPress={() => router.push(`/vehicles/${v.id}`)} onLongPress={() => setArrange(true)}>
            <Eyebrow>{v.name} · since service</Eyebrow>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Gauge value={st.service.since} max={st.service.interval} size={150} label={`${num(st.service.since, 0)}`} />
              <View style={{ flex: 1, gap: 6 }}>
                <T v="mono" testID="today-vehicle-remaining">
                  {st.service.remaining > 0 ? `${num(st.service.remaining, 0)} km left` : `${num(-st.service.remaining, 0)} km over`}
                </T>
                <T muted style={{ fontSize: 12 }}>of ~{num(st.service.interval, 0)} km {st.service.fromHistory ? "(learned)" : "(set)"}</T>
                <T v="mono" style={{ fontSize: 13 }}>{isFinite(st.avgMileage) ? `${num(st.avgMileage, 1)} km/L avg` : "Log 2 fills for mileage"}</T>
                {ins !== undefined ? (
                  <T muted style={{ fontSize: 12 }}>
                    Insurance {ins < 0 ? "expired" : relDays(ins)}
                  </T>
                ) : null}
              </View>
            </View>
          </Card>
        </Animated.View>
      );
    }
    if (id === "subscriptions") {
      const subs = db.subscriptions.filter((s) => s.active).sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal)).slice(0, 3);
      if (!subs.length) return placeholder(id, idx);
      return (
        <Animated.View key={id} entering={a11y.reducedMotion ? undefined : FadeInDown.delay(delay).duration(260)}>
          <Card testID="today-subscriptions-tile" onPress={() => router.push("/money?tab=subscriptions")} onLongPress={() => setArrange(true)}>
            <Eyebrow>Next renewals</Eyebrow>
            {subs.map((s) => {
              const dd = daysBetween(today, s.nextRenewal);
              return (
                <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <View style={[styles.daybox, { backgroundColor: dd <= 3 ? colors.brandTertiary : colors.surfaceTertiary }]}>
                    <T v="monoLg" style={{ fontSize: 16 }}>{dd < 0 ? "!" : dd}</T>
                    <T muted style={{ fontSize: 9 }}>{dd < 0 ? "due" : "days"}</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="label">{s.name}</T>
                    <T muted style={{ fontSize: 12 }}>{fmtDate(s.nextRenewal)}</T>
                  </View>
                  <Amount value={s.amount} />
                </View>
              );
            })}
          </Card>
        </Animated.View>
      );
    }
    if (id === "notes") {
      const pinned = db.notes.filter((n) => n.pinned).slice(0, 3);
      if (!pinned.length) return placeholder(id, idx);
      return (
        <Animated.View key={id} entering={a11y.reducedMotion ? undefined : FadeInDown.delay(delay).duration(260)}>
          <Card testID="today-notes-tile" onPress={() => router.push("/notes")} onLongPress={() => setArrange(true)}>
            <Eyebrow>Pinned notes</Eyebrow>
            {pinned.map((n) => {
              const done = n.checklist.filter((c) => c.done).length;
              return (
                <View key={n.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <Icon name="note-text-outline" size={18} color={colors.muted} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="label" numberOfLines={1}>{n.title || "Untitled"}</T>
                    <T muted style={{ fontSize: 12 }} numberOfLines={1}>{n.checklist.length ? `${done}/${n.checklist.length} done` : n.body || "Note"}</T>
                  </View>
                </View>
              );
            })}
          </Card>
        </Animated.View>
      );
    }
    if (id === "tools") {
      const tools = [
        ["units", "swap-horizontal", "Units"],
        ["percent", "percent-outline", "GST %"],
        ["split", "account-group-outline", "Split"],
        ["emi", "bank-outline", "EMI"],
      ];
      return (
        <Animated.View key={id} entering={a11y.reducedMotion ? undefined : FadeInDown.delay(delay).duration(260)}>
          <Card testID="today-tools-tile" onLongPress={() => setArrange(true)}>
            <Eyebrow>Tools</Eyebrow>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              {tools.map(([tid, ic, l]) => (
                <Press key={tid} testID={`today-tool-${tid}`} onPress={() => router.push(`/tools?tool=${tid}`)} style={[styles.toolBtn, { backgroundColor: colors.surfaceTertiary }]}>
                  <Icon name={ic} size={22} />
                  <T v="caption" style={{ marginTop: 4 }}>{l}</T>
                </Press>
              ))}
            </View>
          </Card>
        </Animated.View>
      );
    }
    return placeholder(id, idx);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: sp.lg, paddingBottom: 10, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Eyebrow>{d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" })}</Eyebrow>
            <T v="title" testID="today-title">{greeting}</T>
            <Press testID="today-morning" onPress={() => router.push("/calendar")}>
              <T muted style={{ fontSize: 13, marginTop: 2 }} numberOfLines={2}>{morningLine(db, today)}</T>
            </Press>
          </View>
          <Press testID="today-online-toggle" accessibilityState={{ checked: db.settings.online }} onPress={() => setSettings({ online: !db.settings.online })} style={[styles.lockChip, { borderColor: db.settings.online ? colors.success : colors.border }]}>
            <Icon name={db.settings.online ? "web" : "wifi-off"} size={14} color={db.settings.online ? colors.success : colors.muted} />
            <T v="caption" muted={!db.settings.online} color={db.settings.online ? colors.success : undefined}>{db.settings.online ? "Online" : "Offline"}</T>
          </Press>
        </View>
        <Press testID="today-search-bar" onPress={() => router.push("/search")} style={[styles.search, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong }]}>
          <Icon name="magnify" size={20} color={colors.muted} />
          <T muted style={{ flex: 1 }} numberOfLines={1}>Search everything — vehicles, trips, spends</T>
        </Press>
        <CaptureBar />
      </View>
      <View style={{ marginHorizontal: -4 }}>
          <ChipRow testID="today-preset-row">
            {PRESET_CHOICES.map((choice) => (
              <Chip key={choice.id} label={choice.name} icon={choice.icon} selected={preset === choice.id} testID={`today-preset-${choice.id}`} onPress={() => setSettings({ homePreset: choice.id })} />
            ))}
          </ChipRow>
          {preset === "custom" ? <ChipRow testID="today-board-row">
            <Chip label="Home" icon="view-dashboard-outline" selected={!activeBoard} testID="today-board-default" onPress={() => setSettings({ activeBoardId: undefined })} />
            {boards.map((b) => (
              <Chip key={b.id} label={b.name} icon={b.icon} selected={activeBoard?.id === b.id} testID={`today-board-${b.id}`} onPress={() => setSettings({ activeBoardId: b.id })} />
            ))}
            {activeBoard ? <Chip label="Edit" icon="pencil-outline" testID="today-board-edit" onPress={() => setBoardSheet({ board: activeBoard })} /> : null}
            <Chip label="New board" icon="plus" testID="today-board-new" onPress={() => setBoardSheet({ board: null })} />
        </ChipRow> : null}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: sp.lg, paddingBottom: bottomChrome + 24, gap: sp.md, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {!anyModule ? (
          <EmptyState testID="today-empty" icon="view-grid-plus-outline" title="Your workbench is empty" body="Turn on a module to start adding tiles here." action={<Button label="Open module library" icon="view-grid-outline" onPress={() => router.push("/(tabs)/modules")} testID="today-open-modules-button" />} />
        ) : preset === "adhd" ? (
          <AdhdPanel />
        ) : preset === "money" || preset === "travel" ? (
          <SwipeHome preset={preset} />
        ) : preset === "custom" ? (
          customPresented.rows.map((row, index) => (
            <View key={`${row.items.map((item) => item.id).join("-")}-${index}`} style={{ flexDirection: "row", gap: sp.md }}>
              {row.items.map((item) => (
                <View key={item.id} style={{ flex: 1 }}>{renderTile(item.id, index)}</View>
              ))}
            </View>
          ))
        ) : (
          <PresetGrid preset={preset} />
        )}
        {preset === "adhd" ? null : <HeadsUpCard />}
        {showsCustomizeHome(preset) ? (
          <>
            <Press testID="today-customize-button" onPress={() => router.push("/(tabs)/modules")} onLongPress={() => setArrange(true)} style={[styles.customize, { borderColor: colors.borderStrong, width: contentW > 0 ? undefined : undefined }]}>
              <Icon name="tune-variant" size={18} color={colors.muted} />
              <T muted v="label">Customize home</T>
            </Press>
            <T muted style={{ fontSize: 12, textAlign: "center" }}>Hold a tile to rearrange it.</T>
          </>
        ) : null}
      </ScrollView>
      <Sheet visible={arrange} onClose={() => setArrange(false)} title={activeBoard ? `Arrange ${activeBoard.name}` : "Arrange home"} testID="today-arrange">
        <T muted style={{ marginBottom: 10 }}>Hold a row, then drag. This order is saved on this device.</T>
        <ReorderGroup rowHeight={52} orderKey={(activeBoard ? activeBoard.tiles : db.settings.tiles.map((t) => t.id)).join("\n")}>
        {(activeBoard ? activeBoard.tiles.map((id) => ({ id })) : db.settings.tiles).map((t, i, arr) => (
          <DragRow
            key={t.id}
            index={i}
            count={arr.length}
            rowHeight={52}
            onMove={(from, to) => {
              if (activeBoard) {
                const tiles = moveItem(activeBoard.tiles, from, to);
                setSettings({ boards: boards.map((b) => (b.id === activeBoard.id ? { ...b, tiles } : b)) });
              } else setSettings({ tiles: moveItem(db.settings.tiles, from, to) });
            }}
          >
            <View style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Icon name="drag-vertical" size={20} color={colors.muted} />
              <T v="label" style={{ flex: 1 }} numberOfLines={1}>{TILE_META[t.id]?.name ?? t.id}</T>
            </View>
          </DragRow>
        ))}
        </ReorderGroup>
      </Sheet>
      {boardSheet ? <BoardSheet board={boardSheet.board} onClose={() => setBoardSheet(null)} /> : null}
    </View>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, marginTop: 12 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, height: 26 },
  daybox: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  toolBtn: { flex: 1, height: 68, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  lockChip: { flexDirection: "row", gap: 4, alignItems: "center", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, height: 30 },
  customize: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", height: 48, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed" },
}));
