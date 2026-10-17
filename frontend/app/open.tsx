import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStore } from "@/src/core/store";
import { useLockSignal } from "@/src/core/lockSignal";
import { parseWidgetAction, type WidgetAction } from "@/src/core/widgets";
import { FuelSheet, ServiceSheet } from "@/src/components/VehicleForms";
import { TxnSheet } from "@/src/components/MoneyForms";

const ALLOWED = ["/money", "/tools", "/notes", "/rules", "/builder", "/dev", "/lab", "/net", "/kanban", "/papers", "/calendar", "/travel", "/home", "/vehicles", "/packs", "/shortcuts", "/attention", "/(tabs)"];

const ACTION_FALLBACK: Record<WidgetAction, string> = { fuel: "/vehicles", expense: "/money", service: "/vehicles" };

function safePath(path: string) {
  if (ALLOWED.some((item) => path === item || path.startsWith(`${item}/`) || path.startsWith(`${item}?`))) return path;
  return "/(tabs)";
}

/** Landing route for a widget or an icon shortcut. Action widgets wait for unlock, then open the log sheet. */
export default function OpenRoute() {
  const params = useLocalSearchParams<{ path?: string; board?: string; action?: string }>();
  const router = useRouter();
  const gate = useLockSignal();
  const { db, setSettings } = useStore();
  const action = parseWidgetAction(params.action);
  const vehicle = db.vehicles.find((row) => row.id === db.settings.defaultVehicleId) ?? db.vehicles[0];
  const needsVehicle = action === "fuel" || action === "service";
  const blocked = action != null && (db.settings.readOnly || (needsVehicle && !vehicle));

  useEffect(() => {
    if (action) {
      if (gate !== "unlocked" || !blocked) return;
      router.replace(ACTION_FALLBACK[action] as "/(tabs)");
      return;
    }
    const board = typeof params.board === "string" ? params.board : "";
    const path = typeof params.path === "string" ? params.path : "";
    if (/^[a-z0-9]{4,32}$/i.test(board) && db.settings.boards.some((b) => b.id === board)) {
      setSettings({ activeBoardId: board });
      router.replace("/(tabs)");
      return;
    }
    router.replace(safePath(path) as "/(tabs)");
  }, [action, blocked, gate, params.board, params.path, db.settings.boards, router, setSettings]);

  if (!action || gate !== "unlocked" || blocked) return null;
  const close = () => router.replace(ACTION_FALLBACK[action] as "/(tabs)");
  if (action === "expense") return <TxnSheet visible onClose={close} />;
  if (!vehicle) return null;
  if (action === "fuel") return <FuelSheet visible onClose={close} vehicle={vehicle} />;
  return <ServiceSheet visible onClose={close} vehicle={vehicle} />;
}
