import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "../store";
import type { CustomTool, CustomToolInput } from "@core/types";
import { evaluateFormula, FUNCTION_NAMES, formulaNames } from "@core/formula";
import { num, parseNum, uid } from "@core/format";
import { duplicateKeys, nextInputKey } from "@core/builderKeys";
import type { SectionId } from "../App";

/**
 * Tool Builder on desktop, like the phone: name a few inputs, write one
 * formula, and the tool joins Tools alongside the built-ins. The builder is a
 * card in this screen; Tools opens the tool you saved.
 */
const TEMPLATES: { name: string; icon: string; inputs: [string, string, string][]; formula: string; outputLabel: string; unit?: string }[] = [
  { name: "Cost per unit", icon: "cash-multiple", inputs: [["Price", "price", ""], ["Quantity", "qty", ""]], formula: "price / qty", outputLabel: "Price per unit" },
  { name: "Paint needed", icon: "ruler-square", inputs: [["Wall width", "w", "m"], ["Wall height", "h", "m"], ["Coverage", "cover", "m²/L"]], formula: "round(w * h / cover, 2)", outputLabel: "Litres of paint", unit: "L" },
  { name: "Tile count", icon: "calculator-variant-outline", inputs: [["Floor area", "area", "m²"], ["Tile area", "tile", "m²"], ["Wastage", "waste", "%"]], formula: "ceil(area / tile * (1 + waste / 100))", outputLabel: "Tiles to buy" },
];

const emptyTool = (): CustomTool => ({
  id: uid(),
  name: "",
  icon: "puzzle-outline",
  inputs: [{ id: uid(), label: "Value", key: "a", unit: "", value: "" }],
  formula: "a * 2",
  outputLabel: "Result",
  decimals: 2,
  sendToMoney: false,
  createdAt: new Date().toISOString(),
});

export function Builder({ onJump }: { onJump: (next: SectionId, focusId?: string) => void }) {
  const { db, update } = useStore();
  const [edit, setEdit] = useState<CustomTool | null>(null);

  return (
    <>
      <header className="topbar">
        <div>
          <p className="caption">No code, no internet. Tools live in the shared document.</p>
          <h1>Tool Builder</h1>
        </div>
        <div className="right">
          <button className="primary" onClick={() => setEdit(emptyTool())} data-testid="builder-add-button">New tool</button>
        </div>
      </header>
      <div className="workcol">
        {edit ? <ToolEditor tool={edit} onClose={() => setEdit(null)} onJump={onJump} /> : null}

        {db.customTools.length === 0 && !edit ? (
          <section className="card" data-testid="builder-empty">
            <h2>Build your own calculator</h2>
            <p className="muted">Name a few inputs, write one formula, and it joins your Tools.</p>
            <button className="primary" onClick={() => setEdit(emptyTool())} data-testid="builder-empty-add">Start from scratch</button>
          </section>
        ) : null}

        {db.customTools.map((t) => (
          <section className="card" key={t.id} data-testid={`custom-tool-card-${t.id}`}>
            <div className="row">
              <div className="grow" style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0 }}>{t.name}</h2>
                <p className="muted small" style={{ margin: "2px 0 0" }}>
                  {t.inputs.length} input{t.inputs.length === 1 ? "" : "s"} · <span className="mono">{t.formula}</span>
                </p>
              </div>
              <button className="small-btn" onClick={() => onJump("tools", `custom:${t.id}`)} data-testid={`custom-tool-open-${t.id}`}>Open</button>
              <button className="small-btn" onClick={() => setEdit(t)} data-testid={`custom-tool-edit-${t.id}`}>Edit</button>
              <button
                className="small-btn"
                onClick={() => {
                  if (window.confirm(`Delete "${t.name}"? Its saved results are removed too.`))
                    update((d) => ({ ...d, customTools: d.customTools.filter((x) => x.id !== t.id) }));
                }}
                data-testid={`custom-tool-delete-${t.id}`}
              >
                Delete
              </button>
            </div>
          </section>
        ))}

        {!edit ? (
          <>
            <p className="caption">Start from a template</p>
            <nav className="tabs">
              {TEMPLATES.map((tp) => (
                <button
                  key={tp.name}
                  className="tab"
                  data-testid={`builder-template-${tp.name.replace(/\s+/g, "-").toLowerCase()}`}
                  onClick={() =>
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
                >
                  {tp.name}
                </button>
              ))}
            </nav>
          </>
        ) : null}
      </div>
    </>
  );
}

