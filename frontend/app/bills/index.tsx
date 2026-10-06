import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { nextCycleDate, upsertSubscription } from "@/src/core/actions";
import { billReminder, repeatingBillBoard, setBillMark } from "@/src/core/bills";
import type { Subscription } from "@/src/core/types";
import { money, todayISO, uid } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Button, Card, Chip, ChipRow, EmptyState, Eyebrow, IconButton, T } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { DateField, Field } from "@/src/components/inputs";
import { useToast } from "@/src/components/Toast";
import { ModuleGate } from "@/src/components/ModuleGate";

const CYCLES: Subscription["cycle"][] = ["weekly", "monthly", "quarterly", "yearly"];
const KINDS = ["Rent", "Loan EMI", "Subscriptions"] as const;

export default function Bills() {
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const today = todayISO();
  const rows = repeatingBillBoard(db, today);
  const [open, setOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Bills" testID="bills-header" right={<IconButton icon="plus" label="Add bill" testID="bills-add" onPress={() => setOpen(true)} />} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {rows.length === 0 ? (
          <EmptyState
            testID="bills-empty"
            icon="calendar-clock"
            title="No repeating bills yet"
            body="Rent, an EMI, or a subscription. Due, paid, and snooze stay on this phone."
            action={<Button label="Add a bill" icon="plus" testID="bills-empty-add" onPress={() => setOpen(true)} />}
          />
        ) : (
          rows.map((row) => (
            <Card key={row.id} testID={`bill-${row.id}`}>
              <T v="h2">{row.name}</T>
              <T v="mono" style={{ marginTop: 6 }}>{money(row.amount, db.settings.currency)}</T>
              <T muted style={{ marginTop: 6 }}>{billReminder(row)}</T>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Button small kind="secondary" label="Due" testID={`bill-due-${row.id}`} onPress={() => update((current) => setBillMark(current, row.id, "due", today))} />
                <Button small kind="secondary" label="Paid" testID={`bill-paid-${row.id}`} onPress={() => update((current) => setBillMark(current, row.id, "paid", today))} />
                <Button small kind="secondary" label="Snooze" testID={`bill-snooze-${row.id}`} onPress={() => update((current) => setBillMark(current, row.id, "snoozed", today))} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
      {open ? <BillSheet onClose={() => setOpen(false)} /> : null}
      <ModuleGate id="money" name="Bills" icon="calendar-clock" />
    </View>
  );
}

function BillSheet({ onClose }: { onClose: () => void }) {
  const { update } = useStore();
  const toast = useToast();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<Subscription["cycle"]>("monthly");
  const [due, setDue] = useState(() => nextCycleDate(todayISO(), "monthly"));
  const [category, setCategory] = useState<(typeof KINDS)[number]>("Rent");
  const save = () => {
    const value = Number(amount);
    if (!name.trim() || !Number.isFinite(value) || value <= 0) return toast("Name the bill and the amount", "calendar-clock");
    update((current) => upsertSubscription(current, {
      id: uid(),
      name: name.trim(),
      amount: value,
      cycle,
      nextRenewal: due,
      category,
      active: true,
    }));
    toast("Bill saved", "calendar-clock");
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title="Add a bill" testID="bill-sheet" footer={<Button label="Save bill" icon="check" testID="bill-save" onPress={save} />}>
      <Field label="Name" testID="bill-name" value={name} onChangeText={setName} placeholder="Rent" />
      <Field label="Amount" testID="bill-amount" value={amount} onChangeText={setAmount} numeric placeholder="0" />
      <Eyebrow style={{ marginBottom: 8 }}>How often</Eyebrow>
      <ChipRow testID="bill-cycle">
        {CYCLES.map((item) => (
          <Chip key={item} label={item} selected={cycle === item} testID={`bill-cycle-${item}`} onPress={() => (setCycle(item), setDue(nextCycleDate(todayISO(), item)))} />
        ))}
      </ChipRow>
      <DateField label="Due" value={due} onChange={(v) => setDue(v ?? nextCycleDate(todayISO(), cycle))} testID="bill-due" />
      <Eyebrow style={{ marginTop: 12, marginBottom: 8 }}>Kind</Eyebrow>
      <ChipRow testID="bill-kind">
        {KINDS.map((item) => (
          <Chip key={item} label={item} selected={category === item} testID={`bill-kind-${item}`} onPress={() => setCategory(item)} />
        ))}
      </ChipRow>
    </Sheet>
  );
}
