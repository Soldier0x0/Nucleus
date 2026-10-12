import React, { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import type { Debt, Fund, NetWorthSnapshot } from "@/src/core/types";
import { addSnapshot, debtPayoff, fundProgress, monthEndProjection, netWorthOf, netWorthSeries, upsertDebt, upsertFund } from "@/src/core/plan";
import { fmtDate, money, num, parseNum, todayISO, uid } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Amount, Button, Card, EmptyState, Eyebrow, Icon, IconButton, Press, Segmented, T } from "@/src/components/ui";
import { Bar, LineChart, Ring } from "@/src/components/charts";
import { Sheet } from "@/src/components/Sheet";
import { DateField, Field } from "@/src/components/inputs";
import { WhySheet } from "@/src/components/WhySheet";
import { useToast } from "@/src/components/Toast";

type Tab = "projection" | "funds" | "debts" | "worth";

export default function MoneyPlan() {
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const chartW = Math.min(width, 720) - sp.lg * 2 - 34;
  const [tab, setTab] = useState<Tab>("projection");
  const [why, setWhy] = useState(false);
  const [fund, setFund] = useState<Fund | null>(null);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [snap, setSnap] = useState<NetWorthSnapshot | null>(null);
  const [addTo, setAddTo] = useState<Fund | null>(null);
  const [amount, setAmount] = useState("");
  const cur = db.settings.currency;
  const proj = monthEndProjection(db);
  const series = netWorthSeries(db);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Plan" testID="plan-header" />
      <View style={{ paddingHorizontal: sp.lg, paddingBottom: 8 }}>
        <Segmented
          testID="plan-tabs"
          value={tab}
          onChange={setTab}
          options={[
            { value: "projection", label: "Month" },
            { value: "funds", label: "Jars" },
            { value: "debts", label: "Debts" },
            { value: "worth", label: "Net worth" },
          ]}
        />
      </View>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: sp.lg, paddingTop: 4, paddingBottom: insets.bottom + 24, gap: sp.md, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {tab === "projection" ? (
          <Card testID="plan-projection-card">
            <Eyebrow>Where this month is heading</Eyebrow>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 }}>
              <Ring value={proj.budget > 0 && proj.reliable ? proj.projected / proj.budget : proj.elapsed} size={96} stroke={10}>
                <T v="mono" style={{ fontSize: 13 }}>{num(proj.elapsed * 100, 0)}%</T>
              </Ring>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Amount value={proj.reliable ? proj.projected : proj.spent} v="monoXl" testID="plan-projected" />
                <T muted>{proj.reliable ? "projected by month end" : "spent so far"}</T>
                {proj.reliable ? (
                  <>
                    <Amount value={proj.spent} v="mono" style={{ marginTop: 6, color: colors.muted }} testID="plan-spent" />
                    <T muted style={{ fontSize: 12 }}>spent so far</T>
                  </>
                ) : (
                  <T muted style={{ fontSize: 12, marginTop: 6 }} testID="plan-too-early">Too early to project — come back after the 7th.</T>
                )}
              </View>
            </View>
            {proj.budget > 0 ? (
              <View style={{ marginTop: 14 }}>
                {proj.reliable ? (
                  <T v="caption" style={{ marginBottom: 6, color: proj.over > 0 ? colors.warning : colors.success }}>
                    {proj.over > 0 ? `About ${money(proj.over, cur)} over budget at this pace` : `About ${money(-proj.over, cur)} to spare at this pace`}
                  </T>
                ) : (
                  <T v="caption" muted style={{ marginBottom: 6 }}>{money(proj.spent, cur)} of {money(proj.budget, cur)} used</T>
                )}
                <Bar value={proj.reliable ? proj.projected : proj.spent} max={Math.max(proj.budget, proj.reliable ? proj.projected : proj.spent)} limit={proj.budget} height={12} />
              </View>
            ) : (
              <T muted style={{ marginTop: 12 }}>Set a monthly budget in Money to compare the projection against it.</T>
            )}
            <Press testID="plan-projection-why" onPress={() => setWhy(true)} style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 14 }}>
              <Icon name="help-circle-outline" size={18} color={colors.muted} />
              <T muted v="label">Why this number?</T>
            </Press>
          </Card>
        ) : null}

        {tab === "funds" ? (
          <>
            {db.funds.length === 0 ? (
              <EmptyState testID="plan-funds-empty" icon="cube-outline" title="No jars yet" body="A jar is money you set aside for one thing — a new phone, insurance, a trip. Nucleus works out what to put in each month." action={<Button label="Add a jar" icon="plus" testID="plan-fund-add-empty" onPress={() => setFund(blankFund())} />} />
            ) : (
              <Button label="Add a jar" icon="plus" testID="plan-fund-add" onPress={() => setFund(blankFund())} />
            )}
            {db.funds.map((f) => {
              const p = fundProgress(f);
              return (
                <Card key={f.id} testID={`fund-card-${f.id}`}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <Ring value={p.pct} size={72} stroke={8}>
                      <T v="mono" style={{ fontSize: 12 }}>{num(p.pct * 100, 0)}%</T>
                    </Ring>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="h2" numberOfLines={1}>{f.name}</T>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "baseline" }}>
                        <Amount value={p.saved} v="mono" />
                        <T muted style={{ fontSize: 12 }}>of {num(f.target, 0)}</T>
                      </View>
                      <T muted style={{ fontSize: 12 }} numberOfLines={1}>
                        {f.targetDate ? (p.days! < 0 ? `Target date passed · ${fmtDate(f.targetDate)}` : p.perMonth ? `Put aside ~${num(p.perMonth, 0)} ${cur} a month for ${p.days} days` : "Fully funded") : "No target date"}
                      </T>
                    </View>
                    <IconButton icon="pencil-outline" label="Edit jar" testID={`fund-edit-${f.id}`} onPress={() => setFund(f)} />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <Button small label="Add money" icon="plus" testID={`fund-contribute-${f.id}`} onPress={() => (setAmount(""), setAddTo(f))} />
                    {f.contributions.length ? <T muted style={{ fontSize: 12, alignSelf: "center" }}>{f.contributions.length} contribution{f.contributions.length === 1 ? "" : "s"} · last {fmtDate(f.contributions[f.contributions.length - 1].date)}</T> : null}
                  </View>
                </Card>
              );
            })}
          </>
        ) : null}

        {tab === "debts" ? (
          <>
            {db.debts.length === 0 ? (
              <EmptyState testID="plan-debts-empty" icon="hand-coins-outline" title="No debts tracked" body="Add a loan or card balance to see how long it takes to clear and what the interest costs." action={<Button label="Add a debt" icon="plus" testID="plan-debt-add-empty" onPress={() => setDebt(blankDebt())} />} />
            ) : (
              <Button label="Add a debt" icon="plus" testID="plan-debt-add" onPress={() => setDebt(blankDebt())} />
            )}
            {db.debts.map((d) => {
              const p = debtPayoff(d);
              return (
                <Card key={d.id} testID={`debt-card-${d.id}`}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="h2" numberOfLines={1}>{d.name}</T>
                      <T muted style={{ fontSize: 12 }}>{num(d.ratePct, 2)}% p.a.{d.emi ? ` · paying ${num(d.emi, 0)} ${cur} a month` : " · no payment set"}</T>
                    </View>
                    <Amount value={d.balance} v="monoLg" testID={`debt-balance-${d.id}`} />
                    <IconButton icon="pencil-outline" label="Edit debt" testID={`debt-edit-${d.id}`} onPress={() => setDebt(d)} />
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <T v="caption" muted style={{ marginBottom: 6 }}>{num(p.pct * 100, 0)}% paid off</T>
                    <Bar value={d.principal - d.balance} max={Math.max(d.principal, 1)} height={12} />
                  </View>
                  <T muted style={{ fontSize: 12, marginTop: 10 }}>
                    {!isFinite(p.months) ? "At this payment the balance never clears — the interest is larger than the payment." : isNaN(p.months) ? "Set a monthly payment to see the payoff date." : `Clear in ${num(p.months, 0)} months · about ${num(p.interest, 0)} ${cur} interest from here`}
                  </T>
                </Card>
              );
            })}
          </>
        ) : null}

        {tab === "worth" ? (
          <>
            <Button label="Add a snapshot" icon="plus" testID="plan-snapshot-add" onPress={() => setSnap({ id: uid(), date: todayISO(), assets: 0, liabilities: 0 })} />
            {series.length >= 2 ? (
              <Card testID="plan-worth-chart">
                <Eyebrow>Net worth · {series.length} snapshots</Eyebrow>
                <View style={{ marginTop: 10 }}>
                  <LineChart data={series.map((s) => s.value)} width={chartW} height={120} testID="worth-line" showAvg />
                </View>
                <View style={{ flexDirection: "row", marginTop: 8 }}>
                  <T muted style={{ flex: 1, fontSize: 12 }}>{fmtDate(series[0].date)}</T>
                  <T muted style={{ fontSize: 12 }}>{fmtDate(series[series.length - 1].date)}</T>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 10 }}>
                  <Amount value={series[series.length - 1].value} v="monoXl" testID="worth-latest" />
                  <T muted style={{ fontSize: 12 }}>
                    {series[series.length - 1].value >= series[0].value ? "+" : ""}
                    {num(series[series.length - 1].value - series[0].value, 0)} since the first snapshot
                  </T>
                </View>
              </Card>
            ) : null}
            {db.netWorth.length === 0 ? (
              <EmptyState testID="plan-worth-empty" icon="scale-balance" title="No snapshots yet" body="Write down what you own and what you owe once a month. Two snapshots are enough to see a trend." />
            ) : null}
            {[...db.netWorth].sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
              <Press key={s.id} testID={`snapshot-row-${s.id}`} onPress={() => setSnap(s)} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, backgroundColor: colors.surfaceSecondary }}>
                <Icon name="scale-balance" size={20} color={colors.muted} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="label">{fmtDate(s.date)}</T>
                  <T muted style={{ fontSize: 12 }}>assets {num(s.assets, 0)} · owes {num(s.liabilities, 0)}</T>
                </View>
                <Amount value={netWorthOf(s)} v="mono" />
              </Press>
            ))}
          </>
        ) : null}
      </KeyboardAwareScrollView>

      <WhySheet visible={why} onClose={() => setWhy(false)} title="Month-end projection" why={proj.why} />

      {fund ? <FundSheet fund={fund} onClose={() => setFund(null)} /> : null}
      {debt ? <DebtSheet debt={debt} onClose={() => setDebt(null)} /> : null}
      {snap ? <SnapshotSheet snap={snap} onClose={() => setSnap(null)} /> : null}

      <Sheet visible={!!addTo} onClose={() => setAddTo(null)} title={`Add to ${addTo?.name ?? ""}`} testID="fund-contribute-sheet" footer={<Button label="Add money" icon="check" testID="fund-contribute-save" onPress={() => {
        const v = parseNum(amount);
        if (!addTo || !(v > 0)) return;
        update((d) => upsertFund(d, { ...addTo, contributions: [...addTo.contributions, { id: uid(), amount: v, date: todayISO() }] }));
        setAddTo(null);
        toast("Added to the jar", "cube-outline");
      }} />}>
        <Field numeric label="Amount" unit={cur} testID="fund-contribute-input" value={amount} onChangeText={setAmount} placeholder="0" hint="Jars track money you've set aside; they don't create an expense." />
      </Sheet>
    </View>
  );
}

