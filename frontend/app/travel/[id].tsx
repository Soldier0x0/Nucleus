import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { useOnline } from "@/src/core/useOnline";
import { countryFacts, holidays, rates } from "@/src/core/online";
import { addTripExpense, PACK_TEMPLATES, packFromTemplate, packingFromGroups, readiness, reuseCandidate, tripStatus, tripTxns, upsertTrip } from "@/src/core/domains";
import { deleteEntity } from "@/src/core/actions";
import { EXPENSE_CATEGORIES } from "@/src/core/defaults";
import { CURRENCIES, addDays, fmtDate, num, parseNum, uid } from "@/src/core/format";
import type { Trip } from "@/src/core/types";
import { Header } from "@/src/components/Header";
import { Amount, Button, Card, Chip, ChipRow, EmptyState, Eyebrow, Icon, IconButton, Press, Segmented, T } from "@/src/components/ui";
import { Bar, Ring } from "@/src/components/charts";
import { Sheet } from "@/src/components/Sheet";
import { DateField, Field } from "@/src/components/inputs";
import { WeatherCard } from "@/src/components/WeatherCard";
import { WhySheet } from "@/src/components/WhySheet";
import { useToast } from "@/src/components/Toast";
import { TripSheet } from "./index";
import { TripDesk } from "@/src/components/TripDesk";
import { adhdOpen, typeAdhdDraft } from "@/src/core/presets";

type Tab = "packing" | "plan" | "spend" | "docs";

