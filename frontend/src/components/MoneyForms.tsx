import React, { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { addTxn, nextCycleDate, upsertSubscription } from "@/src/core/actions";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/src/core/defaults";
import { categoryFromOther, classifyMoney, heldSuggestions, moneySuggestions } from "@/src/core/moneyWords";
import type { Subscription } from "@/src/core/types";
import { budgetCleared } from "@/src/core/budgetSave";
import { money, parseNum, todayISO, uid } from "@/src/core/format";
import { Sheet } from "./Sheet";
import { ConfirmSheet } from "./ConfirmSheet";
import { DateField, Field } from "./inputs";
import { Button, Chip, ChipRow, Eyebrow, Icon, Press, Segmented } from "./ui";
import { useToast } from "./Toast";
import { PhotoNote } from "./PhotoPick";

/** Quick entry: custom number pad + category chips, no system keyboard needed. */
export function TxnSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amt, setAmt] = useState("");
  const recentCat = db.recents.lastCategory;
  const [cat, setCat] = useState(recentCat && EXPENSE_CATEGORIES.includes(recentCat) ? recentCat : "Food");
  const [item, setItem] = useState<string | undefined>();
  const [otherName, setOtherName] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [cash, setCash] = useState(false);
  const [ownTransfer, setOwnTransfer] = useState(false);
  const [date, setDate] = useState(todayISO());
  const cats = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  // most-used categories first
  const freq: Record<string, number> = {};
  db.txns.filter((t) => t.type === type).forEach((t) => (freq[t.category] = (freq[t.category] ?? 0) + 1));
  const ordered = [...cats].sort((a, b) => (freq[b] ?? 0) - (freq[a] ?? 0));

  const key = (k: string) => {
    if (k === "del") return setAmt((a) => a.slice(0, -1));
    if (k === "." && amt.includes(".")) return;
    if (amt.includes(".") && amt.split(".")[1].length >= 2) return;
    if (amt.replace(".", "").length >= 9) return;
    setAmt((a) => (a === "0" && k !== "." ? k : a + k));
  };
  const value = parseNum(amt);
  const held = useRef<ReturnType<typeof moneySuggestions>>([]);
  const suggestions = heldSuggestions(held.current, moneySuggestions(note, type), note);
  held.current = suggestions;
  const save = () => {
    if (!(value > 0)) return;
    const category = cat === "Other" ? categoryFromOther(otherName) : cat;
    update((d) => ({ ...addTxn(d, { id: uid(), type, amount: value, category, item: cat === "Other" ? undefined : item, date, note: note.trim() || undefined, photo, cash: cash || undefined, transfer: ownTransfer || undefined }), recents: { ...d.recents, lastCategory: category } }));
    toast(`${type === "expense" ? "Expense" : "Income"} ${money(value, db.settings.currency)} saved`, "check-circle-outline");
    setAmt("");
    setNote("");
    setPhoto(undefined);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Quick entry" testID="txn-sheet" footer={<Button label={`Save ${type}`} icon="check" onPress={save} disabled={!(value > 0)} testID="txn-save-button" />}>
      <Segmented testID="txn-type" value={type} onChange={(v) => {
        setType(v);
        const hit = classifyMoney(note, v);
        setCat(hit?.category ?? (v === "expense" ? "Food" : "Salary"));
        setItem(hit?.item);
      }} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} />
      <View style={[styles.display, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
        <Icon name={type === "expense" ? "arrow-up-bold-circle-outline" : "arrow-down-bold-circle-outline"} size={22} color={type === "expense" ? colors.error : colors.success} />
        <Text testID="txn-amount-display" numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, textAlign: "right", fontFamily: fonts.monoBold, fontSize: 36, color: amt ? colors.onSurface : colors.muted }}>
          {amt ? money(value || 0, db.settings.currency, { decimals: amt.includes(".") }) : money(0, db.settings.currency, { decimals: false })}
        </Text>
      </View>
      <View style={{ marginHorizontal: -16 }}>
        <ChipRow testID="txn-category-row">
          {(ordered.includes(cat) ? ordered : [cat, ...ordered]).map((c) => (
            <Chip key={c} label={c} selected={cat === c} onPress={() => (setCat(c), setItem(undefined))} testID={`txn-category-${c}`} />
          ))}
        </ChipRow>
      </View>
      <View style={styles.pad}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"].map((k) => (
          <Press key={k} testID={`txn-key-${k}`} onPress={() => key(k)} style={[styles.key, { backgroundColor: k === "del" ? colors.surfaceTertiary : colors.surfaceSecondary, borderColor: colors.border }]} accessibilityLabel={k === "del" ? "Delete" : k}>
            {k === "del" ? <Icon name="backspace-outline" size={22} /> : <Text style={{ fontFamily: fonts.monoMedium, fontSize: 22, color: colors.onSurface }}>{k}</Text>}
          </Press>
        ))}
      </View>
      <Field label="Note (optional)" testID="txn-note-input" value={note} onChangeText={(text) => {
        setNote(text);
        const hit = classifyMoney(text, type);
        if (hit) {
          setCat(hit.category);
          setItem(hit.item);
        }
      }} placeholder="What was it for?" />
      {suggestions.length ? (
        <ChipRow testID="txn-suggestions">
          {suggestions.map((s) => (
            <Chip key={`${s.hit.category}:${s.label}`} label={s.label} selected={item === s.hit.item && cat === s.hit.category} onPress={() => (setCat(s.hit.category), setItem(s.hit.item))} testID={`txn-suggest-${s.label}`} />
          ))}
        </ChipRow>
      ) : null}
      {cat === "Other" ? <Field label="Name this category (optional)" testID="txn-other-name" value={otherName} onChangeText={setOtherName} placeholder="Dividend, School fees" hint="Leave blank and it stays Other." /> : null}
      {type === "expense" ? <PhotoNote uri={photo} onChange={setPhoto} testID="txn-photo" /> : null}
      <DateField label="Date" value={date} onChange={(v) => setDate(v ?? todayISO())} testID="txn-date" />
      {type === "expense" ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Button small kind={cash ? "primary" : "secondary"} label="Cash" testID="txn-cash" onPress={() => setCash((v) => !v)} />
          <Button small kind={ownTransfer ? "primary" : "secondary"} label="Own account" testID="txn-transfer" onPress={() => setOwnTransfer((v) => !v)} />
        </View>
      ) : null}
    </Sheet>
  );
}

