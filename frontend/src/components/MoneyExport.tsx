import { useState } from "react";
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { useStore } from "@/src/core/store";
import { copyTemporary } from "@/src/core/clipboard";
import { exportBounds, moneyCsv, type ExportSpan } from "@/src/core/moneyWords";
import { yearlyMoneyCsv } from "@/src/core/moneyDesk";
import { todayISO } from "@/src/core/format";
import { DateField } from "./inputs";
import { Sheet } from "./Sheet";
import { Button, Chip, ChipRow, T } from "./ui";
import { useToast } from "./Toast";

const SPANS: { id: ExportSpan | "year"; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "30", label: "Past 30 days" },
  { id: "60", label: "Past 60 days" },
  { id: "year", label: "This year" },
  { id: "custom", label: "Custom" },
];

export function MoneyExport({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { db } = useStore();
  const toast = useToast();
  const today = todayISO();
  const [span, setSpan] = useState<ExportSpan | "year">("month");
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);

  const share = async () => {
    const bounds = span === "year" ? { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` } : exportBounds(today, span, from, to);
    const csv = span === "year" ? yearlyMoneyCsv(db.txns, db.settings.currency, today.slice(0, 4)) : moneyCsv(db.txns, db.settings.currency, bounds.from, bounds.to);
    if (Platform.OS === "web") {
      await copyTemporary(csv);
      toast("Spreadsheet copied · clears in 1 min", "content-copy");
      onClose();
      return;
    }
    const file = new File(Paths.cache, `nucleus-spending-${bounds.from}-to-${bounds.to}.csv`);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Spending spreadsheet" });
    } else {
      await copyTemporary(csv);
      toast("CSV copied · clears in 1 min", "content-copy");
    }
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Export spending" testID="money-export-sheet" footer={<Button label="Share CSV" icon="download-outline" onPress={share} testID="money-export-share" />}>
      <T muted style={{ marginBottom: 10 }}>
        A file on this phone. Weekly and monthly totals, then each transaction. Nothing is uploaded.
      </T>
      <ChipRow testID="money-export-spans">
        {SPANS.map((s) => (
          <Chip key={s.id} label={s.label} selected={span === s.id} onPress={() => setSpan(s.id)} testID={`money-export-${s.id}`} />
        ))}
      </ChipRow>
      {span === "custom" ? (
        <>
          <DateField label="From" value={from} onChange={(v) => setFrom(v ?? today)} testID="money-export-from" />
          <DateField label="To" value={to} onChange={(v) => setTo(v ?? today)} testID="money-export-to" />
        </>
      ) : null}
    </Sheet>
  );
}
