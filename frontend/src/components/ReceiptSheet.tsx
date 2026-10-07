import { useState } from "react";
import { TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useStore } from "@/src/core/store";
import { EXPENSE_CATEGORIES } from "@/src/core/defaults";
import { parseReceipt } from "@/src/core/receipt";
import { cropToPage, readReceiptWords, receiptCounts, receiptMismatchLine } from "@/src/core/receiptPage";
import { todayISO, uid } from "@/src/core/format";
import { Sheet } from "./Sheet";
import { Button, ChipRow, Chip, T } from "./ui";
import { Field } from "./inputs";
import { pickSmallPhoto } from "./PhotoPick";
import { useToast } from "./Toast";
import { useTheme } from "@/src/theme";

/** Turns pasted receipt text into an expense. The words are not read from a photo. */
export function ReceiptSheet({ text, onClose }: { text: string; onClose: () => void }) {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const [photo, setPhoto] = useState<string | undefined>();
  const read = parseReceipt(text);
  const [body, setBody] = useState(text);
  const [merchant, setMerchant] = useState(read.merchant);
  const [amount, setAmount] = useState(read.amount != null ? String(read.amount) : "");
  const [date, setDate] = useState(read.date ?? todayISO());
  const [category, setCategory] = useState("Other");
  const parsed = parseReceipt(body);
  const words = readReceiptWords(body);
  const debit = db.txns.find((row) => row.type === "expense" && !row.transfer && row.date === (words.date ?? date));
  const mismatch = words.amount != null && debit ? receiptMismatchLine(words.amount, debit.amount) : null;
  const page = cropToPage({ w: 1000, h: 1400 }, { x: 0, y: 0, w: 1000, h: 1400 });
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
          label="Confirm and save"
          icon="check"
          disabled={!ready}
          testID="receipt-save"
          onPress={() => {
            if (!receiptCounts(true)) return;
            update((d) => ({
              ...d,
              txns: [...d.txns, { id: uid(), type: "expense" as const, amount: Math.round(value * 100) / 100, category, date, note: merchant.trim() || undefined, photo }],
            }));
            onClose();
          }}
        />
      }
    >
      <T muted style={{ fontSize: 12, marginBottom: 8 }}>
        A photo is optional and fills the page, like a scan. The amount, date, and shop are read from the words on this phone. They count only after you confirm. Nothing is sent to a model.
      </T>
      {photo ? <Image source={{ uri: photo }} style={{ width: "100%", aspectRatio: page.w / page.h, borderRadius: 8, marginBottom: 8, backgroundColor: colors.surfaceTertiary }} contentFit="cover" /> : null}
      {photo ? <Button small kind="ghost" label="Remove photo" testID="receipt-photo-clear" onPress={() => setPhoto(undefined)} style={{ marginBottom: 8 }} /> : null}
      <Button
        small
        kind="secondary"
        label={photo ? "Replace receipt photo" : "Add a receipt photo"}
        testID="receipt-photo"
        onPress={async () => {
          const next = await pickSmallPhoto();
          if (next === "too-big") return toast("That photo is too large. Crop it to the page.", "image-off-outline");
          if (next === "denied") return toast("Photo access is off for Nucleus.", "image-off-outline");
          if (!next) return;
          setPhoto(next);
        }}
        style={{ marginBottom: 8 }}
      />
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
      {parsed.amount == null ? <T muted style={{ fontSize: 12, marginTop: 8 }}>No total found yet. You can still type the amount.</T> : <T style={{ fontSize: 12, marginTop: 8 }} testID="receipt-words">{words.shop || "Shop"} · {words.amount} · {words.date}</T>}
      <T muted style={{ fontSize: 12, marginTop: 8 }} testID="receipt-crop">The photo is cropped to the page ({page.w}×{page.h}), not a small inset.</T>
      {mismatch ? <T style={{ fontSize: 12, marginTop: 8 }} testID="receipt-mismatch">{mismatch}</T> : null}
      <View />
    </Sheet>
  );
}
