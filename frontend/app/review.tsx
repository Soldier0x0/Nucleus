import React, { useMemo, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { monthSeries } from "@/src/core/intelligence";
import { money, num, todayISO } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Amount, Eyebrow, Icon, Segmented, T } from "@/src/components/ui";
import { MonthBars } from "@/src/components/charts";

/** Deterministic year summary: counts and sums from your own records, nothing inferred. */
function cards(db: ReturnType<typeof useStore>["db"], year: string) {
  const cur = db.settings.currency;
  const inYear = <T extends { date: string }>(a: T[]) => a.filter((x) => x.date.startsWith(year));
  const fuel = inYear(db.fuel);
  const svc = inYear(db.services);
  const txns = inYear(db.txns);
  const trips = db.trips.filter((t) => t.start.startsWith(year));
  const spent = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const byCat: Record<string, number> = {};
  txns.filter((t) => t.type === "expense").forEach((t) => (byCat[t.category] = (byCat[t.category] ?? 0) + t.amount));
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const km = (() => {
    let total = 0;
    for (const v of db.vehicles) {
      const f = fuel.filter((x) => x.vehicleId === v.id).sort((a, b) => a.odometer - b.odometer);
      if (f.length > 1) total += f[f.length - 1].odometer - f[0].odometer;
    }
    return total;
  })();
  const litres = fuel.reduce((s, f) => s + f.litres, 0);
  const fuelSpend = fuel.reduce((s, f) => s + f.total, 0);
  const done = Object.values(db.attention).filter((m) => m.status === "done").length;
  const packed = trips.reduce((s, t) => s + t.packing.filter((p) => p.done).length, 0);
  const checks = db.notes.reduce((s, n) => s + n.checklist.filter((c) => c.done).length, 0);
  return [
    { icon: "road-variant", eyebrow: "On the road", big: `${num(km, 0)} ${db.settings.distanceUnit}`, lines: [`${fuel.length} fill-ups · ${num(litres, 0)} ${db.settings.volumeUnit}`, `${money(fuelSpend, cur)} on fuel`, km > 0 && litres > 0 ? `${num(km / litres, 1)} ${db.settings.distanceUnit}/${db.settings.volumeUnit} average` : "Log two fill-ups for mileage"], amount: undefined as number | undefined },
    { icon: "wallet-outline", eyebrow: "Money", big: "", lines: [`${txns.length} entries recorded`, income > 0 ? `${money(income, cur)} came in` : "No income recorded", top ? `Biggest category: ${top[0]} (${money(top[1], cur)})` : "No expenses recorded"], amount: spent },
    { icon: "wrench-outline", eyebrow: "Looked after", big: `${svc.length + db.appliances.reduce((s, a) => s + a.plans.length, 0)}`, lines: [`${svc.length} services logged`, `${money(svc.reduce((s, x) => s + x.cost, 0), cur)} on maintenance`, `${db.appliances.length} appliances tracked`], amount: undefined },
    { icon: "bag-suitcase-outline", eyebrow: "Travelled", big: `${trips.length}`, lines: trips.length ? [trips.map((t) => t.name).slice(0, 3).join(", "), `${packed} things packed`, `${trips.reduce((s, t) => s + t.travellers, 0)} travellers in total`] : ["No trips this year", "Plan one in Travel", ""], amount: undefined },
    { icon: "check-circle-outline", eyebrow: "Kept on top of things", big: `${done + checks}`, lines: [`${done} attention items cleared`, `${checks} checklist items ticked`, `${db.rules.length} rules watching for you`], amount: undefined },
  ];
}

export default function Review() {
  const { db } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const years = useMemo(() => Array.from(new Set([todayISO().slice(0, 4), ...db.txns.map((t) => t.date.slice(0, 4)), ...db.fuel.map((f) => f.date.slice(0, 4))])).sort().reverse(), [db]);
  const [year, setYear] = useState(years[0]);
  const data = cards(db, year);
  const series = monthSeries(db, 12);
  const chartW = Math.min(width, 720) - sp.lg * 2 - 34;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Year in Review" testID="review-header" />
      {years.length > 1 ? (
        <View style={{ paddingHorizontal: sp.lg, paddingBottom: 8 }}>
          <Segmented testID="review-year" value={year} onChange={setYear} options={years.slice(0, 3).map((y) => ({ value: y, label: y }))} />
        </View>
      ) : null}
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} testID="review-pager" style={{ flexGrow: 0 }}>
        {data.map((c) => (
          <View key={c.eyebrow} style={{ width: Math.min(width, 720), padding: sp.lg }}>
            <View style={{ backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: 20, minHeight: 300, justifyContent: "space-between" }} testID={`review-card-${c.eyebrow.replace(/\s+/g, "-").toLowerCase()}`}>
              <View>
                <Icon name={c.icon} size={28} color={colors.onSurfaceInverse} />
                <Eyebrow style={{ color: colors.onSurfaceInverse, opacity: 0.7, marginTop: 14 }}>
                  {year} · {c.eyebrow}
                </Eyebrow>
                {c.amount !== undefined ? <Amount value={c.amount} v="display" color={colors.onSurfaceInverse} style={{ marginTop: 6, fontSize: 40 }} /> : null}
                {c.big ? (
                  <T v="display" color={colors.onSurfaceInverse} style={{ marginTop: 6, fontSize: 40 }}>
                    {c.big}
                  </T>
                ) : null}
              </View>
              <View style={{ gap: 8, marginTop: 20 }}>
                {c.lines.filter(Boolean).map((l) => (
                  <View key={String(l)} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Icon name="circle-small" size={18} color={colors.onSurfaceInverse} />
                    <T color={colors.onSurfaceInverse} style={{ flex: 1, opacity: 0.85 }}>
                      {l}
                    </T>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: sp.lg, paddingBottom: insets.bottom + 16 }}>
        <Eyebrow style={{ marginBottom: 8 }}>Spending, last 12 months</Eyebrow>
        <MonthBars data={series} width={chartW} height={110} testID="review-bars" />
        <T muted style={{ fontSize: 12, marginTop: 10 }}>Swipe the cards. Every number is counted from your own records — amounts respect privacy mode.</T>
      </View>
    </View>
  );
}
