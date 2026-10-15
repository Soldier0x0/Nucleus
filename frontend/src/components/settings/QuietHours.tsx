import { Switch, View } from "react-native";
import { useStore } from "@/src/core/store";
import { useTheme } from "@/src/theme";
import { Icon, Segmented, T } from "@/src/components/ui";

/**
 * The quiet-hours control. Shared by Rules and Settings → Notifications so the
 * window lives in one place. `idPrefix` keeps each screen's testIDs distinct.
 */
export function QuietHours({ idPrefix }: { idPrefix: string }) {
  const { db, setSettings } = useStore();
  const { colors } = useTheme();
  const quiet = db.settings.quietHours;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Icon name="weather-night" size={20} color={colors.muted} />
        <View style={{ flex: 1 }}>
          <T v="label">Quiet hours</T>
          <T muted style={{ fontSize: 12 }}>
            {quiet.enabled ? `No reminders between ${String(quiet.from).padStart(2, "0")}:00 and ${String(quiet.to).padStart(2, "0")}:00 — they move to the morning.` : "Reminders can arrive at any hour."}
          </T>
        </View>
        <Switch
          testID={`${idPrefix}-quiet-switch`}
          value={quiet.enabled}
          onValueChange={(v) => setSettings({ quietHours: { ...quiet, enabled: v } })}
          trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
          thumbColor={colors.surfaceSecondary}
        />
      </View>
      {quiet.enabled ? (
        <Segmented
          testID={`${idPrefix}-quiet-window`}
          value={`${quiet.from}-${quiet.to}`}
          onChange={(v) => {
            const [from, to] = v.split("-").map(Number);
            setSettings({ quietHours: { enabled: true, from, to } });
          }}
          options={[
            { value: "21-7", label: "21 – 07" },
            { value: "22-7", label: "22 – 07" },
            { value: "23-8", label: "23 – 08" },
          ]}
        />
      ) : null}
    </View>
  );
}
