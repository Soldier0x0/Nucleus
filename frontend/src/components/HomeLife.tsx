import React, { useState } from "react";
import { View } from "react-native";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { UTILITY_KINDS, choreDueDate, completeChore, roomSummaries, utilityEstimate } from "@/src/core/domains";
import { dueDayLabel } from "@/src/core/life";
import type { Chore, HomeSpec, UtilityBill, UtilityKind } from "@/src/core/types";
import { fmtDate, num, parseNum, todayISO, uid } from "@/src/core/format";
import { Amount, Button, Card, Chip, ChipRow, EmptyState, Eyebrow, Icon, IconButton, Segmented, StatusBadge, T } from "@/src/components/ui";
import { LineChart } from "@/src/components/charts";
import { Sheet } from "@/src/components/Sheet";
import { DateField, Field } from "@/src/components/inputs";
import { useToast } from "@/src/components/Toast";
import { PhotoNote } from "@/src/components/PhotoPick";

const CHORE_EVERY = [
  { value: "1", label: "Daily" },
  { value: "7", label: "Weekly" },
  { value: "14", label: "2 weeks" },
  { value: "30", label: "Monthly" },
];

/** Rooms, utility bills and chores. Appliances stay on the Home screen itself. */
export function HomeLife({ showEmpty, onAddAppliance }: { showEmpty: boolean; onAddAppliance?: () => void }) {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const [bill, setBill] = useState<UtilityBill | null>(null);
  const [chore, setChore] = useState<Chore | "new" | null>(null);
  const [spec, setSpec] = useState(false);
  const rooms = roomSummaries(db);
  const today = todayISO();

  if (showEmpty) {
    return (
      <>
        <EmptyState
          testID="home-empty"
          icon="home-outline"
          title="Your home, organized"
          body="Appliances and warranties, meter bills, and the chores that come around again. Nucleus warns you before something is due."
          action={
            <View style={{ gap: 8, alignSelf: "stretch" }}>
              <Button label="Add appliance" icon="plus" testID="home-empty-add-button" onPress={onAddAppliance} />
              <Button kind="secondary" label="Add a bill" icon="flash" testID="home-empty-bill" onPress={() => setBill(blankBill())} />
              <Button kind="ghost" label="Add a chore" icon="broom" testID="home-empty-chore" onPress={() => setChore("new")} />
              <Button kind="ghost" label="Add a shop note" icon="tag-outline" testID="home-empty-spec" onPress={() => setSpec(true)} />
            </View>
          }
        />
        {spec ? <SpecSheet onClose={() => setSpec(false)} /> : null}
        {bill ? <BillSheet bill={bill} onClose={() => setBill(null)} /> : null}
        {chore ? <ChoreSheet chore={chore === "new" ? undefined : chore} onClose={() => setChore(null)} /> : null}
      </>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {rooms.length ? (
        <View>
          <Eyebrow style={{ marginBottom: 8 }}>Rooms</Eyebrow>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {rooms.map((r) => (
              <View key={r.room} testID={`home-room-card-${r.room}`} style={{ width: "48%", flexGrow: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, backgroundColor: colors.surfaceSecondary, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <T v="label" numberOfLines={1} style={{ flex: 1 }}>{r.room}</T>
                  <StatusBadge severity={r.status === "ok" ? "ok" : r.status} />
                </View>
                <T muted style={{ fontSize: 12 }} numberOfLines={2}>
                  {r.status === "ok" ? `${r.appliances} appliance${r.appliances === 1 ? "" : "s"} · ${r.chores} chore${r.chores === 1 ? "" : "s"}` : r.line}
                </T>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Card testID="home-specs">
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Eyebrow style={{ flex: 1 }}>Shop notes</Eyebrow>
          <IconButton icon="plus" label="Add a spec" testID="spec-add" onPress={() => setSpec(true)} />
        </View>
        {db.specs.length === 0 ? <T muted style={{ marginTop: 6 }}>Filter size, bulb, paint code — the fact you need while you are in the shop.</T> : db.specs.map((s) => (
          <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <T v="label">{s.label}</T>
              <T muted style={{ fontSize: 12 }}>{[s.value, s.room].filter(Boolean).join(" · ")}</T>
            </View>
            <IconButton icon="close" label="Remove spec" testID={`spec-remove-${s.id}`} onPress={() => update((d) => ({ ...d, specs: d.specs.filter((x) => x.id !== s.id) }))} />
          </View>
        ))}
      </Card>

      <Card testID="home-utilities">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Eyebrow>Utilities</Eyebrow>
          <IconButton icon="plus" label="Add bill" testID="utility-add-button" onPress={() => setBill(blankBill())} />
        </View>
        {db.utilities.length === 0 ? <T muted>Log a bill to see the usual amount next time.</T> : null}
        {UTILITY_KINDS.map((k) => {
          const est = utilityEstimate(db.utilities, k.id);
          if (!est.rows.length) return null;
          const points = est.rows.slice(-6).map((r) => r.amount);
          return (
            <View key={k.id} testID={`utility-${k.id}`} style={{ marginTop: 12, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name={k.icon} size={18} color={colors.muted} />
                <T v="label" style={{ flex: 1 }}>{k.label}</T>
                {est.last ? (
                  <Button small kind="ghost" label="Edit last" testID={`utility-edit-${k.id}`} onPress={() => setBill(est.last!)} />
                ) : null}
                {est.last ? <Amount value={est.last.amount} v="mono" /> : null}
              </View>
              <T muted style={{ fontSize: 12 }} numberOfLines={2}>
                {est.last ? fmtDate(est.last.date) : ""}
                {est.last?.reading ? ` · reading ${num(est.last.reading, 0)} ${k.unit}`.trim() : ""}
                {est.usual ? " · usual " : ""}
                {est.usual ? <Amount value={est.usual} v="mono" /> : null}
              </T>
              {points.length > 1 ? <LineChart data={points} width={220} height={56} testID={`utility-chart-${k.id}`} /> : null}
            </View>
          );
        })}
      </Card>

      <Card testID="home-chores">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Eyebrow>Chores</Eyebrow>
          <IconButton icon="plus" label="Add chore" testID="chore-add-button" onPress={() => setChore("new")} />
        </View>
        {db.chores.length === 0 ? <T muted>Recurring jobs, with an optional room and person.</T> : null}
        {db.chores.map((c) => {
          const d = choreDueDate(c, today);
          const dueLabel = dueDayLabel(d);
          return (
            <View key={c.id} testID={`chore-${c.id}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, marginTop: 8 }}>
              <StatusBadge severity={d < 0 ? "urgent" : d <= 1 ? "upcoming" : "ok"} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="label" numberOfLines={1}>{c.name}</T>
                <T muted style={{ fontSize: 12 }} numberOfLines={1}>{[c.room, c.assignee, dueLabel].filter(Boolean).join(" · ")}</T>
              </View>
              <Button small kind="secondary" label="Done" icon="check" testID={`chore-done-${c.id}`} onPress={() => (update((draft) => completeChore(draft, c.id)), toast(`${c.name} done`, "check"))} />
              <IconButton icon="pencil-outline" label="Edit chore" testID={`chore-edit-${c.id}`} onPress={() => setChore(c)} />
            </View>
          );
        })}
      </Card>

      {spec ? <SpecSheet onClose={() => setSpec(false)} /> : null}
      {bill ? <BillSheet bill={bill} onClose={() => setBill(null)} /> : null}
      {chore ? <ChoreSheet chore={chore === "new" ? undefined : chore} onClose={() => setChore(null)} /> : null}
    </View>
  );
}

function SpecSheet({ onClose }: { onClose: () => void }) {
  const { update } = useStore();
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [room, setRoom] = useState("");
  const save = () => {
    if (!label.trim() || !value.trim()) return toast("Add a label and the value", "tag-outline");
    const next: HomeSpec = { id: uid(), label: label.trim(), value: value.trim(), room: room.trim() || undefined };
    update((d) => ({ ...d, specs: [...d.specs, next] }));
    toast("Saved", "tag-outline");
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title="Shop note" testID="spec-sheet" footer={<Button label="Save" icon="check" testID="spec-save" onPress={save} />}>
      <Field label="What" testID="spec-label" value={label} onChangeText={setLabel} placeholder="AC filter" />
      <Field label="Value" testID="spec-value" value={value} onChangeText={setValue} placeholder="1.5 ton, 450 × 400" />
      <Field label="Room" testID="spec-room" value={room} onChangeText={setRoom} placeholder="Optional" />
    </Sheet>
  );
}

function blankBill(): UtilityBill {
  return { id: uid(), kind: "electricity", date: todayISO(), amount: 0 };
}

function BillSheet({ bill, onClose }: { bill: UtilityBill; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [kind, setKind] = useState<UtilityKind>(bill.kind);
  const [amount, setAmount] = useState(bill.amount ? String(bill.amount) : "");
  const [reading, setReading] = useState(bill.reading ? String(bill.reading) : "");
  const [date, setDate] = useState(bill.date);
  const [note, setNote] = useState(bill.note ?? "");
  const [photo, setPhoto] = useState(bill.photo);
  const meta = UTILITY_KINDS.find((k) => k.id === kind)!;
  const save = () => {
    const value = parseNum(amount);
    if (!value) return toast("Enter the amount you paid", "alert-circle-outline");
    const next: UtilityBill = { ...bill, kind, date, amount: value, reading: parseNum(reading) || undefined, note: note.trim() || undefined, photo };
    update((d) => ({ ...d, utilities: [next, ...d.utilities.filter((u) => u.id !== next.id)] }));
    toast(`${meta.label} bill saved`, meta.icon);
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title="Utility bill" testID="utility-sheet" footer={<Button label="Save bill" icon="check" testID="utility-save" onPress={save} />}>
      <ChipRow testID="utility-kind-row">
        {UTILITY_KINDS.map((k) => (
          <Chip key={k.id} label={k.label} icon={k.icon} selected={kind === k.id} testID={`utility-kind-${k.id}`} onPress={() => setKind(k.id)} />
        ))}
      </ChipRow>
      <Field numeric label="Amount paid" unit={db.settings.currency} testID="utility-amount-input" value={amount} onChangeText={setAmount} placeholder="0" />
      <Field numeric label={meta.unit ? `Meter reading (${meta.unit})` : "Reading (optional)"} testID="utility-reading-input" value={reading} onChangeText={setReading} placeholder="Optional" />
      <DateField label="Bill date" value={date} onChange={(v) => v && setDate(v)} testID="utility-date" />
      <Field label="Note" testID="utility-note-input" value={note} onChangeText={setNote} placeholder="Optional" />
      <PhotoNote uri={photo} onChange={setPhoto} testID="utility-photo" />
    </Sheet>
  );
}

function ChoreSheet({ chore, onClose }: { chore?: Chore; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [name, setName] = useState(chore?.name ?? "");
  const [every, setEvery] = useState(String(chore?.everyDays ?? 7));
  const [room, setRoom] = useState(chore?.room ?? "");
  const [assignee, setAssignee] = useState(chore?.assignee ?? "");
  const save = () => {
    if (!name.trim()) return toast("Name the chore", "alert-circle-outline");
    const next: Chore = { id: chore?.id ?? uid(), name: name.trim(), everyDays: Number(every), lastDone: chore?.lastDone ?? todayISO(), room: room || undefined, assignee: assignee.trim() || undefined };
    update((d) => ({ ...d, chores: d.chores.some((c) => c.id === next.id) ? d.chores.map((c) => (c.id === next.id ? next : c)) : [...d.chores, next] }));
    toast(chore ? "Chore updated" : "Chore added", "broom");
    onClose();
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={chore ? "Edit chore" : "Add chore"}
      testID="chore-sheet"
      footer={<Button label="Save chore" icon="check" testID="chore-save" onPress={save} />}
    >
      <Field label="Name" testID="chore-name-input" value={name} onChangeText={setName} placeholder="Take the bins out" />
      <T v="caption" muted style={{ marginBottom: 6 }}>Repeats</T>
      <Segmented testID="chore-every" value={every} onChange={setEvery} options={CHORE_EVERY} />
      <View style={{ height: 12 }} />
      <T v="caption" muted style={{ marginBottom: 6 }}>Room</T>
      <ChipRow testID="chore-room-row">
        <Chip label="None" selected={!room} onPress={() => setRoom("")} testID="chore-room-none" />
        {["Kitchen", "Living", "Bedroom", "Bathroom", "Utility", "Garage", "Other"].map((r) => (
          <Chip key={r} label={r} selected={room === r} onPress={() => setRoom(r)} testID={`chore-room-${r}`} />
        ))}
      </ChipRow>
      {db.people.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {db.people.map((p) => (
            <Chip key={p.id} label={p.name} selected={assignee === p.name} testID={`chore-person-${p.id}`} onPress={() => setAssignee(p.name)} />
          ))}
        </View>
      ) : null}
      <Field label="Who does it" testID="chore-assignee-input" value={assignee} onChangeText={setAssignee} placeholder="Optional" />
      {chore ? (
        <Button
          kind="danger"
          small
          icon="delete-outline"
          label="Delete chore"
          testID="chore-delete"
          style={{ marginTop: 8 }}
          onPress={() => (update((d) => ({ ...d, chores: d.chores.filter((c) => c.id !== chore.id) })), onClose())}
        />
      ) : null}
      <T muted style={{ fontSize: 12, marginTop: 8 }}>A new chore starts as done today, so the first reminder is one interval away.</T>
    </Sheet>
  );
}
