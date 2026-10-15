import React from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "@/src/core/store";
import { favoriteCards, type FavoriteCardId } from "@/src/core/favorites";
import { nativeModuleShellId } from "@/src/core/modules";
import { visibleAttention } from "@/src/core/attention";
import { monthSeries, vehicleStats } from "@/src/core/intelligence";
import { monthFlow } from "@/src/core/moneyDesk";
import { plainReminders } from "@/src/core/reminders";
import { money, monthKey, todayISO } from "@/src/core/format";
import { serviceLeftLine } from "@/src/core/vehicleMath";
import { useTheme } from "@/src/theme";
import { Header } from "@/src/components/Header";
import { Card, Eyebrow, Icon, T } from "@/src/components/ui";
import { LineChart, Ring } from "@/src/components/charts";

/**
 * The v0.9.8 landing: quick looks instead of a chip row. Off modules drop
 * their cards, privacy mode masks amounts, and the single-module shell keeps
 * only that module's cards.
 */
export default function Favorites() {
  const { db } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const single = nativeModuleShellId(db.settings);
  const cards = favoriteCards(db.settings, single);
  const has = (id: FavoriteCardId) => cards.includes(id);
  const privateMode = db.settings.privacyMode;
  const cur = db.settings.currency;
  const today = todayISO();

  const attention = has("attention") ? visibleAttention(db) : [];
  const next = has("reminder") ? plainReminders(db)[0] : undefined;
  const spent = monthFlow(db.txns, monthKey(today)).out;
  const budget = db.budget.monthly;
  const ring = budget > 0 ? spent / budget : 0;
  const series = has("spend") ? monthSeries(db, 6).map((point) => point.value) : [];
  const vehicle = db.vehicles.find((row) => row.id === db.settings.defaultVehicleId) ?? db.vehicles[0];
  const service = vehicle ? vehicleStats(db, vehicle).service : null;
  const chartW = Math.max(160, Math.min(width, 720) - sp.lg * 2 - sp.xl * 2 - 2);
  const mask = "•••";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Favourites" testID="favorites-header" back={false} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {has("attention") ? (
          <Card testID="favorites-attention" onPress={() => router.push("/(tabs)/attention")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary }}>
                <Icon name="bell-outline" size={22} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Eyebrow>Attention</Eyebrow>
                <T v="h2">{attention.length ? `${attention.length} open` : "Nothing open"}</T>
                <T muted style={{ fontSize: 12 }} numberOfLines={1}>{attention[0] ? attention[0].title : "All clear"}</T>
              </View>
            </View>
          </Card>
        ) : null}

        {has("reminder") ? (
          <Card testID="favorites-reminder" onPress={() => router.push("/reminders")}>
            <Eyebrow>Next reminder</Eyebrow>
            <T v="h2" numberOfLines={1}>{next ? next.title : "Nothing scheduled"}</T>
            <T muted style={{ fontSize: 12 }}>{next ? next.at.toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Set one and it shows here"}</T>
          </Card>
        ) : null}

        {has("budget") ? (
          <Card testID="favorites-budget" onPress={() => router.push("/money")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              {privateMode ? (
                <T v="monoLg">{mask}</T>
              ) : (
                <Ring value={ring} size={96} stroke={10} testID="favorites-budget-ring">
                  <T v="mono">{`${Math.round(ring * 100)}%`}</T>
                </Ring>
              )}
              <View style={{ flex: 1 }}>
                <Eyebrow>Budget this month</Eyebrow>
                <T v="h2">{privateMode ? mask : money(spent, cur)}</T>
                <T muted style={{ fontSize: 12 }}>{budget > 0 ? `of ${privateMode ? mask : money(budget, cur)}` : "No budget set"}</T>
              </View>
            </View>
          </Card>
        ) : null}

        {has("spend") ? (
          <Card testID="favorites-spend" onPress={() => router.push("/money")}>
            <Eyebrow>Spending · 6 months</Eyebrow>
            {privateMode ? (
              <T v="monoLg">{mask}</T>
            ) : (
              <LineChart data={series} width={chartW} height={90} testID="favorites-spend-chart" />
            )}
          </Card>
        ) : null}

        {has("service") ? (
          <Card testID="favorites-service" onPress={() => router.push(vehicle ? `/vehicles/${vehicle.id}` : "/vehicles")}>
            <Eyebrow>Service left</Eyebrow>
            <T v="h2" numberOfLines={1}>{vehicle ? vehicle.name : "No vehicle yet"}</T>
            <T muted style={{ fontSize: 12 }}>{service ? serviceLeftLine(service.remaining) : "Add a vehicle to track service"}</T>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
