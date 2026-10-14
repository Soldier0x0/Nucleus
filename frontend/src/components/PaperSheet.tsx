import React, { useState } from "react";
import { View } from "react-native";
import { useStore } from "@/src/core/store";
import { removePaper } from "@/src/core/actions";
import { PAPER_KINDS } from "@/src/core/life";
import type { MotorCover, Paper } from "@/src/core/types";
import { uid } from "@/src/core/format";
import { extractFromPdfDataUri, mergeExtract } from "@/src/core/paperExtract";
import { storePaperFile } from "@/src/core/paperFiles";
import { applyMotorXor, syncVehicleExpiryFields } from "@/src/core/vehicleDocs";
import { Button, Chip, ChipRow, Eyebrow } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { DateField, Field } from "@/src/components/inputs";
import { PaperAttach } from "@/src/components/PaperAttach";
import { useToast } from "@/src/components/Toast";

export function PaperSheet({ paper, onClose, onDeleted }: { paper?: Paper; onClose: () => void; onDeleted?: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [confirmDel, setConfirmDel] = useState(false);
  const paperId = paper?.id ?? uid();
  const [f, setF] = useState({
    kind: paper?.kind ?? ("licence" as Paper["kind"]),
    title: paper?.title ?? "",
    number: paper?.number ?? "",
    expiry: paper?.expiry,
    note: paper?.note ?? "",
    file: paper?.file ?? paper?.photo,
    mime: paper?.mime,
    motorCover: paper?.motorCover,
    rsaAddOn: paper?.rsaAddOn === true,
    zeroDepAddOn: paper?.zeroDepAddOn === true,
    insurer: paper?.insurer ?? "",
    personId: paper?.personId,
    vehicleId: paper?.vehicleId,
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!f.title.trim()) return toast("Name the paper", "file-document-outline");
    let storedFile = f.file;
    if (storedFile && f.mime) storedFile = await storePaperFile(paperId, storedFile, f.mime);
    let draft: Paper = {
      id: paperId,
      createdAt: paper?.createdAt ?? new Date().toISOString(),
      kind: f.kind,
      title: f.title.trim(),
      number: f.number.trim() || undefined,
      expiry: f.expiry,
      note: f.note.trim() || undefined,
      file: storedFile,
      mime: f.mime,
      personId: f.personId,
      vehicleId: f.vehicleId,
      insurer: f.insurer.trim() || undefined,
    };
    if (f.kind === "insurance" && f.vehicleId && f.motorCover) {
      draft.motorCover = f.motorCover;
      draft.rsaAddOn = f.rsaAddOn;
      draft.zeroDepAddOn = f.zeroDepAddOn;
    }
    if (storedFile?.startsWith("data:application/pdf")) draft = mergeExtract(draft, extractFromPdfDataUri(storedFile));
    update((d) => {
      let papers = applyMotorXor(d, draft);
      let next = { ...d, papers };
      if (draft.vehicleId) next = syncVehicleExpiryFields(next, draft.vehicleId);
      return next;
    });
    toast(paper ? "Paper updated" : "Paper saved", "file-document-outline");
    onClose();
  };
  const motor = f.kind === "insurance" && !!f.vehicleId;
  return (
    <>
      <Sheet visible onClose={onClose} title={paper ? "Edit paper" : "Add paper"} testID="paper-sheet" footer={<Button label="Save paper" icon="check" testID="paper-save" onPress={() => save().catch(() => toast("Could not save the file"))} />}>
        <ChipRow testID="paper-kind-row">
          {PAPER_KINDS.map((k) => (
            <Chip key={k.id} label={k.label} selected={f.kind === k.id} testID={`paper-kind-${k.id}`} onPress={() => set({ kind: k.id, title: f.title || k.label })} />
          ))}
        </ChipRow>
        <Field label="Title" testID="paper-title" value={f.title} onChangeText={(t) => set({ title: t })} placeholder="Driving licence" />
        <Field label="Number" testID="paper-number" value={f.number} onChangeText={(t) => set({ number: t })} placeholder="Optional" autoCapitalize="characters" />
        <DateField label="Expiry" optional testID="paper-expiry" value={f.expiry} onChange={(v) => set({ expiry: v })} />
        {motor ? (
          <>
            <Eyebrow style={{ marginBottom: 8 }}>Motor cover</Eyebrow>
            <ChipRow testID="paper-motor-row">
              {(["comprehensive", "third-party"] as MotorCover[]).map((cover) => (
                <Chip key={cover} label={cover === "comprehensive" ? "Comprehensive" : "Third-party"} selected={f.motorCover === cover} testID={`paper-motor-${cover}`} onPress={() => set({ motorCover: cover })} />
              ))}
            </ChipRow>
            <Chip label="Roadside assistance add-on" selected={f.rsaAddOn} testID="paper-rsa" onPress={() => set({ rsaAddOn: !f.rsaAddOn })} />
            <Chip label="Zero depreciation add-on" selected={f.zeroDepAddOn} testID="paper-zerodep" onPress={() => set({ zeroDepAddOn: !f.zeroDepAddOn })} />
            <Field label="Insurer" testID="paper-insurer" value={f.insurer} onChangeText={(t) => set({ insurer: t })} placeholder="Optional" />
          </>
        ) : null}
        {db.people.length ? (
          <>
            <Eyebrow style={{ marginBottom: 8 }}>Whose</Eyebrow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {db.people.map((p) => (
                <Chip key={p.id} label={p.name} selected={f.personId === p.id} testID={`paper-person-${p.id}`} onPress={() => set({ personId: f.personId === p.id ? undefined : p.id })} />
              ))}
            </View>
          </>
        ) : null}
        {db.vehicles.length ? (
          <>
            <Eyebrow style={{ marginBottom: 8 }}>Vehicle</Eyebrow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {db.vehicles.map((v) => (
                <Chip key={v.id} label={v.name} selected={f.vehicleId === v.id} testID={`paper-vehicle-${v.id}`} onPress={() => set({ vehicleId: f.vehicleId === v.id ? undefined : v.id })} />
              ))}
            </View>
          </>
        ) : null}
        <Field label="Note" testID="paper-note" value={f.note} onChangeText={(t) => set({ note: t })} placeholder="Optional" />
        <PaperAttach paperId={paperId} uri={f.file} mime={f.mime} testID="paper-photo" onChange={({ uri, mime }) => set({ file: uri, mime })} />
        {paper ? <Button kind="danger" label="Delete paper" testID="paper-delete" onPress={() => setConfirmDel(true)} /> : null}
      </Sheet>
      <ConfirmSheet
        visible={confirmDel}
        id="paper-delete"
        title="Delete this paper?"
        body="The file and expiry reminders for this document will be removed from Nucleus. This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => {
          if (!paper) return;
          update((d) => removePaper(d, paper.id));
          setConfirmDel(false);
          onClose();
          onDeleted?.();
          toast("Paper deleted", "delete-outline");
        }}
      />
    </>
  );
}
