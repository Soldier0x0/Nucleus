import React, { useRef, useState } from "react";
import { Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import type { CustomTool, CustomToolInput } from "@/src/core/types";
import { evaluateFormula, FUNCTION_NAMES, formulaNames } from "@/src/core/formula";
import { num, parseNum, uid } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Button, Card, Chip, EmptyState, Eyebrow, Icon, IconButton, T } from "@/src/components/ui";
import { Field } from "@/src/components/inputs";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { ModuleGate } from "@/src/components/ModuleGate";

const ICONS = ["puzzle-outline", "calculator-variant-outline", "ruler-square", "flask-outline", "percent-outline", "cash-multiple"];

const TEMPLATES: { name: string; icon: string; inputs: [string, string, string][]; formula: string; outputLabel: string; unit?: string }[] = [
  { name: "Cost per unit", icon: "cash-multiple", inputs: [["Price", "price", ""], ["Quantity", "qty", ""]], formula: "price / qty", outputLabel: "Price per unit" },
  { name: "Paint needed", icon: "ruler-square", inputs: [["Wall width", "w", "m"], ["Wall height", "h", "m"], ["Coverage", "cover", "m²/L"]], formula: "round(w * h / cover, 2)", outputLabel: "Litres of paint", unit: "L" },
  { name: "Tile count", icon: "calculator-variant-outline", inputs: [["Floor area", "area", "m²"], ["Tile area", "tile", "m²"], ["Wastage", "waste", "%"]], formula: "ceil(area / tile * (1 + waste / 100))", outputLabel: "Tiles to buy" },
];

const emptyTool = (): CustomTool => ({ id: uid(), name: "", icon: ICONS[0], inputs: [{ id: uid(), label: "Value", key: "a", unit: "", value: "" }], formula: "a * 2", outputLabel: "Result", decimals: 2, sendToMoney: false, createdAt: new Date().toISOString() });

export default function Builder() {
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState<CustomTool | null>(null);
  const [pendingDel, setPendingDel] = useState<string | null>(null);
  const pendingTool = db.customTools.find((t) => t.id === pendingDel);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Tool Builder" testID="builder-header" right={<IconButton icon="plus" label="New tool" testID="builder-add-button" onPress={() => setEdit(emptyTool())} />} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: sp.md, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {db.customTools.length === 0 ? (
          <EmptyState
            testID="builder-empty"
            icon="puzzle-outline"
            title="Build your own calculator"
            body="Name a few inputs, write one formula, and it joins your Tools. No code, no internet."
            action={<Button label="Start from scratch" icon="plus" testID="builder-empty-add" onPress={() => setEdit(emptyTool())} />}
          />
        ) : null}

        {db.customTools.map((t) => (
          <Card key={t.id} testID={`custom-tool-card-${t.id}`}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
                <Icon name={t.icon} size={20} color={colors.onBrandTertiary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="h2" numberOfLines={1}>
                  {t.name}
                </T>
                <T muted style={{ fontSize: 12 }} numberOfLines={1}>
                  {t.inputs.length} input{t.inputs.length === 1 ? "" : "s"} · {t.formula}
                </T>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <Button small label="Open" icon="play-outline" testID={`custom-tool-open-${t.id}`} onPress={() => router.push(`/tools?tool=custom:${t.id}`)} />
              <Button small kind="secondary" label="Edit" icon="pencil-outline" testID={`custom-tool-edit-${t.id}`} onPress={() => setEdit(t)} />
              <Button
                small
                kind="ghost"
                label="Delete"
                icon="delete-outline"
                testID={`custom-tool-delete-${t.id}`}
                onPress={() => setPendingDel(t.id)}
              />
            </View>
          </Card>
        ))}

        <Eyebrow style={{ marginTop: 8 }}>Start from a template</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {TEMPLATES.map((tp) => (
            <Chip
              key={tp.name}
              label={tp.name}
              icon={tp.icon}
              testID={`builder-template-${tp.name.replace(/\s+/g, "-").toLowerCase()}`}
              onPress={() =>
                setEdit({
                  ...emptyTool(),
                  name: tp.name,
                  icon: tp.icon,
                  inputs: tp.inputs.map(([label, key, unit]) => ({ id: uid(), label, key, unit, value: "" })),
                  formula: tp.formula,
                  outputLabel: tp.outputLabel,
                  unit: tp.unit,
                })
              }
            />
          ))}
        </View>
      </KeyboardAwareScrollView>
      {edit ? <ToolSheet tool={edit} onClose={() => setEdit(null)} /> : null}
      <Sheet visible={!!pendingTool} onClose={() => setPendingDel(null)} title="Delete this tool?" testID="builder-delete-sheet">
        <T style={{ marginBottom: 16 }}>{pendingTool ? `“${pendingTool.name}” and its saved results will be removed. This can't be undone.` : ""}</T>
        <Button
          kind="danger"
          label="Delete"
          icon="delete-outline"
          testID="builder-delete-confirm"
          onPress={() => {
            if (pendingTool) update((d) => ({ ...d, customTools: d.customTools.filter((x) => x.id !== pendingTool.id) }));
            setPendingDel(null);
            toast("Tool deleted", "delete-outline");
          }}
        />
      </Sheet>
      <ModuleGate id="builder" name="Tool Builder" icon="puzzle-outline" />
    </View>
  );
}

