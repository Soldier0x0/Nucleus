import React from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "@/src/core/store";
import { useSyncSignal } from "@/src/core/syncSignal";
import { decodePill } from "@/src/core/syncPill";
import { syncInFlight, syncWithDesktop } from "@/src/core/syncWithDesktop";
import { Icon, Press, T } from "@/src/components/ui";
import { radius, useTheme } from "@/src/theme";

/**
 * The sync pill beside the online chip (v0.12). Hidden until a desktop is
 * paired. Tap runs one quiet round; hold opens the Sync screen. Never a toast.
 */
export function SyncPill() {
  const { db, applySync } = useStore();
  const router = useRouter();
  const { colors } = useTheme();
  const signal = useSyncSignal();
  const devices = db.settings.pairedDevices ?? [];
  if (devices.length === 0) return null;

  const pill = decodePill({
    devices,
    lastSyncAt: db.settings.lastSyncAt,
    lastFailedAt: signal.lastFailedAt,
    now: Date.now(),
  });
  const tint = pill.state === "synced" ? colors.success : pill.state === "off-network" ? colors.warning : colors.error;
  const icon = pill.state === "synced" ? "cloud-check-outline" : pill.state === "off-network" ? "cloud-sync-outline" : "cloud-alert-outline";

  const short = () => {
    if (pill.state === "stale") return "Not synced";
    if (pill.state === "off-network") return "Off network";
    if (pill.label === "Synced") return "Synced";
    return pill.label.replace("Synced ", "").replace(" ago", "");
  };

  const syncNow = async () => {
    if (syncInFlight()) return;
    for (const device of devices) {
      try {
        const result = await syncWithDesktop(db, device, { silent: true });
        applySync(() => result.db);
        return;
      } catch {
        // Quiet by design: the pill's own state is the feedback.
      }
    }
  };

  return (
    <Press
      testID="today-sync-pill"
      accessibilityLabel={`Desktop sync: ${pill.label}. Tap to sync now, hold for sync settings.`}
      onPress={() => void syncNow()}
      onLongPress={() => router.push("/settings/sync")}
      delayLongPress={350}
      style={[styles.chip, { borderColor: signal.running ? colors.border : tint, marginRight: 8 }]}
    >
      <Icon name={signal.running ? "sync" : icon} size={14} color={signal.running ? colors.muted : tint} />
      <T v="caption" color={signal.running ? undefined : tint} muted={signal.running}>
        {signal.running ? "Syncing…" : short()}
      </T>
    </Press>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    height: 30,
  },
});