function ToolEditor({ tool, onClose, onJump }: { tool: CustomTool; onClose: () => void; onJump: (next: SectionId, focusId?: string) => void }) {
  const { db, update } = useStore();
  const [name, setName] = useState(tool.name);
  const inputs0 = tool.inputs;
  const [inputs, setInputs] = useState<CustomToolInput[]>(inputs0);
  const [formula, setFormula] = useState(tool.formula);
  const [outputLabel, setOutputLabel] = useState(tool.outputLabel);
  const [unit, setUnit] = useState(tool.unit ?? "");
  const [sendToMoney, setSendToMoney] = useState(tool.sendToMoney);
  const keyCursor = useRef(inputs.length);
  const dupKeys = duplicateKeys(inputs.map((i) => i.key));
  const addInput = () => {
    const next = nextInputKey(inputs.map((i) => i.key), keyCursor.current);
    keyCursor.current = next.cursor;
    setInputs([...inputs, { id: uid(), label: `Value ${inputs.length + 1}`, key: next.key, unit: "", value: "" }]);
  };
  const exists = db.customTools.some((t) => t.id === tool.id);

  const vars = Object.fromEntries(inputs.map((i) => [i.key, parseNum(i.value) || 1]));
  let preview = "";
  let error: string | undefined;
  try {
    preview = num(evaluateFormula(formula, vars), tool.decimals);
  } catch (e) {
    error = e instanceof Error ? e.message : "Check the formula";
  }
  const unknown = formulaNames(formula).filter((n) => !(n in vars));

  const save = () => {
    if (dupKeys.length) return;
    const next: CustomTool = { ...tool, name: name.trim() || "My tool", inputs, formula, outputLabel: outputLabel.trim() || "Result", unit: unit.trim() || undefined, sendToMoney };
    update((d) => ({ ...d, customTools: exists ? d.customTools.map((t) => (t.id === next.id ? next : t)) : [...d.customTools, next] }));
    onClose();
  };
  const row = (i: CustomToolInput, idx: number, changed: (patch: Partial<CustomToolInput>) => void): ReactNode => (
    <div className="add-row" key={i.id} style={{ alignItems: "flex-end" }}>
      <div className="field grow">
        <span>{`Input ${idx + 1}`}</span>
        <input className="filter" value={i.label} onChange={(e) => changed({ label: e.target.value })} data-testid={`builder-input-label-${idx}`} />
      </div>
      <div className="field" style={{ width: 110 }}>
        <span>Short name</span>
        <input
          className="filter mono"
          value={i.key}
          onChange={(e) => changed({ key: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })}
          data-testid={`builder-input-key-${idx}`}
        />
      </div>
      <div className="field" style={{ width: 120 }}>
        <span>Unit</span>
        <input className="filter" value={i.unit ?? ""} onChange={(e) => changed({ unit: e.target.value })} data-testid={`builder-input-unit-${idx}`} />
      </div>
      {inputs.length > 1 ? (
        <button className="link danger" onClick={() => setInputs(inputs.filter((x) => x.id !== i.id))} data-testid={`builder-input-remove-${idx}`}>✕</button>
      ) : null}
    </div>
  );

  const hasError = !!error || !!unknown.length || dupKeys.length > 0;
  return (
    <section className="card" data-testid="builder-sheet">
      <div className="row">
        <h2 style={{ margin: 0, flex: 1 }}>{exists ? "Edit tool" : "New tool"}</h2>
      </div>
      <div className="add-row">
        <div className="field grow">
          <span>Tool name</span>
          <input className="filter" value={name} onChange={(e) => setName(e.target.value)} placeholder="Paint needed" data-testid="builder-name-input" />
        </div>
      </div>
      <p className="caption">Inputs · use the short name in the formula</p>
      {inputs.map((i, idx) => row(i, idx, (patch) => setInputs(inputs.map((x) => (x.id === i.id ? { ...x, ...patch } : x)))))}
      <div className="row">
        <button className="small-btn" onClick={addInput} data-testid="builder-add-input">Add input</button>
        {dupKeys.length ? (
          <span className="small" style={{ color: "var(--error)" }} data-testid="builder-duplicate-keys">
            Duplicate input name{dupKeys.length > 1 ? "s" : ""}: {[...new Set(dupKeys)].join(", ")} — each input needs its own short name.
          </span>
        ) : null}
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <span>Formula · allowed: + - * / % ^ ( ) and {FUNCTION_NAMES.join(", ")}</span>
        <input
          className="filter mono"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          data-testid="builder-formula-input"
          autoComplete="off"
        />
      </div>
      <div className="add-row">
        <div className="field grow">
          <span>Result label</span>
          <input className="filter" value={outputLabel} onChange={(e) => setOutputLabel(e.target.value)} data-testid="builder-output-input" />
        </div>
        <div className="field" style={{ width: 120 }}>
          <span>Result unit</span>
          <input className="filter" value={unit} onChange={(e) => setUnit(e.target.value)} data-testid="builder-unit-input" />
        </div>
      </div>
      <label className="row" style={{ cursor: "pointer", marginBottom: 10 }}>
        <input type="checkbox" checked={sendToMoney} onChange={(e) => setSendToMoney(e.target.checked)} data-testid="builder-money-switch" />
        <span className="small muted">Offer "Add as expense" when the result is money</span>
      </label>
      <div className="resultbox" data-testid="builder-preview">
        <p className="resultcap">Preview</p>
        {unknown.length ? (
          <p className="small" style={{ color: "var(--error)" }} data-testid="builder-unknown">
            Unknown name{unknown.length > 1 ? "s" : ""}: {unknown.join(", ")} — add an input with that short name.
          </p>
        ) : error ? (
          <p className="small" style={{ color: "var(--error)" }} data-testid="builder-error">{error}</p>
        ) : (
          <>
            <p className="resultval" data-testid="builder-preview-value">
              {preview}
              {unit ? ` ${unit}` : ""}
            </p>
            <p className="small" style={{ opacity: 0.75 }}>
              with every input treated as {inputs.map((i) => `${i.key}=${parseNum(i.value) || 1}`).join(", ")}
            </p>
          </>
        )}
      </div>
      <div className="row">
        <button className="primary" disabled={!!error || !!unknown.length || dupKeys.length > 0} onClick={save} data-testid="builder-save-button">
          {exists ? "Save tool" : "Create tool"}
        </button>
        <button className="small-btn" onClick={onClose}>Close</button>
        {exists ? (
          <button
            className="small-btn"
            style={{ color: "var(--error)" }}
            onClick={() => {
              if (window.confirm("Delete this tool? Its saved results are removed too.")) {
                update((d) => ({ ...d, customTools: d.customTools.filter((x) => x.id !== tool.id) }));
                onClose();
              }
            }}
            data-testid="builder-delete-button"
          >
            Delete tool
          </button>
        ) : null}
        {exists && !hasError ? null : null}
        {dupKeys.length > 0 && exists ? null : null}
      </div>
    </section>
  );
}
