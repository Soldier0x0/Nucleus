import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStore } from "@/src/core/store";

const ALLOWED = ["/money", "/tools", "/notes", "/rules", "/builder", "/dev", "/lab", "/net", "/kanban", "/wiki", "/papers", "/calendar", "/travel", "/home", "/vehicles", "/packs", "/shortcuts", "/(tabs)"];

function safePath(path: string) {
  if (ALLOWED.some((item) => path === item || path.startsWith(`${item}/`) || path.startsWith(`${item}?`))) return path;
  return "/(tabs)";
}

/** Landing route for a widget or an icon shortcut. */
export default function OpenRoute() {
  const params = useLocalSearchParams<{ path?: string; board?: string }>();
  const router = useRouter();
  const { db, setSettings } = useStore();
  useEffect(() => {
    const board = typeof params.board === "string" ? params.board : "";
    const path = typeof params.path === "string" ? params.path : "";
    if (/^[a-z0-9]{4,32}$/i.test(board) && db.settings.boards.some((b) => b.id === board)) {
      setSettings({ activeBoardId: board });
      router.replace("/(tabs)");
      return;
    }
    router.replace(safePath(path) as "/(tabs)");
  }, [params.board, params.path, db.settings.boards, router, setSettings]);
  return null;
}
