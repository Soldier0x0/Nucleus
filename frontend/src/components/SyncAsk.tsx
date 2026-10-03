import { useState } from "react";
import { useRouter } from "expo-router";
import { useStore } from "@/src/core/store";
import { askUnsynced } from "@/src/core/vaultFile";
import { Button, T } from "./ui";
import { Sheet } from "./Sheet";

/** One ask when the locked file has not synced since the last unlock. */
export function SyncAsk() {
  const { db, setSettings, session } = useStore();
  const router = useRouter();
  const cloud = db.settings.cloud;
  const due = session === "real" && askUnsynced({ provider: cloud.provider, lastSyncAt: cloud.lastSyncAt ?? null, unlockedAt: cloud.unlockedAt ?? "", asked: cloud.askedSinceUnlock });
  const [closed, setClosed] = useState(false);
  if (!due || closed) return null;
  const dismiss = () => {
    setSettings({ cloud: { ...cloud, askedSinceUnlock: true } });
    setClosed(true);
  };
  return (
    <Sheet visible onClose={dismiss} title="The backup has not synced" testID="sync-ask">
      <T style={{ marginBottom: 16 }}>The locked file on this phone is newer than the last upload. This asks once.</T>
      <Button label="Open backup settings" testID="sync-ask-go" onPress={() => { dismiss(); router.push("/(tabs)/settings"); }} />
      <Button kind="ghost" label="Not now" testID="sync-ask-later" onPress={dismiss} style={{ marginTop: 8 }} />
    </Sheet>
  );
}
