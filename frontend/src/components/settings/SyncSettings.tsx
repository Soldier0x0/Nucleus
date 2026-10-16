import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import type { PairedDevice } from "@/src/core/types";
import { syncStatusLine } from "@/src/core/syncStatus";
import { applySyncResponse, buildSyncRequest, buildVaultUpload, desktopAddress, forgetDesktop, SyncError, syncErrorMessage } from "@/src/core/syncClient";
import { postSyncJson } from "@/src/core/syncTransport";
import { Button, Icon, IconButton, T } from "@/src/components/ui";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { useToast } from "@/src/components/Toast";
import { Row, Section, SettingsScreen, settingsStyles, useSettingsAnchor } from "./parts";

/** Data and backup: one desktop at a time is enough, but the list is just a list. */
function lastSyncLine(device: PairedDevice, now: string): string {
  if (!device.lastSyncAt) return "Not synced yet";
  return syncStatusLine(device.lastSyncAt, now).replace(/^Synced/, "Last synced");
}

/** Desktop sync: pair a computer, then swap changes over the local Wi-Fi. */
export function SyncSettings() {
  const { db, update, applySync } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const anchor = useSettingsAnchor();
  const [busy, setBusy] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, string>>({});
  const [forget, setForget] = useState<PairedDevice | null>(null);
  const devices = db.settings.pairedDevices ?? [];
  const now = new Date().toISOString();

  function note(id: string, message: string) {
    setLines((rows) => ({ ...rows, [id]: message }));
  }

  async function syncNow(device: PairedDevice) {
    if (busy) return;
    const address = desktopAddress(db, device.id);
    if (!address) {
      note(device.id, "Address unknown. Pair this desktop again.");
      toast("Address unknown. Pair this desktop again.", "alert-circle-outline");
      return;
    }
    setBusy(device.id);
    note(device.id, "Syncing…");
    try {
      const first = await postSyncJson(address.host, address.port, "/sync", buildSyncRequest(db, device));
      const round = applySyncResponse(db, device, first.body);
      let merged = round.db;
      if (round.needFromPhone.length) {
        note(device.id, "Sending files…");
        const follow = await postSyncJson(address.host, address.port, "/sync", buildVaultUpload(merged, device, round.needFromPhone));
        merged = applySyncResponse(merged, device, follow.body).db;
      }
      applySync(() => merged);
      const line = `${round.summary.in} in, ${round.summary.out} out`;
      note(device.id, line);
      toast(line, "sync");
    } catch (err) {
      const message = syncErrorMessage(err instanceof SyncError ? err.code : "unreachable");
      note(device.id, message);
      toast(message, "alert-circle-outline");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SettingsScreen title="Desktop sync" testID="settings-sync" anchor={anchor}>
      <Section title="How it works" anchor="how">
        <View style={{ padding: 12 }}>
          <T muted style={{ fontSize: 12 }} testID="settings-sync-note">
            Nucleus on your phone and Nucleus on your computer swap records directly over your own Wi-Fi while both apps are open and unlocked. Nothing goes to the internet.
          </T>
        </View>
        <Row
          icon="qrcode-scan"
          label="Pair a desktop"
          sub="Scan the code shown on your computer, or type its address"
          testID="settings-sync-pair"
          onPress={() => router.push("/settings/pair")}
          right={<Icon name="chevron-right" size={18} color={colors.muted} />}
        />
      </Section>

      <Section title="Paired desktops" anchor="paired" testID="settings-sync-desktops">
        {devices.length === 0 ? (
          <View style={{ padding: 12 }}>
            <T muted style={{ fontSize: 12 }} testID="settings-sync-empty">
              No desktops paired yet. Pair the computer that runs Nucleus and this list will keep it.
            </T>
          </View>
        ) : (
          devices.map((device, i) => {
            const address = desktopAddress(db, device.id);
            return (
              <View key={device.id} style={[settingsStyles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                <Icon name="monitor" size={20} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <T v="label">{device.name}</T>
                  <T muted style={{ fontSize: 12 }} testID={`settings-sync-status-${device.id}`}>
                    {lines[device.id] ?? lastSyncLine(device, now)}
                  </T>
                  <T muted style={{ fontSize: 12 }}>{address ? `${address.host}:${address.port}` : "Address unknown — pair again"}</T>
                </View>
                <Button small label={busy === device.id ? "Syncing…" : "Sync now"} icon="sync" disabled={busy !== null} testID={`settings-sync-now-${device.id}`} onPress={() => syncNow(device)} />
                <IconButton icon="link-off" label="Forget this desktop" testID={`settings-sync-forget-${device.id}`} onPress={() => setForget(device)} />
              </View>
            );
          })
        )}
      </Section>

      <ConfirmSheet
        visible={!!forget}
        id="settings-sync-forget"
        title="Forget this desktop?"
        body="This phone drops the shared key and the saved address for this computer. Your records stay on both sides. To sync again, pair from scratch."
        confirmLabel="Forget"
        icon="link-off"
        onCancel={() => setForget(null)}
        onConfirm={() => {
          if (forget) {
            update((d) => forgetDesktop(d, forget.id));
            toast("Desktop forgotten", "link-off");
          }
          setForget(null);
        }}
      />
    </SettingsScreen>
  );
}