export function SubscriptionSheet({ visible, onClose, sub }: { visible: boolean; onClose: () => void; sub?: Subscription }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [name, setName] = useState(sub?.name ?? "");
  const [amount, setAmount] = useState(sub ? String(sub.amount) : "");
  const [cycle, setCycle] = useState<Subscription["cycle"]>(sub?.cycle ?? "monthly");
  const [next, setNext] = useState(sub?.nextRenewal ?? nextCycleDate(todayISO(), "monthly"));
  const known = ["Subscriptions", "Bills", "Entertainment", "Health", "Loan EMI", "Other"];
  const initialCategory = sub?.category ?? "Subscriptions";
  const customCategory = !!sub && !known.includes(initialCategory);
  const [category, setCategory] = useState(customCategory ? "Other" : initialCategory);
  const [otherName, setOtherName] = useState(customCategory ? initialCategory : "");
  const [err, setErr] = useState<Record<string, string>>({});
  const [del, setDel] = useState(false);
  const save = () => {
    const a = parseNum(amount);
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!(a > 0)) e.amount = "Enter the amount";
    setErr(e);
    if (Object.keys(e).length) return;
    const filed = category === "Other" ? categoryFromOther(otherName) : category;
    update((d) => upsertSubscription(d, { id: sub?.id ?? uid(), name: name.trim(), amount: a, cycle, nextRenewal: next, category: filed, active: sub?.active ?? true }));
    toast(sub ? "Subscription updated" : `${name.trim()} added`, "autorenew");
    onClose();
  };
  const a = parseNum(amount);
  const yearly = a > 0 ? (cycle === "weekly" ? a * 52 : cycle === "monthly" ? a * 12 : cycle === "quarterly" ? a * 4 : a) : 0;
  return (
    <>
    <Sheet visible={visible} onClose={onClose} title={sub ? "Edit subscription" : "Add subscription"} testID="subscription-sheet" footer={<Button label="Save subscription" icon="check" onPress={save} testID="subscription-save-button" />}>
      <Field label="Name" testID="subscription-name-input" value={name} onChangeText={setName} placeholder="Netflix, Gym, Insurance…" error={err.name} />
      <Field numeric label="Amount" unit={db.settings.currency} testID="subscription-amount-input" value={amount} onChangeText={setAmount} error={err.amount} hint={yearly ? `${money(yearly, db.settings.currency)} per year` : undefined} />
      <Eyebrow style={{ marginBottom: 8 }}>Billing cycle</Eyebrow>
      <Segmented testID="subscription-cycle" value={cycle} onChange={setCycle} options={[{ value: "weekly", label: "Week" }, { value: "monthly", label: "Month" }, { value: "quarterly", label: "Qtr" }, { value: "yearly", label: "Year" }]} />
      <View style={{ height: 12 }} />
      <DateField label="Next renewal" value={next} onChange={(v) => setNext(v ?? todayISO())} testID="subscription-date" />
      <Eyebrow style={{ marginBottom: 4 }}>Category</Eyebrow>
      <View style={{ marginHorizontal: -16 }}>
        <ChipRow>
          {["Subscriptions", "Bills", "Entertainment", "Health", "Loan EMI", "Other"].map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} testID={`subscription-category-${c}`} />
          ))}
        </ChipRow>
      </View>
      {category === "Other" ? <Field label="Name this category (optional)" testID="subscription-other-name" value={otherName} onChangeText={setOtherName} placeholder="School fees" hint="Leave blank and it stays Other." /> : null}
      {sub ? (
        <>
        <Button
          kind="ghost"
          small
          label={sub.active ? "Pause subscription" : "Resume subscription"}
          icon={sub.active ? "pause" : "play"}
          testID="subscription-toggle-active"
          onPress={() => {
            update((d) => upsertSubscription(d, { ...sub, active: !sub.active }));
            onClose();
          }}
        />
        <Button
          kind="ghost"
          small
          label="Delete subscription"
          icon="delete-outline"
          testID="subscription-delete"
          onPress={() => setDel(true)}
        />
        </>
      ) : null}
    </Sheet>
      <ConfirmSheet
        visible={del}
        id="subscription-delete"
        title="Delete this subscription?"
        body={`“${sub?.name ?? ""}” will be removed. This can't be undone.`}
        confirmLabel="Delete"
        onCancel={() => setDel(false)}
        onConfirm={() => {
          if (sub) update((d) => ({ ...d, subscriptions: d.subscriptions.filter((x) => x.id !== sub.id) }));
          setDel(false);
          toast("Subscription deleted", "delete-outline");
          onClose();
        }}
      />
    </>
  );
}

