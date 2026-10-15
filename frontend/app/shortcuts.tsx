import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import type { HomeShortcut } from "@/src/core/types";
import { Header } from "@/src/components/Header";
import { Card, Eyebrow, Icon, Press, T } from "@/src/components/ui";

const FIXED: HomeShortcut[] = [
  { id: "today", label: "Today", url: "nucleus://open?path=/(tabs)" },
  { id: "money", label: "Money", url: "nucleus://open?path=/money" },
  { id: "tools", label: "Tools", url: "nucleus://open?path=/tools" },
  { id: "notes", label: "Notes", url: "nucleus://open?path=/notes" },
  { id: "kanban", label: "Kanban", url: "nucleus://open?path=/kanban" },
  { id: "wiki", label: "Wiki", url: "nucleus://open?path=/wiki" },
  { id: "travel", label: "Travel", url: "nucleus://open?path=/travel" },
  { id: "vehicles", label: "Vehicles", url: "nucleus://open?path=/vehicles" },
  { id: "calendar", label: "Calendar", url: "nucleus://open?path=/calendar" },
];

export default function Shortcuts() {
  const { db, setSettings } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const chosen = db.settings.shortcuts ?? [];
  const boards: HomeShortcut[] = db.settings.boards.map((b) => ({ id: `board-${b.id}`, label: b.name.slice(0, 24), url: `nucleus://open?board=${b.id}` }));
  const rows = [...FIXED, ...boards];

  const toggle = (item: HomeShortcut) => {
    const has = chosen.some((c) => c.id === item.id);
    const next = has ? chosen.filter((c) => c.id !== item.id) : chosen.length >= 4 ? chosen : [...chosen, item];
    setSettings({ shortcuts: next });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Home screen" testID="shortcuts-header" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <Card testID="widget-note">
          <Eyebrow>Widgets</Eyebrow>
          <T style={{ marginTop: 6 }}>On the phone&apos;s home screen, add a Nucleus widget: countdown, budget, trip, maintenance, battery, cycle, log fuel, or add an expense. Log widgets open the form after unlock. Resize it. Amounts follow privacy mode. The widget fills when you open Nucleus.</T>
        </Card>
        <Eyebrow>Shortcuts · {chosen.length}/4</Eyebrow>
        <T muted style={{ fontSize: 12 }}>Long-press the Nucleus icon. These four open a tool or a board. They are part of the installed app.</T>
        {rows.map((item) => {
          const on = chosen.some((c) => c.id === item.id);
          return (
            <Press key={item.id} testID={`shortcut-${item.id}`} onPress={() => toggle(item)} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 }}>
              <Icon name={on ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={on ? colors.brandPrimary : colors.muted} />
              <T style={{ flex: 1 }} numberOfLines={1}>{item.label}</T>
            </Press>
          );
        })}
      </ScrollView>
    </View>
  );
}