export default function TripDetail() {
  const { id, field, seed } = useLocalSearchParams<{ id: string; field?: string; seed?: string }>();
  const { db, update } = useStore();
  const { online, log } = useOnline();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("packing");
  const [sheet, setSheet] = useState<null | "edit" | "stop" | "expense" | "why" | "delete">(null);
  const [newItem, setNewItem] = useState("");
  const [facts, setFacts] = useState<any>(null);
  const [hols, setHols] = useState<{ date: string; name: string }[]>([]);
  const t = db.trips.find((x) => x.id === id);
  const placeSeed = typeof seed === "string" ? seed : "";
  const openStep = adhdOpen(db);
  const [placeDraft, setPlaceDraft] = useState(openStep?.recordId === id && openStep.draft ? openStep.draft : t?.place?.name || placeSeed);
  const cc = t?.place?.countryCode;
  useEffect(() => {
    if (!cc || !t) return;
    countryFacts(online, log, cc).then(setFacts);
    holidays(online, log, Number(t.start.slice(0, 4)), cc).then((h) => setHols(h.filter((x) => x.date >= t.start && x.date <= t.end)));
  }, [online, cc, t?.start, t?.end]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!t)
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title="Trip" />
        <View style={{ padding: 16 }}><EmptyState icon="bag-suitcase-outline" title="Trip not found" body="It may have been deleted." /></View>
      </View>
    );
  const r = readiness(db, t);
  const st = tripStatus(t);
  const save = (patch: Partial<Trip>) => update((d) => upsertTrip(d, { ...t, ...patch }));
  const cats = Array.from(new Set(t.packing.map((p) => p.category)));
  const reuse = reuseCandidate(db, t);
  const days = Array.from({ length: r.days }, (_, i) => addDays(t.start, i));
  const txns = tripTxns(db, t.id).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={t.name} testID="trip-header" right={<><IconButton icon="pencil-outline" testID="trip-edit-button" label="Edit" onPress={() => setSheet("edit")} /><IconButton icon="delete-outline" testID="trip-delete-button" label="Delete" onPress={() => setSheet("delete")} /></>} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 32, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {field === "place" ? (
          <Card testID="trip-focus-place-card">
            <Field
              label="Place"
              testID="trip-focus-place"
              value={placeDraft}
              autoFocus
              onChangeText={(value) => {
                setPlaceDraft(value);
                update((current) => {
                  const open = adhdOpen(current);
                  if (!open || open.recordId !== t.id) return current;
                  return typeAdhdDraft(current, value);
                });
              }}
            />
            <Button
              label="Save"
              testID="trip-focus-save"
              onPress={() => update((current) => upsertTrip(current, { ...t, place: { name: placeDraft.trim() || placeSeed, lat: t.place?.lat ?? 0, lon: t.place?.lon ?? 0 } }))}
            />
          </Card>
        ) : null}
        <TripDesk trip={t} />
        <Card testID="trip-hero">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Ring value={r.score} size={124} stroke={12} testID="trip-readiness-ring">
              <T v="monoXl" testID="trip-readiness-pct">{num(r.score * 100, 0)}%</T>
              <T muted style={{ fontSize: 10 }}>ready</T>
            </Ring>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow>{st === "upcoming" ? "Departs in" : st === "ongoing" ? "On the trip" : "Completed"}</Eyebrow>
              {st === "upcoming" ? <T v="display" testID="trip-countdown">{r.daysToStart}<T v="h2"> days</T></T> : null}
              <T muted numberOfLines={2} style={{ fontSize: 12 }}>{t.destination} · {fmtDate(t.start)} → {fmtDate(t.end)} · {t.travellers} traveller{t.travellers > 1 ? "s" : ""}</T>
            </View>
          </View>
          {r.missing.length ? (
            <Press testID="trip-why-button" onPress={() => setSheet("why")} style={[styles.miss, { backgroundColor: colors.brandTertiary }]}>
              <Icon name="alert-circle-outline" size={16} color={colors.onBrandTertiary} />
              <T color={colors.onBrandTertiary} style={{ flex: 1, fontSize: 13 }} numberOfLines={2}>{r.missing.join(" · ")}</T>
              <T v="caption" color={colors.onBrandTertiary}>Why?</T>
            </Press>
          ) : null}
        </Card>

        {t.place ? <WeatherCard place={t.place} testID="trip-weather" from={t.start} to={t.end} /> : null}
        {facts || hols.length ? (
          <Card testID="trip-country-facts">
            <Eyebrow style={{ marginBottom: 6 }}>{t.place?.country ?? "Destination"}</Eyebrow>
            {facts ? <T style={{ fontSize: 13 }}>Currency {facts.currency} · {facts.timezone} · drives on the {facts.driving}{facts.languages ? ` · ${facts.languages}` : ""}</T> : null}
            {hols.map((h) => <T key={h.date + h.name} style={{ fontSize: 13, marginTop: 4 }}>Holiday · {fmtDate(h.date)} · {h.name}</T>)}
            {facts && !hols.length ? <T muted style={{ fontSize: 12, marginTop: 4 }}>No public holidays during the trip.</T> : null}
          </Card>
        ) : null}

        <Segmented testID="trip-tabs" value={tab} onChange={setTab} options={[{ value: "packing", label: "Pack" }, { value: "plan", label: "Plan" }, { value: "spend", label: "Spend" }, { value: "docs", label: "Docs" }]} />

        {tab === "packing" && (
          <View testID="trip-packing">
            {t.packing.length === 0 ? (
              <>
                <Eyebrow style={{ marginBottom: 4 }}>Start from a template</Eyebrow>
                <View style={{ marginHorizontal: -16 }}>
                  <ChipRow testID="trip-template-row">
                    {Object.keys(PACK_TEMPLATES).map((k) => <Chip key={k} label={k} onPress={() => save({ packing: packFromTemplate(k) })} testID={`trip-template-${k}`} />)}
                    {db.templates.map((template) => <Chip key={template.id} label={template.name} onPress={() => save({ packing: packingFromGroups(template.groups) })} testID={`trip-template-${template.id}`} />)}
                  </ChipRow>
                </View>
                {reuse ? <Button kind="ghost" small icon="content-duplicate" label={`Reuse "${reuse.name}" list (${reuse.packing.length} items)`} testID="trip-reuse-button" onPress={() => save({ packing: reuse.packing.map((p) => ({ ...p, id: uid(), done: false })) })} /> : null}
              </>
            ) : (
              cats.map((c) => {
                const items = t.packing.filter((p) => p.category === c);
                const done = items.filter((p) => p.done).length;
                return (
                  <View key={c} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: "row", marginBottom: 6 }}>
                      <Eyebrow style={{ flex: 1 }}>{c}</Eyebrow>
                      <T v="mono" style={{ fontSize: 12 }}>{done}/{items.length}</T>
                    </View>
                    <Bar value={done} max={items.length} />
                    {items.map((p) => (
                      <Press key={p.id} testID={`pack-item-${p.id}`} onPress={() => save({ packing: t.packing.map((x) => (x.id === p.id ? { ...x, done: !x.done } : x)) })} style={styles.check}>
                        <Icon name={p.done ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={p.done ? colors.success : colors.muted} />
                        <T style={{ flex: 1, textDecorationLine: p.done ? "line-through" : "none", color: p.done ? colors.muted : colors.onSurface }} numberOfLines={1}>{p.name}</T>
                        <IconButton icon="close" label="Remove" onPress={() => save({ packing: t.packing.filter((x) => x.id !== p.id) })} />
                      </Press>
                    ))}
                  </View>
                );
              })
            )}
            <View style={[styles.addRow, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }]}>
              <TextInput testID="pack-add-input" value={newItem} onChangeText={setNewItem} placeholder="Add item (e.g. Sunglasses)" placeholderTextColor={colors.muted} style={{ flex: 1, height: 46, color: colors.onSurface, fontFamily: fonts.text }} onSubmitEditing={() => newItem.trim() && (save({ packing: [...t.packing, { id: uid(), name: newItem.trim(), category: "Misc", done: false }] }), setNewItem(""))} />
              <IconButton icon="plus" testID="pack-add-button" label="Add" onPress={() => newItem.trim() && (save({ packing: [...t.packing, { id: uid(), name: newItem.trim(), category: "Misc", done: false }] }), setNewItem(""))} />
            </View>
          </View>
        )}

        {tab === "plan" && (
          <View testID="trip-itinerary">
            {days.map((d, di) => {
              const stops = t.itinerary.filter((x) => x.date === d).sort((a, b) => a.time.localeCompare(b.time));
              return (
                <View key={d} style={{ marginBottom: 14 }}>
                  <Eyebrow style={{ marginBottom: 6 }}>Day {di + 1} · {fmtDate(d)}</Eyebrow>
                  {stops.length === 0 ? <T muted style={{ fontSize: 12 }}>Nothing planned.</T> : null}
                  {stops.map((x, i) => (
                    <View key={x.id} style={{ flexDirection: "row", gap: 10 }}>
                      <T v="mono" style={{ width: 48, fontSize: 12, paddingTop: 2 }}>{x.time}</T>
                      <View style={{ alignItems: "center", width: 12 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary, marginTop: 4 }} />
                        {i < stops.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: colors.borderStrong }} /> : null}
                      </View>
                      <View style={{ flex: 1, paddingBottom: 12, minWidth: 0 }}>
                        <T v="label" numberOfLines={2}>{x.title}</T>
                        {x.place || x.note ? <T muted style={{ fontSize: 12 }} numberOfLines={2}>{[x.place, x.note].filter(Boolean).join(" · ")}</T> : null}
                      </View>
                      <IconButton icon="close" label="Remove stop" onPress={() => save({ itinerary: t.itinerary.filter((y) => y.id !== x.id) })} />
                    </View>
                  ))}
                </View>
              );
            })}
            <Button icon="map-marker-plus-outline" label="Add stop" testID="trip-add-stop-button" onPress={() => setSheet("stop")} />
          </View>
        )}

        {tab === "spend" && (
          <View testID="trip-spend" style={{ gap: 10 }}>
            <Card>
              <Eyebrow>Spent{t.budget ? " vs budget" : ""}</Eyebrow>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginVertical: 6 }}>
                <Amount value={r.spent} v="monoXl" testID="trip-spent" />
                {t.budget ? <Amount value={t.budget} v="mono" style={{ color: colors.muted }} /> : null}
              </View>
              {t.budget ? <Bar value={r.spent} max={Math.max(t.budget, r.spent)} limit={t.budget} /> : <T muted style={{ fontSize: 12 }}>Set a budget in Edit to track progress.</T>}
              <T muted style={{ fontSize: 12, marginTop: 6 }}>Per traveller: {num(r.spent / t.travellers, 0)} {db.settings.currency}{r.days > 0 ? ` · per day ${num(r.spent / r.days, 0)}` : ""}</T>
            </Card>
            {txns.map((x) => (
              <Press key={x.id} onPress={() => router.push(`/record/txn/${x.id}`)} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                <Icon name="cash" size={20} color={colors.muted} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="label" numberOfLines={1}>{x.note || x.category}</T>
                  <T muted style={{ fontSize: 12 }} numberOfLines={1}>{x.category} · {fmtDate(x.date)}{x.origCurrency ? ` · ${num(x.origAmount!, 2)} ${x.origCurrency}` : ""}</T>
                </View>
                <Amount value={x.amount} />
              </Press>
            ))}
            <Button icon="plus" label="Add trip expense" testID="trip-add-expense-button" onPress={() => setSheet("expense")} />
          </View>
        )}

        {tab === "docs" && (
          <View testID="trip-docs">
            {t.docs.map((d) => (
              <View key={d.id} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, marginBottom: 8 }]}>
                <Press testID={`doc-toggle-${d.id}`} onPress={() => save({ docs: t.docs.map((x) => (x.id === d.id ? { ...x, have: !x.have } : x)) })} style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <Icon name={d.have ? "check-circle" : "circle-outline"} size={22} color={d.have ? colors.success : colors.muted} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="label" numberOfLines={1}>{d.name}</T>
                    <T muted style={{ fontSize: 12 }}>{d.have ? "Ready" : "Missing"}{d.expiry ? ` · expires ${fmtDate(d.expiry)}` : ""}</T>
                  </View>
                </Press>
                <View style={{ width: 150 }}><DateField label="Expiry" optional value={d.expiry} onChange={(v) => save({ docs: t.docs.map((x) => (x.id === d.id ? { ...x, expiry: v } : x)) })} testID={`doc-expiry-${d.id}`} /></View>
              </View>
            ))}
            <Button kind="ghost" small icon="plus" label="Add Visa" onPress={() => save({ docs: [...t.docs, { id: uid(), name: "Visa", have: false }] })} testID="trip-add-visa" />
          </View>
        )}
      </ScrollView>

      {sheet === "edit" ? <TripSheet visible onClose={() => setSheet(null)} trip={t} /> : null}
      {sheet === "stop" ? <StopSheet trip={t} days={days} onClose={() => setSheet(null)} /> : null}
      {sheet === "expense" ? <TripExpenseSheet trip={t} onClose={() => setSheet(null)} /> : null}
      <WhySheet visible={sheet === "why"} onClose={() => setSheet(null)} title={`${t.name} readiness`} why={{ summary: `Readiness ${num(r.score * 100, 0)}%: ${r.missing.join(", ") || "all set"}.`, facts: [{ label: "Packing (50%)", value: `${num(r.packPct * 100, 0)}%` }, { label: "Documents (30%)", value: `${num(r.docPct * 100, 0)}%` }, { label: "Budget set (20%)", value: r.budgetOk ? "Yes" : "No" }], rule: "Readiness = 0.5 × packing done + 0.3 × documents present + 0.2 × budget set.", ranking: "Appears in Attention within 14 days of departure; urgent within 3." }} />
      <Sheet visible={sheet === "delete"} onClose={() => setSheet(null)} title={`Delete ${t.name}?`} testID="trip-delete-sheet">
        <T style={{ marginBottom: 16 }}>The trip, its packing list, itinerary and documents are removed. Expenses stay in Money.</T>
        <Button kind="danger" icon="delete-outline" label="Delete trip" testID="trip-delete-confirm" onPress={() => (update((d) => deleteEntity(d, { kind: "trip", id: t.id })), setSheet(null), toast("Trip deleted", "delete-outline"), router.back())} />
      </Sheet>
    </View>
  );
}