export function BudgetSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [monthly, setMonthly] = useState(db.budget.monthly ? String(db.budget.monthly) : "");
  const [cats, setCats] = useState<Record<string, string>>(Object.fromEntries(Object.entries(db.budget.categories).map(([k, v]) => [k, String(v)])));
  const main = ["Food", "Groceries", "Fuel", "Shopping", "Entertainment", "Transport", "Bills"];
  const save = () => {
    const m = parseNum(monthly);
    const categories = Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, parseNum(v)]).filter(([, v]) => (v as number) > 0)) as Record<string, number>;
    update((d) => ({ ...d, budget: { monthly: m > 0 ? m : 0, categories } }));
    const cleared = budgetCleared(db.budget, { monthly: m, categories });
    toast(cleared ? "Budget cleared" : "Budget saved", "chart-donut");
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Budget" testID="budget-sheet" footer={<Button label="Save budget" icon="check" onPress={save} testID="budget-save-button" />}>
      <Field numeric label="Monthly budget" unit={db.settings.currency} testID="budget-monthly-input" value={monthly} onChangeText={setMonthly} placeholder="0" hint="Alerts at 80% and 100%" />
      <Eyebrow style={{ marginBottom: 8 }}>Category limits (optional)</Eyebrow>
      {main.map((c) => (
        <Field key={c} numeric label={c} unit={db.settings.currency} testID={`budget-cat-${c}`} value={cats[c] ?? ""} onChangeText={(t) => setCats((x) => ({ ...x, [c]: t }))} placeholder="No limit" />
      ))}
    </Sheet>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  display: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 16, height: 72, marginTop: 12 },
  pad: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  key: { width: "31.8%", height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
}));
