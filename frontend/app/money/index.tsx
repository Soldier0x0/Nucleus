import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { Insight, moneyInsights, monthSeries, monthTotals } from "@/src/core/intelligence";
import { addMonths, daysBetween, fmtDate, monthKey, monthLabel, num, todayISO } from "@/src/core/format";
import type { Subscription } from "@/src/core/types";
import { Header } from "@/src/components/Header";
import { Amount, Button, Card, Chip, ChipRow, EmptyState, Eyebrow, Icon, IconButton, Press, Segmented, T } from "@/src/components/ui";
import { Bar, MonthBars, Ring } from "@/src/components/charts";
import { BudgetSheet, SubscriptionSheet, TxnSheet } from "@/src/components/MoneyForms";
import { MoneyExport } from "@/src/components/MoneyExport";
import { itemTotals } from "@/src/core/moneyWords";
import { ReceiptSheet } from "@/src/components/ReceiptSheet";
import { subscribeReceipt, takeReceiptText } from "@/src/core/receiptBus";
import { WhySheet } from "@/src/components/WhySheet";
import { ModuleGate } from "@/src/components/ModuleGate";
import { MoneyDesk } from "@/src/components/MoneyDesk";
import { monthFlow } from "@/src/core/moneyDesk";
import { useRealSession } from "@/src/components/useRealSession";
import { Field } from "@/src/components/inputs";
import { adhdOpen, typeAdhdDraft } from "@/src/core/presets";

type Tab = "overview" | "transactions" | "subscriptions";

