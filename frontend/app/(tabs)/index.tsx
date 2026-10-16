import React, { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { presentHome } from "@/src/core/layouts";
import { fonts, radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { usesNativeTabs } from "@/src/navigation";
import { morningLine } from "@/src/core/life";
import { todayISO } from "@/src/core/format";
import { EmptyState, Eyebrow, Icon, Press, T, Button } from "@/src/components/ui";
import { CaptureBar } from "@/src/components/CaptureBar";
import { AppMenu } from "@/src/components/AppMenu";
import { useToast } from "@/src/components/Toast";
import { BoardSheet } from "@/src/components/BoardSheet";
import { Sheet } from "@/src/components/Sheet";
import { DragRow, moveItem, ReorderGroup } from "@/src/components/Reorderable";
import { nativeModuleShellId, TILE_META } from "@/src/core/modules";
import VehiclesHome from "@/app/vehicles/index";
import MoneyHome from "@/app/money/index";
import TravelHome from "@/app/travel/index";
import HomeHome from "@/app/home/index";
import ToolsHome from "@/app/tools/index";
import RulesHome from "@/app/rules/index";
import NotesHome from "@/app/notes/index";
import DevHome from "@/app/dev/index";
import BuilderHome from "@/app/builder/index";
import MediaHome from "@/app/media/index";
import LabHome from "@/app/lab/index";
import PapersHome from "@/app/papers/index";
import KanbanHome from "@/app/kanban/index";
import WikiHome from "@/app/wiki/index";
import NetHome from "@/app/net/index";
import CycleHome from "@/app/cycle/index";
import HealthHome from "@/app/health/index";
import { presetBoard, presetTileTitle, showsCustomizeHome, tilePlaceholder, widenLongLabels, withTileSizes } from "@/src/core/presets";
import { HeadsUpCard, SwipeHome } from "@/src/components/HomeModes";
import { ChipRow, Chip } from "@/src/components/ui";
import { useReminderSync } from "@/src/core/useReminders";
import type { Board, HomePresetId, ModuleId } from "@/src/core/types";
import { homeLine, oneDueToday } from "@/src/core/dueGreeting";
import { syncStatusLine } from "@/src/core/syncStatus";
import { repeatingBills } from "@/src/core/moneyDesk";
import { choreDueDate } from "@/src/core/domains";

const MODULE_HOME: Record<ModuleId, React.ComponentType> = {
  vehicles: VehiclesHome,
  money: MoneyHome,
  travel: TravelHome,
  home: HomeHome,
  tools: ToolsHome,
  rules: RulesHome,
  notes: NotesHome,
  dev: DevHome,
  builder: BuilderHome,
  media: MediaHome,
  lab: LabHome,
  papers: PapersHome,
  kanban: KanbanHome,
  wiki: WikiHome,
  net: NetHome,
  cycle: CycleHome,
  health: HealthHome,
};

/**
 * The Today tab. With exactly one module on it is that module's home
 * (v0.9.8 shell); otherwise it is the Today board.
 */
export default function Today() {
  const { db } = useStore();
  const shell = nativeModuleShellId(db.settings);
  if (shell) {
    const Home = MODULE_HOME[shell];
    return <Home />;
  }
  return <TodayBoard />;
}

function TodayBoard() {
  const { db, setSettings, session } = useStore();
  const { colors, sp, layout } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const on = (id: string) => db.settings.modules.find((m) => m.id === id)?.enabled;
  const today = todayISO();
  const d = new Date();
  const hour = d.getHours();
  const dues = [
    ...(session === "real" && on("money") ? db.subscriptions.filter((sub) => sub.active && sub.nextRenewal === today).map((sub) => ({ title: sub.name, date: today })) : []),
    ...(session === "real" && on("money") ? repeatingBills(db.txns).filter((bill) => bill.next === today).map((bill) => ({ title: bill.name, date: today })) : []),
    ...db.chores.filter((chore) => choreDueDate(chore, today) === 0).map((chore) => ({ title: chore.name, date: today })),
  ];
  const greeting = homeLine(hour, session === "real" ? db.settings.givenName : undefined, oneDueToday(dues, today)?.title ?? null);
  const boards = db.settings.boards;
  const activeBoard = boards.find((b) => b.id === db.settings.activeBoardId);
  const preset: HomePresetId = "custom";
  const boardIndex = activeBoard ? boards.findIndex((board) => board.id === activeBoard.id) + 1 : 0;
  const anyModule = db.settings.modules.some((m) => m.enabled);
  const [boardSheet, setBoardSheet] = useState<null | { board: Board | null }>(null);
  const [arrange, setArrange] = useState(false);
  const [finder, setFinder] = useState(false);
  const [finderText, setFinderText] = useState("");
  const [menu, setMenu] = useState(false);
  const dated = morningLine(db, today);
  const toast = useToast();
  useReminderSync(() => toast("Notifications are off for Nucleus, so reminders will not ring. Turn them on in Android settings.", "bell-off-outline"));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: sp.lg, paddingBottom: 10, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Press testID="today-menu-button" accessibilityLabel="Open menu" onPress={() => setMenu(true)} style={styles.menuBtn}>
            <Icon name="menu" size={24} color={colors.onSurface} />
          </Press>
          <View style={{ flex: 1 }}>
            <Eyebrow>{d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" })}</Eyebrow>
            <T v="title" testID="today-title">{greeting}</T>
            {dated ? (
              <Press testID="today-morning" onPress={() => router.push("/calendar")}>
                <T muted style={{ fontSize: 13, marginTop: 2 }} numberOfLines={2}>{dated}</T>
              </Press>
            ) : null}
            <T muted testID="today-sync-status" style={{ fontSize: 12, marginTop: 2 }}>{syncStatusLine(db.settings.lastSyncAt, new Date().toISOString())}</T>
          </View>
          <Press testID="today-online-toggle" accessibilityState={{ checked: db.settings.online }} onPress={() => setSettings({ online: !db.settings.online })} style={[styles.lockChip, { borderColor: db.settings.online ? colors.success : colors.border }]}>
            <Icon name={db.settings.online ? "web" : "wifi-off"} size={14} color={db.settings.online ? colors.success : colors.muted} />
            <T v="caption" muted={!db.settings.online} color={db.settings.online ? colors.success : undefined}>{db.settings.online ? "Online" : "Offline"}</T>
          </Press>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 }}>
          <View style={{ flex: 1, maxWidth: finder ? undefined : "25%" }}>
            {finder ? (
              <View style={[styles.search, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong }]}>
                <Icon name="magnify" size={18} color={colors.muted} />
                <TextInput
                  testID="today-search-bar"
                  autoFocus
                  value={finderText}
                  onChangeText={setFinderText}
                  onBlur={() => setFinder(false)}
                  onSubmitEditing={() => {
                    const q = finderText.trim();
                    setFinder(false);
                    router.push(q ? { pathname: "/search", params: { q } } : "/search");
                  }}
                  placeholder="Search"
                  placeholderTextColor={colors.muted}
                  returnKeyType="search"
                  style={{ flex: 1, height: 46, color: colors.onSurface, fontFamily: fonts.text, fontSize: 15 }}
                />
              </View>
            ) : (
              <Press testID="today-search-bar" onPress={() => setFinder(true)} accessibilityLabel="Search" style={[styles.search, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong, justifyContent: "center" }]}>
                <Icon name="magnify" size={20} color={colors.muted} />
              </Press>
            )}
          </View>
          <View style={{ flex: finder ? 0 : 3, width: finder ? 0 : undefined, overflow: "hidden" }} pointerEvents={finder ? "none" : "auto"}>
            <CaptureBar />
          </View>
        </View>
      </View>
      <View style={{ marginHorizontal: -4 }}>
        <ChipRow testID="today-board-row" activeIndex={boardIndex}>
          <Chip label="Home" icon="view-dashboard-outline" selected={!activeBoard} testID="today-board-default" onPress={() => setSettings({ activeBoardId: undefined })} />
          {boards.map((b) => (
            <Chip key={b.id} label={b.name} icon={b.icon} selected={activeBoard?.id === b.id} testID={`today-board-${b.id}`} onPress={() => setSettings({ activeBoardId: b.id })} />
          ))}
          {activeBoard ? <Chip label="Edit" icon="pencil-outline" testID="today-board-edit" onPress={() => setBoardSheet({ board: activeBoard })} /> : null}
          <Chip label="New board" icon="plus" testID="today-board-new" onPress={() => setBoardSheet({ board: null })} />
        </ChipRow>
      </View>
      {!anyModule ? (
        <View style={{ paddingHorizontal: sp.lg, paddingBottom: bottomChrome + 24 }}>
          <EmptyState testID="today-empty" icon="view-grid-plus-outline" title="Your workbench is empty" body="Turn on a module to start adding tiles here." action={<Button label="Open module library" icon="view-grid-outline" onPress={() => router.push("/modules")} testID="today-open-modules-button" />} />
        </View>
      ) : (
        <SwipeHome
          preset={preset}
          layoutFor={(page) => presentHome(layout.layout, widenLongLabels(withTileSizes(db, presetBoard(db, page, session)), presetTileTitle))}
          emptyCopy={(id) => tilePlaceholder(id)}
          below={(page) => (
            <>
              <HeadsUpCard />
              {showsCustomizeHome(page) || (page === preset && showsCustomizeHome(preset)) ? (
                <>
                  <Press testID="today-customize-button" onPress={() => router.push("/modules")} onLongPress={() => setArrange(true)} style={[styles.customize, { borderColor: colors.borderStrong }]}>
                    <Icon name="tune-variant" size={18} color={colors.muted} />
                    <T muted v="label">Customize home</T>
                  </Press>
                  <T muted style={{ fontSize: 12, textAlign: "center" }}>Hold a tile to rearrange it.</T>
                  <T muted style={{ fontSize: 12, textAlign: "center" }}>Drag a corner to make a tile small or wide.</T>
                </>
              ) : null}
              <View style={{ height: bottomChrome }} />
            </>
          )}
        />
      )}
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
      <AppMenu visible={menu} onClose={() => setMenu(false)} />
    </View>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 8, height: 46, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 14 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, height: 26 },
  daybox: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  toolBtn: { flex: 1, height: 68, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  menuBtn: { width: 44, height: 44, marginLeft: -10, marginRight: 4, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  lockChip: { flexDirection: "row", gap: 4, alignItems: "center", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, height: 30 },
  customize: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", height: 48, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed" },
}));
