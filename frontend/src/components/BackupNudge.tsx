import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useStore } from "@/src/core/store";
import { Button, T } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";

/** One reminder, after setup, because a forgotten PIN can only be recovered from a backup. */
export function BackupNudge() {
  const { db, setSettings, session } = useStore();
  const router = useRouter();
  const s = db.settings;
  const [open, setOpen] = useState(s.onboarded && !s.backupNudged && !s.lastBackupAt && session === "real");

  useEffect(() => {
    if (session === "decoy") setOpen(false);
  }, [session]);

  if (!open) return null;

  const dismiss = () => {
    setSettings({ backupNudged: true });
    setOpen(false);
  };

  return (
    <Sheet visible onClose={dismiss} title="Save a backup" testID="backup-nudge">
      <T style={{ marginBottom: 8 }}>Nucleus keeps everything on this phone. If you forget the PIN, the only way back is a backup file you already saved.</T>
      <T muted style={{ marginBottom: 16 }}>It is encrypted with a password you choose. The password is not stored here.</T>
      <Button
        label="Go to backup"
        icon="export-variant"
        testID="backup-nudge-go"
        onPress={() => {
          dismiss();
          router.push("/(tabs)/settings");
        }}
      />
      <Button kind="ghost" label="Not now" testID="backup-nudge-later" onPress={dismiss} style={{ marginTop: 8 }} />
    </Sheet>
  );
}