export default function Money() {
  const real = useRealSession();
  const params = useLocalSearchParams<{ tab?: Tab; focus?: string; field?: string; seed?: string; sheet?: string }>();
  const { db } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>(params.tab ?? "overview");
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [sheet, setSheet] = useState<null | "txn" | "budget" | "sub">(params.sheet === "budget" ? "budget" : null);
  const [editSub, setEditSub] = useState<Subscription | undefined>();
  const [why, setWhy] = useState<Insight | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [filter, setFilter] = useState<string>("All");
  const mt = monthTotals(db, month);
  const flow = monthFlow(db.txns, month);
  const b = db.budget.monthly;
  const pct = b > 0 ? flow.out / b : 0;
  const chartW = Math.min(width, 720) - sp.lg * 2 - 34;
  const insights = moneyInsights(db);
  const maxCat = Math.max(1, ...mt.categories.map(([, v]) => v), ...Object.values(db.budget.categories));

  useEffect(() => {
    if (params.sheet === "budget") setSheet("budget");
  }, [params.sheet]);
  useEffect(() => {
    const waiting = takeReceiptText();
    if (waiting) setReceipt(waiting);
    return subscribeReceipt(setReceipt);
  }, []);
  const txnList = [...db.txns].filter((t) => filter === "All" || t.category === filter).sort((a, b2) => b2.date.localeCompare(a.date));
  const usedCats = ["All", ...Array.from(new Set(db.txns.map((t) => t.category)))];
  const subs = [...db.subscriptions].sort((a, b2) => Number(b2.active) - Number(a.active) || a.nextRenewal.localeCompare(b2.nextRenewal));
  const annual = subs.filter((x) => x.active).reduce((acc, x) => acc + (x.cycle === "weekly" ? x.amount * 52 : x.cycle === "monthly" ? x.amount * 12 : x.cycle === "quarterly" ? x.amount * 4 : x.amount), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Money" testID="money-header" right={<View style={{ flexDirection: "row" }}><IconButton icon="download-outline" testID="money-export-button" label="Export spending" onPress={() => setExportOpen(true)} /><IconButton icon="text-box-outline" testID="money-receipt-button" label="Receipt text" onPress={() => setReceipt("")} /><IconButton icon="chart-timeline-variant" testID="money-plan-button" label="Plan" onPress={() => router.push("/money/plan")} /><IconButton icon="target" testID="money-budget-button" label="Budget" onPress={() => setSheet("budget")} /></View>} />
      <View style={{ paddingHorizontal: sp.lg, paddingVertical: 10, backgroundColor: colors.surface }}>
        <Segmented testID="money-tabs" value={tab} onChange={setTab} options={[{ value: "overview", label: "Overview" }, { value: "transactions", label: "Activity" }, { value: "subscriptions", label: "Subs" }]} />
      </View>
      {tab === "transactions" ? <ChipRow testID="money-filter-row">{usedCats.map((c) => <Chip key={c} label={c} selected={filter === c} onPress={() => setFilter(c)} testID={`money-filter-${c}`} />)}</ChipRow> : null}

      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingTop: 4, paddingBottom: insets.bottom + 96, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <FocusNote focus={typeof params.focus === "string" ? params.focus : ""} field={typeof params.field === "string" ? params.field : ""} seed={typeof params.seed === "string" ? params.seed : ""} />
        {tab === "overview" && (
          <>
            <MonthSwipe month={month} width={Math.max(1, Math.min(width, 720) - sp.lg * 2)} onMonth={setMonth} />
            <Card testID="money-budget-card">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <Ring value={pct} size={140} stroke={14} testID="money-budget-ring">
                  <T v="monoXl" testID="money-budget-pct">{b > 0 ? `${num(pct * 100, 0)}%` : "—"}</T>
                  <T muted style={{ fontSize: 11 }}>{b > 0 ? "of budget" : "no budget"}</T>
                </Ring>
                <View style={{ flex: 1, gap: 8 }}>
                  <View>
                    <Eyebrow>Spent</Eyebrow>
                    <Amount value={flow.out} v="monoLg" testID="money-spent" />
                  </View>
                  <View>
                    <Eyebrow>Income</Eyebrow>
                    <Amount value={flow.in} v="mono" color={colors.success} />
                  </View>
                  <View>
                    <Eyebrow>{b > 0 ? "Left" : "Net"}</Eyebrow>
                    <Amount value={b > 0 ? b - flow.out : flow.in - flow.out} v="mono" />
                  </View>
                </View>
              </View>
              {b === 0 ? <Button style={{ marginTop: 12 }} small kind="ghost" icon="target" label="Set a monthly budget" onPress={() => setSheet("budget")} testID="money-set-budget-button" /> : null}
            </Card>

            {real ? <MoneyDesk month={month} /> : null}
            <Card testID="money-categories-card">
              <Eyebrow style={{ marginBottom: 10 }}>By category</Eyebrow>
              {mt.categories.length === 0 ? (
                <T muted>No expenses this month.</T>
              ) : (
                mt.categories.map(([c, v]) => {
                  const lim = db.budget.categories[c];
                  return (
                    <View key={c} style={{ marginBottom: 12 }} testID={`money-category-${c}`}>
                      <View style={{ flexDirection: "row", marginBottom: 6, alignItems: "center" }}>
                        <T v="label" style={{ flex: 1 }}>{c}</T>
                        {lim && v > lim ? <Icon name="alert-circle-outline" size={14} color={colors.error} /> : null}
                        <Amount value={v} style={{ marginLeft: 4 }} />
                        {lim ? <T muted v="mono" style={{ fontSize: 12 }}> / {num(lim, 0)}</T> : null}
                      </View>
                      <Bar value={v} max={maxCat} limit={lim} />
                      {itemTotals(mt.txns, c).map(([item, amount]) => (
                        <View key={item} style={{ flexDirection: "row", marginLeft: 8, marginTop: 4 }} testID={`money-item-${c}-${item}`}>
                          <T muted style={{ flex: 1 }}>{item}</T>
                          <Amount value={amount} />
                        </View>
                      ))}
                    </View>
                  );
                })
              )}
            </Card>

            <Card testID="money-trend-card">
              <Eyebrow style={{ marginBottom: 10 }}>Spending · last 6 months</Eyebrow>
              <MonthBars data={monthSeries(db, 6)} width={chartW} />
            </Card>

            <View testID="money-insights">
              <Eyebrow style={{ marginBottom: 8 }}>Insights · {insights.length}</Eyebrow>
              {insights.length === 0 ? (
                <Card>
                  <T muted>Insights appear once a category has 3+ months of history. Nucleus compares months — nothing leaves your device.</T>
                </Card>
              ) : (
                insights.map((ins) => (
                  <Press key={ins.key} testID={`insight-${ins.key}`} onPress={() => setWhy(ins)} style={[styles.insight, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <View style={[styles.ic, { backgroundColor: colors.brandTertiary }]}>
                      <Icon name={ins.icon} size={20} color={colors.onBrandTertiary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="label">{ins.title}</T>
                      <T muted style={{ fontSize: 12 }}>{ins.kind === "anomaly" ? "Unusual vs. your history" : "Steady pattern"} · tap for why</T>
                    </View>
                    <Icon name="help-circle-outline" size={20} color={colors.muted} />
                  </Press>
                ))
              )}
            </View>
          </>
        )}

        {tab === "transactions" &&
          (txnList.length === 0 ? (
            <EmptyState testID="money-txn-empty" icon="swap-vertical" title="No activity yet" body="Add an expense or income, or log fuel in Vehicles — it lands here automatically." />
          ) : (
            <View style={[styles.list, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} testID="money-txn-list">
              {txnList.slice(0, 200).map((t, i) => (
                <Press key={t.id} testID={`txn-row-${i}`} onPress={() => router.push(`/record/txn/${t.id}`)} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                  <Icon name={t.type === "income" ? "arrow-down-bold-circle-outline" : "arrow-up-bold-circle-outline"} size={20} color={t.type === "income" ? colors.success : colors.muted} />
                  <View style={{ flex: 1 }}>
                    <T v="label" numberOfLines={1}>{t.item || t.note || t.category}</T>
                    <T muted style={{ fontSize: 12 }}>{[t.category, t.item && t.note ? t.note : "", fmtDate(t.date), db.links.some((l) => l.to.kind === "txn" && l.to.id === t.id) ? "linked" : ""].filter(Boolean).join(" · ")}</T>
                  </View>
                  <Amount value={t.type === "income" ? t.amount : -t.amount} color={t.type === "income" ? colors.success : undefined} />
                </Press>
              ))}
            </View>
          ))}

        {tab === "subscriptions" && (
          <>
            <Card tone="tint" testID="money-subs-summary">
              <Eyebrow style={{ color: colors.onBrandTertiary }}>Recurring · per year</Eyebrow>
              <Amount value={annual} v="monoXl" color={colors.onBrandTertiary} />
              <T color={colors.onBrandTertiary} style={{ fontSize: 12 }}>{subs.filter((x) => x.active).length} active · ≈ {num(annual / 12, 0)} per month</T>
            </Card>
            {subs.length === 0 ? (
              <EmptyState icon="autorenew" title="No subscriptions" body="Track renewals so Nucleus can warn you before they charge." />
            ) : (
              subs.map((x) => {
                const d = daysBetween(todayISO(), x.nextRenewal);
                return (
                  <Press key={x.id} testID={`subscription-row-${x.id}`} onPress={() => (setEditSub(x), setSheet("sub"))} style={[styles.sub, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: x.active ? 1 : 0.55 }]}>
                    <View style={[styles.daybox, { backgroundColor: d <= 3 && x.active ? colors.surfaceInverse : colors.surfaceTertiary }]}>
                      <T v="monoLg" color={d <= 3 && x.active ? colors.onSurfaceInverse : colors.onSurface}>{d < 0 ? "!" : d}</T>
                      <T style={{ fontSize: 9 }} color={d <= 3 && x.active ? colors.onSurfaceInverse : colors.muted}>{d < 0 ? "OVERDUE" : "DAYS"}</T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="label">{x.name}{x.active ? "" : " · paused"}</T>
                      <T muted style={{ fontSize: 12 }}>{x.cycle} · renews {fmtDate(x.nextRenewal)}</T>
                    </View>
                    <Amount value={x.amount} />
                  </Press>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 12, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {tab === "subscriptions" ? (
          <Button label="Add subscription" icon="plus" style={{ flex: 1 }} onPress={() => (setEditSub(undefined), setSheet("sub"))} testID="money-add-subscription-button" />
        ) : (
          <Button label="Add expense / income" icon="plus" style={{ flex: 1 }} onPress={() => setSheet("txn")} testID="money-add-txn-button" />
        )}
      </View>

      {sheet === "txn" ? <TxnSheet visible onClose={() => setSheet(null)} /> : null}
      {sheet === "budget" ? <BudgetSheet visible onClose={() => setSheet(null)} /> : null}
      {sheet === "sub" ? <SubscriptionSheet visible onClose={() => setSheet(null)} sub={editSub} /> : null}
      {receipt != null ? <ReceiptSheet text={receipt} onClose={() => setReceipt(null)} /> : null}
      {exportOpen ? <MoneyExport visible onClose={() => setExportOpen(false)} /> : null}
      <WhySheet visible={!!why} onClose={() => setWhy(null)} title={why?.title ?? ""} why={why?.why} />
      <ModuleGate id="money" name="Money" icon="wallet-outline" />
    </View>
  );
}

function shiftMonth(month: string, dir: -1 | 1): string {
  const next = monthKey(addMonths(`${month}-01`, dir));
  if (next > monthKey(todayISO())) return month;
  return next;
}

function MonthSwipe({ month, width, onMonth }: { month: string; width: number; onMonth: (month: string) => void }) {
  const ref = useRef<ScrollView>(null);
  useLayoutEffect(() => {
    ref.current?.scrollTo({ x: width, animated: false });
  }, [month, width]);
  const panes = [-1, 0, 1] as const;
  return (
    <ScrollView
      ref={ref}
      horizontal
      pagingEnabled
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      contentOffset={{ x: width, y: 0 }}
      onMomentumScrollEnd={(event) => {
        const page = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
        if (page === 0) onMonth(shiftMonth(month, -1));
        if (page === 2) onMonth(shiftMonth(month, 1));
      }}
    >
      {panes.map((pane) => {
        const key = pane === 0 ? month : shiftMonth(month, pane);
        return (
          <View key={pane} style={{ width, flexDirection: "row", alignItems: "center" }}>
            {pane === 0 ? (
              <>
                <IconButton icon="chevron-left" testID="money-prev-month" label="Previous month" onPress={() => onMonth(shiftMonth(month, -1))} />
                <T v="h2" style={{ flex: 1, textAlign: "center" }} testID="money-month-label">{monthLabel(month)} {month.slice(0, 4)}</T>
                <IconButton icon="chevron-right" testID="money-next-month" label="Next month" onPress={() => onMonth(shiftMonth(month, 1))} />
              </>
            ) : (
              <T v="h2" style={{ flex: 1, textAlign: "center" }}>{monthLabel(key)} {key.slice(0, 4)}</T>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function FocusNote({ focus, field, seed }: { focus: string; field: string; seed: string }) {
  const { db, update } = useStore();
  const txn = db.txns.find((row) => row.id === focus);
  const step = adhdOpen(db);
  const [text, setText] = useState(step?.recordId === focus && step.draft ? step.draft : txn?.note || seed);
  if (!txn || field !== "note") return null;
  return (
    <Card testID="money-focus-note-card">
      <Field
        label="Note"
        testID="money-focus-note"
        value={text}
        autoFocus
        onChangeText={(value) => {
          setText(value);
          update((current) => {
            const open = adhdOpen(current);
            if (!open || open.recordId !== txn.id) return current;
            return typeAdhdDraft(current, value);
          });
        }}
      />
      <Button
        label="Save"
        testID="money-focus-save"
        onPress={() => update((current) => ({ ...current, txns: current.txns.map((row) => (row.id === txn.id ? { ...row, note: text.trim() || undefined } : row)) }))}
      />
    </Card>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  insight: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: radius.lg, padding: 12, marginBottom: 8 },
  ic: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  list: { borderWidth: 1, borderRadius: radius.lg },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, minHeight: 58 },
  sub: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: radius.lg, padding: 12 },
  daybox: { width: 52, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  actions: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
}));
