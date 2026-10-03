/**
 * A pack is a file of templates, tools, checklists and rules.
 * Importing adds only the rows you approve. It does not replace the document.
 */
import type { CustomTool, DB, PackingTemplate, Rule } from "./types";
import { PACK_TEMPLATES } from "./domains";
import { uid } from "./format";

export const PACK_FORMAT = "nucleus-pack";

export type PackTemplate = { name: string; groups: { category: string; items: string[] }[] };
export type PackChecklist = { title: string; items: string[] };
export type PackFile = {
  format: typeof PACK_FORMAT;
  schema: 1;
  name: string;
  exportedAt: string;
  rules: Rule[];
  tools: CustomTool[];
  checklists: PackChecklist[];
  templates: PackTemplate[];
};

export type PackChoice = { key: string; kind: "rule" | "tool" | "checklist" | "template"; label: string; detail: string; already: boolean };

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

export function builtinTemplates(): PackTemplate[] {
  return Object.entries(PACK_TEMPLATES).map(([name, groups]) => ({
    name,
    groups: Object.entries(groups).map(([category, items]) => ({ category, items: [...items] })),
  }));
}

export function buildPack(name: string, parts: Pick<PackFile, "rules" | "tools" | "checklists" | "templates">): PackFile {
  return {
    format: PACK_FORMAT,
    schema: 1,
    name: name.trim().slice(0, 80) || "Pack",
    exportedAt: new Date().toISOString(),
    rules: parts.rules,
    tools: parts.tools,
    checklists: parts.checklists,
    templates: parts.templates,
  };
}

function asTemplate(raw: any): PackTemplate | null {
  const name = clip(raw?.name, 60);
  const groups = Array.isArray(raw?.groups) ? raw.groups : [];
  const clean = groups.slice(0, 20).map((g: any) => ({
    category: clip(g?.category, 40) || "General",
    items: (Array.isArray(g?.items) ? g.items : []).map((item: unknown) => clip(item, 80)).filter(Boolean).slice(0, 40),
  })).filter((g: PackTemplate["groups"][number]) => g.items.length);
  if (!name || !clean.length) return null;
  return { name, groups: clean };
}

function asRule(raw: any): Rule | null {
  const name = clip(raw?.name, 80);
  const kind = clip(raw?.trigger?.kind, 40);
  const value = Number(raw?.trigger?.value);
  const actions = Array.isArray(raw?.actions) ? raw.actions.filter((a: unknown) => a === "attention" || a === "notify") : [];
  if (!name || !kind || !Number.isFinite(value)) return null;
  return { id: clip(raw?.id, 40) || uid(), name, trigger: { kind: kind as Rule["trigger"]["kind"], value }, actions, enabled: raw?.enabled !== false, createdAt: new Date().toISOString() };
}

function asTool(raw: any): CustomTool | null {
  const name = clip(raw?.name, 60);
  const formula = clip(raw?.formula, 200);
  if (!name || !formula) return null;
  const inputs = (Array.isArray(raw?.inputs) ? raw.inputs : []).slice(0, 8).map((input: any) => ({
    id: clip(input?.id, 40) || uid(),
    label: clip(input?.label, 40) || "Input",
    key: clip(input?.key, 20) || "x",
    unit: clip(input?.unit, 12) || undefined,
    value: clip(input?.value, 20),
  }));
  return {
    id: clip(raw?.id, 40) || uid(),
    name,
    icon: clip(raw?.icon, 40) || "calculator-variant-outline",
    inputs,
    formula,
    outputLabel: clip(raw?.outputLabel, 40) || "Result",
    unit: clip(raw?.unit, 12) || undefined,
    decimals: Number.isFinite(Number(raw?.decimals)) ? Number(raw.decimals) : 2,
    sendToMoney: !!raw?.sendToMoney,
    createdAt: new Date().toISOString(),
  };
}