const blankFund = (): Fund => ({ id: uid(), name: "", target: 0, contributions: [], createdAt: new Date().toISOString() });
const blankDebt = (): Debt => ({ id: uid(), name: "", principal: 0, balance: 0, ratePct: 0, createdAt: new Date().toISOString() });

function FundSheet({ fund, onClose }: { fund: Fund; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [name, setName] = useState(fund.name);
  const [target, setTarget] = useState(fund.target ? String(fund.target) : "");
  const [date, setDate] = useState(fund.targetDate);
  const exists = db.funds.some((f) => f.id === fund.id);
  const [del, setDel] = useState(false);
  return (
    <>
    <Sheet visible onClose={onClose} title={exists ? "Edit jar" : "New jar"} testID="fund-sheet" footer={<Button label="Save jar" icon="check" testID="fund-save-button" onPress={() => {
      update((d) => upsertFund(d, { ...fund, name: name.trim() || "Jar", target: parseNum(target) || 0, targetDate: date }));
      onClose();
    }} />}>
      <Field label="What is it for" testID="fund-name-input" value={name} onChangeText={setName} placeholder="New phone" />
      <Field numeric label="Target amount" unit={db.settings.currency} testID="fund-target-input" value={target} onChangeText={setTarget} placeholder="0" />
      <DateField label="Need it by (optional)" value={date} onChange={setDate} testID="fund-date" optional />
      {exists ? <Button kind="danger" small icon="delete-outline" label="Delete jar" testID="fund-delete-button" onPress={() => setDel(true)} /> : null}
    </Sheet>
      <Sheet visible={del} onClose={() => setDel(false)} title="Delete this jar?" testID="fund-delete-sheet">
        <T style={{ marginBottom: 16 }}>The {fund.contributions.length} contribution(s) you have saved to it and its progress history are removed. This cannot be undone.</T>
        <Button kind="danger" label="Delete" icon="delete-outline" testID="fund-delete-confirm" onPress={() => {
          update((d) => ({ ...d, funds: d.funds.filter((f) => f.id !== fund.id) }));
          setDel(false);
          toast("Jar deleted", "delete-outline");
          onClose();
        }} />
      </Sheet>
    </>
  );
}

function DebtSheet({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [name, setName] = useState(debt.name);
  const [principal, setPrincipal] = useState(debt.principal ? String(debt.principal) : "");
  const [balance, setBalance] = useState(debt.balance ? String(debt.balance) : "");
  const [rate, setRate] = useState(debt.ratePct ? String(debt.ratePct) : "");
  const [emi, setEmi] = useState(debt.emi ? String(debt.emi) : "");
  const exists = db.debts.some((d) => d.id === debt.id);
  const [del, setDel] = useState(false);
  return (
    <>
    <Sheet visible onClose={onClose} title={exists ? "Edit debt" : "New debt"} testID="debt-sheet" footer={<Button label="Save debt" icon="check" testID="debt-save-button" onPress={() => {
      const bal = parseNum(balance) || 0;
      update((d) => upsertDebt(d, { ...debt, name: name.trim() || "Debt", principal: parseNum(principal) || bal, balance: bal, ratePct: parseNum(rate) || 0, emi: parseNum(emi) || undefined }));
      onClose();
    }} />}>
      <Field label="Name" testID="debt-name-input" value={name} onChangeText={setName} placeholder="Car loan" />
      <Field numeric label="Original amount" unit={db.settings.currency} testID="debt-principal-input" value={principal} onChangeText={setPrincipal} />
      <Field numeric label="Balance left" unit={db.settings.currency} testID="debt-balance-input" value={balance} onChangeText={setBalance} />
      <Field numeric label="Interest" unit="% p.a." testID="debt-rate-input" value={rate} onChangeText={setRate} />
      <Field numeric label="Monthly payment" unit={db.settings.currency} testID="debt-emi-input" value={emi} onChangeText={setEmi} hint="Used to work out the payoff date" />
      {exists ? <Button kind="danger" small icon="delete-outline" label="Delete debt" testID="debt-delete-button" onPress={() => setDel(true)} /> : null}
    </Sheet>
      <Sheet visible={del} onClose={() => setDel(false)} title="Delete this debt?" testID="debt-delete-sheet">
        <T style={{ marginBottom: 16 }}>The balance and payoff date are removed, and it will no longer count against your net worth. This cannot be undone.</T>
        <Button kind="danger" label="Delete" icon="delete-outline" testID="debt-delete-confirm" onPress={() => {
          update((d) => ({ ...d, debts: d.debts.filter((x) => x.id !== debt.id) }));
          setDel(false);
          toast("Debt deleted", "delete-outline");
          onClose();
        }} />
      </Sheet>
    </>
  );
}

function SnapshotSheet({ snap, onClose }: { snap: NetWorthSnapshot; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [date, setDate] = useState(snap.date);
  const [assets, setAssets] = useState(snap.assets ? String(snap.assets) : "");
  const [liab, setLiab] = useState(snap.liabilities ? String(snap.liabilities) : "");
  const [note, setNote] = useState(snap.note ?? "");
  const exists = db.netWorth.some((s) => s.id === snap.id);
  const [del, setDel] = useState(false);
  const suggested = db.debts.reduce((s, d) => s + d.balance, 0);
  return (
    <>
    <Sheet visible onClose={onClose} title={exists ? "Edit snapshot" : "New snapshot"} testID="snapshot-sheet" footer={<Button label="Save snapshot" icon="check" testID="snapshot-save-button" onPress={() => {
      update((d) => addSnapshot(d, { ...snap, date, assets: parseNum(assets) || 0, liabilities: parseNum(liab) || 0, note: note.trim() || undefined }));
      onClose();
    }} />}>
      <DateField label="As of" value={date} onChange={(v) => setDate(v ?? todayISO())} testID="snapshot-date" />
      <Field numeric label="What you own" unit={db.settings.currency} testID="snapshot-assets-input" value={assets} onChangeText={setAssets} hint="Savings, deposits, investments, vehicles" />
      <Field numeric label="What you owe" unit={db.settings.currency} testID="snapshot-liabilities-input" value={liab} onChangeText={setLiab} hint={suggested > 0 ? `Your tracked debts add up to ${num(suggested, 0)}` : undefined} />
      <Field label="Note (optional)" testID="snapshot-note-input" value={note} onChangeText={setNote} />
      {exists ? <Button kind="danger" small icon="delete-outline" label="Delete snapshot" testID="snapshot-delete-button" onPress={() => setDel(true)} /> : null}
    </Sheet>
      <Sheet visible={del} onClose={() => setDel(false)} title="Delete this snapshot?" testID="snapshot-delete-sheet">
        <T style={{ marginBottom: 16 }}>This point in your net-worth history is removed and the trend line will skip it. This cannot be undone.</T>
        <Button kind="danger" label="Delete" icon="delete-outline" testID="snapshot-delete-confirm" onPress={() => {
          update((d) => ({ ...d, netWorth: d.netWorth.filter((s) => s.id !== snap.id) }));
          setDel(false);
          toast("Snapshot deleted", "delete-outline");
          onClose();
        }} />
      </Sheet>
    </>
  );
}
