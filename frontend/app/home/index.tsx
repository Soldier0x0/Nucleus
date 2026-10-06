import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { homeSchedule, logMaintenance, ROOMS, upsertAppliance } from "@/src/core/domains";
import { applianceIcon, applianceOwnership, dueDayLabel } from "@/src/core/life";
import { HomeLife } from "@/src/components/HomeLife";
import { deleteEntity } from "@/src/core/actions";
import type { Appliance } from "@/src/core/types";
import { addMonths, daysBetween, fmtDate, money, num, parseNum, todayISO, uid } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Button, Card, Chip, ChipRow, Eyebrow, Icon, IconButton, Segmented, StatusBadge, T } from "@/src/components/ui";
import { Countdown } from "@/src/components/charts";
import { Sheet } from "@/src/components/Sheet";
import { DateField, Field } from "@/src/components/inputs";
import { useToast } from "@/src/components/Toast";
import { ModuleGate } from "@/src/components/ModuleGate";

export default function Home() {
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [edit, setEdit] = useState<Appliance | "new" | null>(null);
  const [logFor, setLogFor] = useState<{ a: string; p: string; name: string } | null>(null);
  const [cost, setCost] = useState("");
  const [room, setRoom] = useState("All");
  const sched = homeSchedule(db);
  const next90 = sched.filter((x) => x.days <= 90);
  const next = sched[0];
  const list = db.appliances.filter((a) => room === "All" || a.room === room);
  const today = todayISO();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Home" testID="home-header" right={<IconButton icon="plus" testID="home-add-button" label="Add appliance" onPress={() => setEdit("new")} />} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {db.appliances.length === 0 ? (
          <HomeLife showEmpty={db.utilities.length === 0 && db.chores.length === 0} onAddAppliance={() => setEdit("new")} />
        ) : (
          <>
            <Card tone={next && next.days <= 7 ? "inverse" : "default"} testID="home-hero">
              <Eyebrow style={{ color: next && next.days <= 7 ? colors.onSurfaceInverse : colors.muted }}>Next maintenance</Eyebrow>
              {next ? (
                <>
                  <T v="display" color={next.days <= 7 ? colors.onSurfaceInverse : colors.onSurface} testID="home-next-days">{next.days < 0 ? dueDayLabel(next.days) : `${next.days} days`}</T>
                  <T color={next.days <= 7 ? colors.onSurfaceInverse : colors.onSurface} numberOfLines={1}>{next.a.name} · {next.p.name}</T>
                </>
              ) : <T muted>No maintenance plans yet.</T>}
            </Card>

            {next90.length ? (
              <Card testID="home-timeline">
                <Eyebrow style={{ marginBottom: 10 }}>Next 90 days</Eyebrow>
                <View style={{ height: 30, borderRadius: 6, backgroundColor: colors.surfaceTertiary, marginBottom: 10 }}>
                  {next90.map((x) => (
                    <View key={x.p.id} style={{ position: "absolute", left: `${Math.max(0, Math.min(97, (x.days / 90) * 100))}%`, top: 4, width: 8, height: 22, borderRadius: 2, backgroundColor: x.days < 0 ? colors.error : x.days <= 7 ? colors.warning : colors.brandPrimary }} />
                  ))}
                </View>
                {next90.map((x) => (
                  <View key={x.p.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 }}>
                    <StatusBadge severity={x.days < 0 ? "urgent" : x.days <= 7 ? "upcoming" : "ok"} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="label" numberOfLines={1}>{x.p.name}</T>
                      <T muted style={{ fontSize: 12 }} numberOfLines={1}>{x.a.name} · {fmtDate(x.due)}</T>
                    </View>
                    <Button small kind="secondary" label="Done" icon="check" testID={`maint-done-${x.p.id}`} onPress={() => (setCost(x.p.cost ? String(x.p.cost) : ""), setLogFor({ a: x.a.id, p: x.p.id, name: x.p.name }))} />
                  </View>
                ))}
              </Card>
            ) : null}

            <HomeLife showEmpty={false} />

            <ChipRow testID="home-room-row">
              {["All", ...ROOMS.filter((r) => db.appliances.some((a) => a.room === r))].map((r) => <Chip key={r} label={r} selected={room === r} onPress={() => setRoom(r)} testID={`home-room-${r}`} />)}
            </ChipRow>

            {list.map((a) => {
              const w = a.warrantyUntil ? daysBetween(today, a.warrantyUntil) : undefined;
              return (
                <Card key={a.id} testID={`appliance-card-${a.id}`} onPress={() => setEdit(a)}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={[styles.ic, { backgroundColor: colors.surfaceTertiary }]}><Icon name={applianceIcon(a.name)} size={22} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="h2" numberOfLines={1}>{a.name}</T>
                      <T muted style={{ fontSize: 12 }} numberOfLines={1}>{[a.room, a.brand, a.model].filter(Boolean).join(" · ")}</T>
                    </View>
                    {w !== undefined ? <StatusBadge severity={w < 0 ? "info" : w <= 30 ? "upcoming" : "ok"} /> : null}
                  </View>
                  {w !== undefined ? (
                    <View style={{ marginTop: 10 }}>
                      <T v="caption" muted style={{ marginBottom: 4 }}>{w < 0 ? `Warranty ended ${fmtDate(a.warrantyUntil)}` : `Warranty · ${w} days left`}</T>
                      <Countdown remaining={w} window={730} />
                    </View>
                  ) : null}
                  {a.plans.length ? <T muted style={{ fontSize: 12, marginTop: 8 }}>{a.plans.length} plan{a.plans.length > 1 ? "s" : ""} · {a.plans.map((p) => `${p.name} /${p.everyMonths}mo`).join(", ")}</T> : null}
                  {(() => { const own = applianceOwnership(db, a.id); return own && own.total > 0 ? <T muted style={{ fontSize: 12, marginTop: 4 }}>True cost {money(own.total, db.settings.currency)}{own.repairs ? ` · repairs ${money(own.repairs, db.settings.currency)}` : ""}</T> : null; })()}
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>

      {edit ? <ApplianceSheet appliance={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} /> : null}
      <Sheet visible={!!logFor} onClose={() => setLogFor(null)} title={`Log: ${logFor?.name ?? ""}`} testID="maint-log-sheet" footer={<Button label="Mark done today" icon="check" testID="maint-log-save" onPress={() => { update((d) => logMaintenance(d, logFor!.a, logFor!.p, parseNum(cost) || 0)); setLogFor(null); toast(parseNum(cost) > 0 ? "Logged · expense added to Money" : "Logged", "check-circle-outline"); }} />}>
        <Field numeric label="Cost (optional)" unit={db.settings.currency} testID="maint-cost-input" value={cost} onChangeText={setCost} placeholder="0" hint="A cost creates a linked Money expense" />
      </Sheet>
      <ModuleGate id="home" name="Home" icon="home-outline" />
    </View>
  );
}

function ApplianceSheet({ appliance, onClose }: { appliance?: Appliance; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [f, setF] = useState({ name: appliance?.name ?? "", brand: appliance?.brand ?? "", model: appliance?.model ?? "", serial: appliance?.serial ?? "", room: appliance?.room ?? "Kitchen", purchaseDate: appliance?.purchaseDate, price: appliance?.price ? String(appliance.price) : "", warrantyUntil: appliance?.warrantyUntil });
  const [plans, setPlans] = useState(appliance?.plans ?? []);
  const [pName, setPName] = useState("");
  const [pEvery, setPEvery] = useState("3");
  const [err, setErr] = useState<string>();
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = () => {
    if (!f.name.trim()) return setErr("Name is required");
    update((d) => upsertAppliance(d, { id: appliance?.id ?? uid(), createdAt: appliance?.createdAt ?? new Date().toISOString(), name: f.name.trim(), brand: f.brand || undefined, model: f.model || undefined, serial: f.serial || undefined, room: f.room, purchaseDate: f.purchaseDate, price: parseNum(f.price) || undefined, warrantyUntil: f.warrantyUntil, plans }));
    toast(appliance ? "Appliance updated" : `${f.name.trim()} added`, applianceIcon(f.name));
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title={appliance ? "Edit appliance" : "Add appliance"} testID="appliance-sheet" footer={<Button label="Save appliance" icon="check" onPress={save} testID="appliance-save-button" />}>
      <Field label="Name" testID="appliance-name-input" value={f.name} onChangeText={(t) => (set({ name: t }), setErr(undefined))} placeholder="Split AC" error={err} />
      <View style={{ marginHorizontal: -16 }}><ChipRow testID="appliance-room-row">{ROOMS.map((r) => <Chip key={r} label={r} selected={f.room === r} onPress={() => set({ room: r })} testID={`appliance-room-${r}`} />)}</ChipRow></View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field style={{ flex: 1 }} label="Brand" testID="appliance-brand-input" value={f.brand} onChangeText={(t) => set({ brand: t })} />
        <Field style={{ flex: 1 }} label="Model" testID="appliance-model-input" value={f.model} onChangeText={(t) => set({ model: t })} />
      </View>
      <Field label="Serial number" testID="appliance-serial-input" value={f.serial} onChangeText={(t) => set({ serial: t })} />
      <Field numeric label="Price" unit={db.settings.currency} testID="appliance-price-input" value={f.price} onChangeText={(t) => set({ price: t })} />
      <DateField label="Purchase date" optional value={f.purchaseDate} onChange={(v) => set({ purchaseDate: v })} testID="appliance-purchase-date" />
      <DateField label="Warranty until" optional value={f.warrantyUntil} onChange={(v) => set({ warrantyUntil: v })} testID="appliance-warranty-date" />
      <Eyebrow style={{ marginBottom: 6 }}>Maintenance plans</Eyebrow>
      {plans.map((p) => (
        <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 }}>
          <Icon name="wrench-clock" size={18} />
          <T style={{ flex: 1 }} numberOfLines={1}>{p.name} · every {p.everyMonths} mo · next {fmtDate(addMonths(p.lastDone, p.everyMonths))}</T>
          <IconButton icon="close" label="Remove plan" onPress={() => setPlans(plans.filter((x) => x.id !== p.id))} />
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <Field style={{ flex: 1 }} label="Plan" testID="plan-name-input" value={pName} onChangeText={setPName} placeholder="Filter clean" />
        <View style={{ width: 150 }}>
          <T v="caption" muted style={{ marginBottom: 6 }}>Every</T>
          <Segmented testID="plan-every" value={pEvery} onChange={setPEvery} options={[{ value: "3", label: "3m" }, { value: "6", label: "6m" }, { value: "12", label: "1y" }]} />
        </View>
      </View>
      <Button small kind="ghost" icon="plus" label="Add plan" testID="plan-add-button" onPress={() => pName.trim() && (setPlans([...plans, { id: uid(), name: pName.trim(), everyMonths: Number(pEvery), lastDone: todayISO() }]), setPName(""))} />
      {appliance ? <Button small kind="danger" icon="delete-outline" label="Delete appliance" testID="appliance-delete-button" style={{ marginTop: 12 }} onPress={() => (update((d) => deleteEntity(d, { kind: "appliance", id: appliance.id })), onClose())} /> : null}
      <T muted style={{ fontSize: 11, marginTop: 8 }}>{num(plans.length, 0)} plan(s). New plans start counting from today.</T>
    </Sheet>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({ ic: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" } }));