function StopSheet({ trip, days, onClose }: { trip: Trip; days: string[]; onClose: () => void }) {
  const { update } = useStore();
  const [date, setDate] = useState(days[0]);
  const [time, setTime] = useState("09:00");
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [err, setErr] = useState<string>();
  const save = () => {
    if (!title.trim()) return setErr("What's happening?");
    if (!/^\d{1,2}:\d{2}$/.test(time)) return setErr("Time as HH:MM");
    update((d) => upsertTrip(d, { ...trip, itinerary: [...trip.itinerary, { id: uid(), date, time: time.padStart(5, "0"), title: title.trim(), place: place.trim() || undefined }] }));
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title="Add stop" testID="stop-sheet" footer={<Button label="Add to itinerary" icon="check" onPress={save} testID="stop-save-button" />}>
      <Eyebrow style={{ marginBottom: 4 }}>Day</Eyebrow>
      <View style={{ marginHorizontal: -16 }}>
        <ChipRow>{days.map((d, i) => <Chip key={d} label={`Day ${i + 1}`} selected={d === date} onPress={() => setDate(d)} testID={`stop-day-${i + 1}`} />)}</ChipRow>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field style={{ width: 110 }} label="Time" testID="stop-time-input" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
        <Field style={{ flex: 1 }} label="What" testID="stop-title-input" value={title} onChangeText={(x) => (setTitle(x), setErr(undefined))} placeholder="Train to Madgaon" error={err} />
      </View>
      <Field label="Place / booking (optional)" testID="stop-place-input" value={place} onChangeText={setPlace} />
    </Sheet>
  );
}

