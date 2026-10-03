import { useState } from "react";
import { TextInput, View } from "react-native";
import { useStore } from "@/src/core/store";
import { EXPENSE_CATEGORIES } from "@/src/core/defaults";
import { parseReceipt } from "@/src/core/receipt";
import { todayISO, uid } from "@/src/core/format";
import { Sheet } from "./Sheet";
import { Button, ChipRow, Chip, T } from "./ui";
import { Field } from "./inputs";
import { useTheme } from "@/src/theme";

/** Turns pasted receipt text into an expense. The words are not read from a photo. */
export function ReceiptSheet({ text, onClose }: { text: string; onClose: () => void }) {
  const { update } = useStore();
  const { colors } = useTheme();
  const read = parseReceipt(text);
  const [body, setBody] = useState(text);
  const [merchant, setMerchant] = useState(read.merchant);
  const [amount, setAmount] = useState(read.amount != null ? String(read.amount) : "");
  const [date, setDate] = useState(read.date ?? todayISO());
  const [category, setCategory] = useState("Other");
  const parsed = parseReceipt(body);
  const value = Number(amount);
  const ready = value > 0;
  return (
    <Sheet
      visible
      onClose={onClose}
      title="Receipt text"
      testID="receipt-sheet"
      footer={
        <Button
          label="Save expense"
          icon="check"
          disabled={!ready}
          testID="receipt-save"
          onPress={() => {
            update((d) => ({
              ...d,
              txns: [...d.txns, { id: uid(), type: "expense" as const, amount: Math.round(value * 100) / 100, category, date, note: merchant.trim() || undefined }],
            }));
            onClose();
          }}
        />
      }
    >
      <T muted style={{ fontSize: 12, marginBottom: 8 }}>
        Paste the words from a bill. Nucleus looks for a total. It does not read a photo, and it does not keep a model on the phone.
      </T>
      <TextInput
        testID="receipt-text"
        value={body}
        onChangeText={(next) => {
          setBody(next);
          const again = parseReceipt(next);
          if (again.amount != null) setAmount(String(again.amount));
          if (again.date) setDate(again.date);
          if (again.merchant) setMerchant(again.merchant);
        }}
        multiline
        placeholder="Shop name, date, and a line that says Total"
        placeholderTextColor={colors.muted}
        style={{ minHeight: 96, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, color: colors.onSurface, textAlignVertical: "top", marginBottom: 12 }}
      />
      <Field label="Amount" numeric value={amount} onChangeText={setAmount} testID="receipt-amount" />
      <Field label="Date" value={date} onChangeText={setDate} testID="receipt-date" />
      <Field label="Note" value={merchant} onChangeText={setMerchant} testID="receipt-note" />
      <ChipRow testID="receipt-categories">
        {EXPENSE_CATEGORIES.map((c) => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} testID={`receipt-cat-${c}`} />
        ))}
      </ChipRow>
      {parsed.amount == null ? <T muted style={{ fontSize: 12, marginTop: 8 }}>No total found yet. You can still type the amount.</T> : null}
      <View />
    </Sheet>
  );
}