function ToolSheet({ tool, onClose }: { tool: CustomTool; onClose: () => void }) {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const [name, setName] = useState(tool.name);
  const [icon, setIcon] = useState(tool.icon);
  const [inputs, setInputs] = useState<CustomToolInput[]>(tool.inputs);
  const [formula, setFormula] = useState(tool.formula);
  const [outputLabel, setOutputLabel] = useState(tool.outputLabel);
  const [unit, setUnit] = useState(tool.unit ?? "");
  const [sendToMoney, setSendToMoney] = useState(tool.sendToMoney);
  const [confirmDel, setConfirmDel] = useState(false);
  const keyCursor = useRef(inputs.length);
  const usedKeys = new Set(inputs.map((i) => i.key));
  const dupKeys = inputs.filter((i, idx) => inputs.findIndex((x) => x.key === i.key) !== idx).map((i) => i.key);
  const nextKey = () => {
    for (let n = keyCursor.current; ; n++) {
      const k = n < 26 ? String.fromCharCode(97 + n) : `k${n}`;
      if (!usedKeys.has(k)) {
        keyCursor.current = n + 1;
        return k;
      }
    }
  };
  const exists = db.customTools.some((t) => t.id === tool.id);

  const vars = Object.fromEntries(inputs.map((i) => [i.key, parseNum(i.value) || 1]));
  let preview = "";
  let error: string | undefined;
  try {
    preview = num(evaluateFormula(formula, vars), tool.decimals);
  } catch (e: any) {
    error = e?.message ?? "Check the formula";
  }
  const unknown = formulaNames(formula).filter((n) => !(n in vars));

  const save = () => {
    if (dupKeys.length) {
      toast("Two inputs share a short name — rename one before saving", "alert-circle-outline");
      return;
    }
    const next: CustomTool = { ...tool, name: name.trim() || "My tool", icon, inputs, formula, outputLabel: outputLabel.trim() || "Result", unit: unit.trim() || undefined, sendToMoney };
    update((d) => ({ ...d, customTools: exists ? d.customTools.map((t) => (t.id === next.id ? next : t)) : [...d.customTools, next] }));
    toast(exists ? "Tool updated" : "Tool added to Tools", "puzzle-outline");
    onClose();
  };

  return (
    <>
    <Sheet visible onClose={onClose} title={exists ? "Edit tool" : "New tool"} testID="builder-sheet" footer={<Button label={exists ? "Save tool" : "Create tool"} icon="check" testID="builder-save-button" disabled={!!error || !!unknown.length} onPress={save} />}>
      <Field label="Tool name" testID="builder-name-input" value={name} onChangeText={setName} placeholder="Paint needed" />
      <Eyebrow style={{ marginBottom: 8 }}>Icon</Eyebrow>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {ICONS.map((i) => (
          <Chip key={i} label="" icon={i} selected={icon === i} testID={`builder-icon-${i}`} onPress={() => setIcon(i)} />
        ))}
      </View>

      <Eyebrow style={{ marginBottom: 8 }}>Inputs · use the short name in the formula</Eyebrow>
      {inputs.map((i, idx) => (
        <View key={i.id} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <Field style={{ flex: 2 }} label={`Input ${idx + 1}`} testID={`builder-input-label-${idx}`} value={i.label} onChangeText={(t) => setInputs(inputs.map((x) => (x.id === i.id ? { ...x, label: t } : x)))} />
          <Field style={{ flex: 1 }} label="Name" testID={`builder-input-key-${idx}`} value={i.key} autoCapitalize="none" onChangeText={(t) => setInputs(inputs.map((x) => (x.id === i.id ? { ...x, key: t.replace(/[^A-Za-z0-9_]/g, "") } : x)))} />
          <Field style={{ flex: 1 }} label="Unit" testID={`builder-input-unit-${idx}`} value={i.unit ?? ""} onChangeText={(t) => setInputs(inputs.map((x) => (x.id === i.id ? { ...x, unit: t } : x)))} />
          {inputs.length > 1 ? <IconButton icon="close" label="Remove input" testID={`builder-input-remove-${idx}`} onPress={() => setInputs(inputs.filter((x) => x.id !== i.id))} /> : null}
        </View>
      ))}
      <Button small kind="ghost" icon="plus" label="Add input" testID="builder-add-input" style={{ alignSelf: "flex-start", marginBottom: 16 }} onPress={() => setInputs([...inputs, { id: uid(), label: `Value ${inputs.length + 1}`, key: nextKey(), unit: "", value: "" }])} />
      {dupKeys.length ? (
        <T style={{ color: colors.error, marginTop: -8, marginBottom: 16 }} testID="builder-duplicate-keys">
          Duplicate input name{dupKeys.length > 1 ? "s" : ""}: {[...new Set(dupKeys)].join(", ")} — each input needs its own short name.
        </T>
      ) : null}

      <Field label="Formula" testID="builder-formula-input" value={formula} onChangeText={setFormula} autoCapitalize="none" hint={`Allowed: + - * / % ^ ( ) and ${FUNCTION_NAMES.join(", ")}`} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field style={{ flex: 2 }} label="Result label" testID="builder-output-input" value={outputLabel} onChangeText={setOutputLabel} />
        <Field style={{ flex: 1 }} label="Result unit" testID="builder-unit-input" value={unit} onChangeText={setUnit} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Switch testID="builder-money-switch" value={sendToMoney} onValueChange={setSendToMoney} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.surfaceSecondary} />
        <T style={{ flex: 1 }}>Offer &quot;Add as expense&quot; when the result is money</T>
      </View>

      <View style={{ backgroundColor: error || unknown.length ? colors.surfaceSecondary : colors.surfaceInverse, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border }} testID="builder-preview">
        <T v="caption" color={error || unknown.length ? colors.muted : colors.onSurfaceInverse} style={{ letterSpacing: 1 }}>
          PREVIEW
        </T>
        {unknown.length ? (
          <T style={{ color: colors.error, marginTop: 6 }} testID="builder-unknown">
            Unknown name{unknown.length > 1 ? "s" : ""}: {unknown.join(", ")} — add an input with that short name.
          </T>
        ) : error ? (
          <T style={{ color: colors.error, marginTop: 6 }} testID="builder-error">
            {error}
          </T>
        ) : (
          <>
            <T v="monoXl" color={colors.onSurfaceInverse} style={{ marginTop: 6 }} testID="builder-preview-value">
              {preview}
              {unit ? ` ${unit}` : ""}
            </T>
            <T color={colors.onSurfaceInverse} style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
              with every input treated as {inputs.map((i) => `${i.key}=${parseNum(i.value) || 1}`).join(", ")}
            </T>
          </>
        )}
      </View>

      {exists ? (
        <Button
          kind="danger"
          small
          icon="delete-outline"
          label="Delete tool"
          testID="builder-delete-button"
          style={{ marginTop: 16 }}
          onPress={() => setConfirmDel(true)}
        />
      ) : null}
    </Sheet>
    <Sheet visible={confirmDel} onClose={() => setConfirmDel(false)} title="Delete this tool?" testID="builder-delete-sheet">
      <T style={{ marginBottom: 16 }}>This tool and its saved results will be removed. This can't be undone.</T>
      <Button
        kind="danger"
        label="Delete tool"
        icon="delete-outline"
        testID="builder-delete-confirm"
        onPress={() => {
          update((d) => ({ ...d, customTools: d.customTools.filter((x) => x.id !== tool.id) }));
          setConfirmDel(false);
          onClose();
        }}
      />
    </Sheet>
    </>
  );
}