function TripExpenseSheet({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const { db, update } = useStore();
  const { online, log } = useOnline();
  const toast = useToast();
  const home = db.settings.currency;
  const [cur, setCur] = useState(home);
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("1");
  const [rateSrc, setRateSrc] = useState("");
  const [cat, setCat] = useState("Food");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (cur === home) return;
    rates(online, log, cur).then((r) => {
      if (r?.rates[home]) {
        setRate(String(Number(r.rates[home].toFixed(4))));
        setRateSrc(`${r.stale ? "cached" : "live"} rate · ${new Date(r.at).toLocaleDateString()}`);
      } else setRateSrc("Enter rate manually (Online off or unavailable)");
    });
  }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps
  const A = parseNum(amount), R = parseNum(rate);
  const converted = A * R;
  const save = () => {
    if (!(A > 0) || !(R > 0)) return;
    update((d) => addTripExpense(d, trip.id, { id: uid(), type: "expense", amount: Number(converted.toFixed(2)), category: cat, date: new Date().toISOString().slice(0, 10), note: note.trim() || `${trip.name} · ${cat}`, ...(cur !== home ? { origAmount: A, origCurrency: cur } : {}) }));
    toast("Trip expense added · also in Money", "cash");
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title="Trip expense" testID="trip-expense-sheet" footer={<Button label="Save expense" icon="check" onPress={save} disabled={!(A > 0 && R > 0)} testID="trip-expense-save-button" />}>
      <View style={{ marginHorizontal: -16 }}>
        <ChipRow>{CURRENCIES.map((c) => <Chip key={c} label={c} selected={cur === c} onPress={() => (setCur(c), setRate(c === home ? "1" : rate), setRateSrc(""))} testID={`trip-expense-cur-${c}`} />)}</ChipRow>
      </View>
      <Field numeric label="Amount" unit={cur} testID="trip-expense-amount-input" value={amount} onChangeText={setAmount} placeholder="0" />
      {cur !== home ? <Field numeric label={`1 ${cur} =`} unit={home} testID="trip-expense-rate-input" value={rate} onChangeText={setRate} hint={rateSrc} /> : null}
      {A > 0 && cur !== home ? <T v="mono" style={{ marginBottom: 10 }} testID="trip-expense-converted">= {num(converted, 2)} {home}</T> : null}
      <View style={{ marginHorizontal: -16 }}>
        <ChipRow>{EXPENSE_CATEGORIES.slice(0, 10).map((c) => <Chip key={c} label={c} selected={cat === c} onPress={() => setCat(c)} testID={`trip-expense-cat-${c}`} />)}</ChipRow>
      </View>
      <Field label="Note (optional)" testID="trip-expense-note-input" value={note} onChangeText={setNote} />
    </Sheet>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  miss: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: radius.md, marginTop: 12 },
  check: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  addRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingLeft: 12, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radius.lg, padding: 10 },
}));