export function parsePack(text: string): PackFile {
  let obj: any;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("This file is not a Nucleus pack.");
  }
  if (obj?.format !== PACK_FORMAT || obj?.schema !== 1) throw new Error("This file is not a Nucleus pack.");
  const rules = (Array.isArray(obj.rules) ? obj.rules : []).slice(0, 40).map(asRule).filter(Boolean) as Rule[];
  const tools = (Array.isArray(obj.tools) ? obj.tools : []).slice(0, 40).map(asTool).filter(Boolean) as CustomTool[];
  const checklists = (Array.isArray(obj.checklists) ? obj.checklists : []).slice(0, 40).map((c: any) => {
    const title = clip(c?.title, 80);
    const items = (Array.isArray(c?.items) ? c.items : []).map((item: unknown) => clip(item, 80)).filter(Boolean).slice(0, 80);
    return title && items.length ? { title, items } : null;
  }).filter(Boolean) as PackFile["checklists"];
  const templates = (Array.isArray(obj.templates) ? obj.templates : []).slice(0, 40).map(asTemplate).filter(Boolean) as PackTemplate[];
  if (!rules.length && !tools.length && !checklists.length && !templates.length) throw new Error("This pack is empty.");
  return { format: PACK_FORMAT, schema: 1, name: clip(obj.name, 80) || "Pack", exportedAt: clip(obj.exportedAt, 40), rules, tools, checklists, templates };
}

export function packChoices(db: DB, pack: PackFile): PackChoice[] {
  return [
    ...pack.rules.map((r) => ({ key: `rule:${r.id}`, kind: "rule" as const, label: r.name, detail: "Rule", already: db.rules.some((x) => x.name === r.name) })),
    ...pack.tools.map((t) => ({ key: `tool:${t.id}`, kind: "tool" as const, label: t.name, detail: "Custom tool", already: db.customTools.some((x) => x.name === t.name) })),
    ...pack.checklists.map((c, i) => ({ key: `list:${i}:${c.title}`, kind: "checklist" as const, label: c.title, detail: `${c.items.length} items`, already: db.notes.some((n) => n.title === c.title) })),
    ...pack.templates.map((t) => ({ key: `template:${t.name}`, kind: "template" as const, label: t.name, detail: "Packing template", already: db.templates.some((x) => x.name === t.name) })),
  ];
}

export function applyPack(db: DB, pack: PackFile, keys: string[]): DB {
  const want = new Set(keys);
  const now = new Date().toISOString();
  let rules = db.rules;
  let tools = db.customTools;
  let notes = db.notes;
  let templates = db.templates;
  for (const rule of pack.rules) {
    if (!want.has(`rule:${rule.id}`) || rules.some((r) => r.name === rule.name)) continue;
    rules = [...rules, { ...rule, id: uid(), createdAt: now, actions: [...rule.actions], trigger: { ...rule.trigger } }];
  }
  for (const tool of pack.tools) {
    if (!want.has(`tool:${tool.id}`) || tools.some((t) => t.name === tool.name)) continue;
    tools = [...tools, { ...tool, id: uid(), createdAt: now, inputs: tool.inputs.map((input) => ({ ...input })) }];
  }
  pack.checklists.forEach((list, i) => {
    if (!want.has(`list:${i}:${list.title}`) || notes.some((n) => n.title === list.title)) return;
    notes = [...notes, { id: uid(), title: list.title, body: "", checklist: list.items.map((text) => ({ id: uid(), text, done: false })), createdAt: now, updatedAt: now }];
  });
  for (const template of pack.templates) {
    if (!want.has(`template:${template.name}`) || templates.some((t) => t.name === template.name)) continue;
    const saved: PackingTemplate = { id: uid(), name: template.name, groups: template.groups.map((g) => ({ category: g.category, items: [...g.items] })) };
    templates = [...templates, saved];
  }
  return { ...db, rules, customTools: tools, notes, templates };
}
