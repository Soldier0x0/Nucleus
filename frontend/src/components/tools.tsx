import React, { useState } from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { copyTemporary } from "@/src/core/clipboard";
import { upsertSubscription, addTxn } from "@/src/core/actions";
import { addDays, addMonths, daysBetween, fmtDate, money, num, parseISO, parseNum, todayISO, uid } from "@/src/core/format";
import { DateField, Field, OptionSheet } from "./inputs";
import { Button, Chip, ChipRow, Eyebrow, Icon, IconButton, Segmented, T } from "./ui";
import { Bar } from "./charts";
import { useToast } from "./Toast";

// ---------- shared result panel with actions ----------
export function Result({ label, value, breakdown, tool, send, testID }: { label: string; value: string; breakdown?: [string, string][]; tool: string; send?: { label: string; run: () => void }; testID?: string }) {
  const { colors } = useTheme();
  const { update } = useStore();
  const autoClear = useStore().db.settings.clipboardAutoClear;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const none = value === "—";
  return (
    <View style={{ backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: 16, marginTop: 4 }} testID={testID ?? `${tool}-result`}>
      <T v="caption" color={colors.onSurfaceInverse} style={{ opacity: 0.7, letterSpacing: 1 }}>{label.toUpperCase()}</T>
      <T v="monoXl" color={colors.onSurfaceInverse} style={{ fontSize: 30, marginTop: 4 }} testID={`${tool}-result-value`} selectable>{value}</T>
      {breakdown && open ? (
        <View style={{ marginTop: 10, gap: 4 }}>
          {breakdown.map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row" }}>
              <T color={colors.onSurfaceInverse} style={{ flex: 1, opacity: 0.75, fontSize: 13 }}>{k}</T>
              <T v="mono" color={colors.onSurfaceInverse} style={{ fontSize: 13 }}>{v}</T>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {breakdown ? <Button small kind="secondary" label={open ? "Hide breakdown" : "Breakdown"} icon={open ? "chevron-up" : "chevron-down"} onPress={() => setOpen(!open)} testID={`${tool}-breakdown-button`} /> : null}
        <Button small kind="secondary" label="Copy" icon="content-copy" testID={`${tool}-copy-button`} disabled={none} onPress={async () => (autoClear ? await copyTemporary(value) : await Clipboard.setStringAsync(value), toast(autoClear ? "Copied · clears in 1 min" : "Copied", "content-copy"))} />
        <Button small kind="secondary" label="Save" icon="history" testID={`${tool}-save-button`} disabled={none} onPress={() => (update((d) => ({ ...d, toolHistory: [{ id: uid(), tool, label, value, at: new Date().toISOString() }, ...d.toolHistory].slice(0, 50) })), toast("Saved to history", "history"))} />
        {send ? <Button small kind="secondary" label={send.label} icon="send-outline" testID={`${tool}-send-button`} onPress={send.run} /> : null}
      </View>
    </View>
  );
}

// ---------- Units ----------
type UnitDef = { label: string; f: number };
const UNITS: Record<string, Record<string, UnitDef>> = {
  Length: { mm: { label: "Millimetre", f: 0.001 }, cm: { label: "Centimetre", f: 0.01 }, m: { label: "Metre", f: 1 }, km: { label: "Kilometre", f: 1000 }, in: { label: "Inch", f: 0.0254 }, ft: { label: "Foot", f: 0.3048 }, yd: { label: "Yard", f: 0.9144 }, mi: { label: "Mile", f: 1609.344 } },
  Weight: { mg: { label: "Milligram", f: 1e-6 }, g: { label: "Gram", f: 0.001 }, kg: { label: "Kilogram", f: 1 }, t: { label: "Tonne", f: 1000 }, oz: { label: "Ounce", f: 0.0283495 }, lb: { label: "Pound", f: 0.453592 } },
  Volume: { ml: { label: "Millilitre", f: 0.001 }, L: { label: "Litre", f: 1 }, tsp: { label: "Teaspoon", f: 0.00492892 }, tbsp: { label: "Tablespoon", f: 0.0147868 }, cup: { label: "Cup (US)", f: 0.236588 }, gal: { label: "Gallon (US)", f: 3.78541 }, "gal UK": { label: "Gallon (UK)", f: 4.54609 }, m3: { label: "Cubic metre", f: 1000 } },
  Temperature: { C: { label: "Celsius", f: 1 }, F: { label: "Fahrenheit", f: 1 }, K: { label: "Kelvin", f: 1 } },
  Speed: { "km/h": { label: "km per hour", f: 1 / 3.6 }, "m/s": { label: "metre per second", f: 1 }, mph: { label: "miles per hour", f: 0.44704 }, kn: { label: "Knot", f: 0.514444 } },
  Area: { "m²": { label: "Square metre", f: 1 }, "ft²": { label: "Square foot", f: 0.092903 }, acre: { label: "Acre", f: 4046.86 }, ha: { label: "Hectare", f: 10000 }, "km²": { label: "Square km", f: 1e6 } },
  Data: { B: { label: "Byte", f: 1 }, KB: { label: "Kilobyte", f: 1024 }, MB: { label: "Megabyte", f: 1024 ** 2 }, GB: { label: "Gigabyte", f: 1024 ** 3 }, TB: { label: "Terabyte", f: 1024 ** 4 } },
  Pressure: { kPa: { label: "Kilopascal", f: 1000 }, bar: { label: "Bar", f: 1e5 }, psi: { label: "PSI", f: 6894.76 }, atm: { label: "Atmosphere", f: 101325 } },
  Energy: { J: { label: "Joule", f: 1 }, kJ: { label: "Kilojoule", f: 1000 }, cal: { label: "Calorie", f: 4.184 }, kcal: { label: "Kilocalorie", f: 4184 }, kWh: { label: "Kilowatt-hour", f: 3.6e6 } },
};
const toC = (v: number, u: string) => (u === "C" ? v : u === "F" ? ((v - 32) * 5) / 9 : v - 273.15);
const fromC = (v: number, u: string) => (u === "C" ? v : u === "F" ? (v * 9) / 5 + 32 : v + 273.15);
const DEFAULT_PAIR: Record<string, [string, string]> = { Length: ["km", "mi"], Weight: ["kg", "lb"], Volume: ["L", "gal"], Temperature: ["C", "F"], Speed: ["km/h", "mph"], Area: ["m²", "ft²"], Data: ["GB", "MB"], Pressure: ["psi", "bar"], Energy: ["kcal", "kJ"] };

export function UnitsTool() {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const [cat, setCat] = useState(db.recents["units:cat"] ?? "Length");
  const [from, setFrom] = useState(DEFAULT_PAIR[cat][0]);
  const [to, setTo] = useState(DEFAULT_PAIR[cat][1]);
  const [val, setVal] = useState(db.recents["units:val"] ?? "1");
  const [pick, setPick] = useState<null | "from" | "to">(null);
  const v = parseNum(val);
  const units = UNITS[cat];
  const out = isNaN(v) ? NaN : cat === "Temperature" ? fromC(toC(v, from), to) : (v * units[from].f) / units[to].f;
  const remember = (patch: Record<string, string>) => update((d) => ({ ...d, recents: { ...d.recents, ...patch } }));
  return (
    <View>
      <View style={{ marginHorizontal: -16 }}>
        <ChipRow testID="units-category-row">
          {Object.keys(UNITS).map((c) => (
            <Chip key={c} label={c} selected={cat === c} testID={`units-cat-${c}`} onPress={() => (setCat(c), setFrom(DEFAULT_PAIR[c][0]), setTo(DEFAULT_PAIR[c][1]), remember({ "units:cat": c }))} />
          ))}
        </ChipRow>
      </View>
      <Field numeric label="Value" unit={from} onUnitPress={() => setPick("from")} testID="units-input" value={val} onChangeText={setVal} onBlur={() => remember({ "units:val": val })} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
        <IconButton icon="swap-vertical" filled testID="units-swap-button" label="Swap units" onPress={() => (setFrom(to), setTo(from))} />
        <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
      </View>
      <Field label="Result" unit={to} onUnitPress={() => setPick("to")} testID="units-output" value={isNaN(out) ? "" : num(out, Math.abs(out) < 1 ? 6 : 4)} editable={false} numeric />
      <Result tool="units" label={`${val || 0} ${from} in ${to}`} value={isNaN(out) ? "—" : `${num(out, Math.abs(out) < 1 ? 6 : 4)} ${to}`} />
      <OptionSheet testID="units-picker" visible={!!pick} onClose={() => setPick(null)} title={pick === "from" ? "Convert from" : "Convert to"} value={pick === "from" ? from : to} options={Object.entries(units).map(([k, u]) => ({ value: k, label: `${u.label} (${k})` }))} onPick={(u) => (pick === "from" ? setFrom(u) : setTo(u))} />
    </View>
  );
}

// ---------- Percentage / GST ----------
export function PercentTool() {
  const { db, update } = useStore();
  const toast = useToast();
  const cur = db.settings.currency;
  const [mode, setMode] = useState<"gst" | "discount" | "percent" | "change">("gst");
  const [a, setA] = useState("");
  const [b, setB] = useState(db.recents["percent:rate"] ?? "18");
  const [inclusive, setInclusive] = useState(false);
  const A = parseNum(a), B = parseNum(b);
  let res = "—";
  let label = "";
  let bd: [string, string][] = [];
  let amountForMoney = NaN;
  if (!isNaN(A) && !isNaN(B)) {
    if (mode === "gst") {
      const base = inclusive ? A / (1 + B / 100) : A;
      const tax = base * (B / 100);
      res = money(base + tax, cur, { decimals: true });
      label = inclusive ? "Total (incl. GST)" : "Total with GST";
      bd = [["Base", money(base, cur, { decimals: true })], [`GST ${B}%`, money(tax, cur, { decimals: true })], ["CGST / SGST", `${money(tax / 2, cur, { decimals: true })} each`], ["Total", money(base + tax, cur, { decimals: true })]];
      amountForMoney = base + tax;
    } else if (mode === "discount") {
      const off = A * (B / 100);
      res = money(A - off, cur, { decimals: true });
      label = "Price after discount";
      bd = [["Original", money(A, cur, { decimals: true })], [`Discount ${B}%`, `-${money(off, cur, { decimals: true })}`], ["You save", money(off, cur, { decimals: true })]];
      amountForMoney = A - off;
    } else if (mode === "percent") {
      res = num((A * B) / 100, 4);
      label = `${B}% of ${A}`;
    } else {
      const ch = A !== 0 ? ((B - A) / A) * 100 : NaN;
      res = isNaN(ch) ? "—" : `${ch >= 0 ? "+" : ""}${num(ch, 2)}%`;
      label = `Change from ${A} to ${B}`;
      bd = [["Difference", num(B - A, 4)]];
    }
  }
  const labels = { gst: ["Amount", "GST rate"], discount: ["Price", "Discount"], percent: ["Value", "Percent"], change: ["From", "To"] }[mode];
  return (
    <View>
      <Segmented testID="percent-mode" value={mode} onChange={(m) => (setMode(m), m !== "gst" && m !== "discount" ? setB("") : setB(m === "gst" ? "18" : "10"))} options={[{ value: "gst", label: "GST" }, { value: "discount", label: "Discount" }, { value: "percent", label: "% of" }, { value: "change", label: "Change" }]} />
      <View style={{ height: 12 }} />
      <Field numeric label={labels[0]} unit={mode === "gst" || mode === "discount" ? cur : undefined} testID="percent-a-input" value={a} onChangeText={setA} placeholder="0" />
      <Field numeric label={labels[1]} unit={mode === "change" ? undefined : "%"} testID="percent-b-input" value={b} onChangeText={setB} onBlur={() => mode === "gst" && update((d) => ({ ...d, recents: { ...d.recents, "percent:rate": b } }))} placeholder="0" />
      {mode === "gst" ? (
        <>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {["5", "12", "18", "28"].map((r) => (
              <Chip key={r} label={`${r}%`} selected={b === r} onPress={() => setB(r)} testID={`percent-rate-${r}`} />
            ))}
          </View>
          <Segmented testID="percent-gst-mode" value={inclusive ? "incl" : "excl"} onChange={(v) => setInclusive(v === "incl")} options={[{ value: "excl", label: "Add GST" }, { value: "incl", label: "Price includes GST" }]} />
          <View style={{ height: 12 }} />
        </>
      ) : null}
      <Result
        tool="percent"
        label={label || "Result"}
        value={res}
        breakdown={bd.length ? bd : undefined}
        send={amountForMoney > 0 && db.settings.modules.find((m) => m.id === "money")?.enabled ? { label: "Add as expense", run: () => (update((d) => addTxn(d, { id: uid(), type: "expense", amount: Number(amountForMoney.toFixed(2)), category: "Shopping", date: todayISO(), note: mode === "gst" ? "From GST calculator" : "From discount calculator" })), toast("Expense added to Money", "send-outline")) } : undefined}
      />
    </View>
  );
}

// ---------- Tip & split ----------
export function SplitTool() {
  const { db, update } = useStore();
  const toast = useToast();
  const cur = db.settings.currency;
  const [bill, setBill] = useState("");
  const [tip, setTip] = useState(db.recents["split:tip"] ?? "10");
  const [people, setPeople] = useState(2);
  const [round, setRound] = useState(true);
  const B = parseNum(bill), Tp = parseNum(tip) || 0;
  const total = !isNaN(B) ? B * (1 + Tp / 100) : NaN;
  const raw = total / people;
  const each = round ? Math.ceil(raw) : raw;
  return (
    <View>
      <Field numeric label="Bill amount" unit={cur} testID="split-bill-input" value={bill} onChangeText={setBill} placeholder="0" />
      <Eyebrow style={{ marginBottom: 8 }}>Tip</Eyebrow>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {["0", "5", "10", "15", "20"].map((r) => (
          <Chip key={r} label={`${r}%`} selected={tip === r} onPress={() => (setTip(r), update((d) => ({ ...d, recents: { ...d.recents, "split:tip": r } })))} testID={`split-tip-${r}`} />
        ))}
      </View>
      <Eyebrow style={{ marginBottom: 8 }}>People</Eyebrow>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <IconButton icon="minus" filled testID="split-people-minus" label="Fewer people" onPress={() => setPeople(Math.max(1, people - 1))} />
        <T v="monoXl" testID="split-people-count">{people}</T>
        <IconButton icon="plus" filled testID="split-people-plus" label="More people" onPress={() => setPeople(Math.min(50, people + 1))} />
        <View style={{ flex: 1, flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
          {Array.from({ length: Math.min(people, 12) }).map((_, i) => (
            <Icon key={i} name="account" size={18} />
          ))}
        </View>
      </View>
      <Segmented testID="split-round" value={round ? "up" : "exact"} onChange={(v) => setRound(v === "up")} options={[{ value: "up", label: "Round up" }, { value: "exact", label: "Exact" }]} />
      <View style={{ height: 12 }} />
      <Result
        tool="split"
        label="Each person pays"
        value={isNaN(each) ? "—" : money(each, cur, { decimals: !round })}
        breakdown={isNaN(total) ? undefined : [["Bill", money(B, cur, { decimals: true })], [`Tip ${Tp}%`, money(B * (Tp / 100), cur, { decimals: true })], ["Total", money(total, cur, { decimals: true })], ...(round ? ([["Rounding extra", money(each * people - total, cur, { decimals: true })]] as [string, string][]) : [])]}
        send={!isNaN(each) && db.settings.modules.find((m) => m.id === "money")?.enabled ? { label: "Log my share", run: () => (update((d) => addTxn(d, { id: uid(), type: "expense", amount: Number(each.toFixed(2)), category: "Food", date: todayISO(), note: `Bill split · ${people} people` })), toast("Your share added to Money", "send-outline")) } : undefined}
      />
    </View>
  );
}

// ---------- Dates ----------
export function DatesTool() {
  const [mode, setMode] = useState<"between" | "add">("between");
  const [a, setA] = useState(todayISO());
  const [b, setB] = useState(addMonths(todayISO(), 1));
  const [n, setN] = useState("30");
  const [unit, setUnit] = useState<"days" | "weeks" | "months">("days");
  const [unitOpen, setUnitOpen] = useState(false);
  let value = "—";
  let bd: [string, string][] = [];
  if (mode === "between") {
    const d = daysBetween(a, b);
    let work = 0;
    const step = d >= 0 ? 1 : -1;
    for (let i = 0; i !== d; i += step) {
      const wd = parseISO(addDays(a, i + (step > 0 ? 1 : 0))).getDay();
      if (wd !== 0 && wd !== 6) work++;
    }
    value = `${num(Math.abs(d), 0)} days`;
    const A = parseISO(a), B2 = parseISO(b);
    let months = (B2.getFullYear() - A.getFullYear()) * 12 + B2.getMonth() - A.getMonth();
    if (B2.getDate() < A.getDate()) months--;
    bd = [["Weeks", `${num(Math.abs(d) / 7, 1)}`], ["Months (whole)", `${Math.abs(months)}`], ["Years", num(Math.abs(d) / 365.25, 2)], ["Working days (Mon–Fri)", `${work}`]];
  } else {
    const N = parseNum(n);
    if (!isNaN(N)) {
      const r = unit === "days" ? addDays(a, N) : unit === "weeks" ? addDays(a, N * 7) : addMonths(a, N);
      value = fmtDate(r);
      bd = [["Weekday", parseISO(r).toLocaleDateString("en-US", { weekday: "long" })], ["From today", `${daysBetween(todayISO(), r)} days`]];
    }
  }
  return (
    <View>
      <Segmented testID="dates-mode" value={mode} onChange={setMode} options={[{ value: "between", label: "Between dates" }, { value: "add", label: "Add / subtract" }]} />
      <View style={{ height: 12 }} />
      <DateField label={mode === "between" ? "From" : "Start date"} value={a} onChange={(v) => setA(v ?? todayISO())} testID="dates-a" />
      {mode === "between" ? (
        <DateField label="To" value={b} onChange={(v) => setB(v ?? todayISO())} testID="dates-b" />
      ) : (
        <>
          <Field numeric label="Amount (use - to subtract)" unit={unit} onUnitPress={() => setUnitOpen(true)} testID="dates-n-input" value={n} onChangeText={setN} keyboardType="numbers-and-punctuation" />
          <OptionSheet
            testID="dates-unit"
            visible={unitOpen}
            onClose={() => setUnitOpen(false)}
            title="Amount unit"
            value={unit}
            options={[{ value: "days", label: "Days" }, { value: "weeks", label: "Weeks" }, { value: "months", label: "Months" }]}
            onPick={(picked) => {
              switch (picked) {
                case "days":
                case "weeks":
                case "months":
                  setUnit(picked);
                  break;
                default:
                  break;
              }
            }}
          />
        </>
      )}
      <Result tool="dates" label={mode === "between" ? "Difference" : "Resulting date"} value={value} breakdown={bd} />
    </View>
  );
}

// ---------- EMI ----------
export function EmiTool() {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const cur = db.settings.currency;
  const [p, setP] = useState(db.recents["emi:p"] ?? "500000");
  const [r, setR] = useState(db.recents["emi:r"] ?? "9.5");
  const [n, setN] = useState(db.recents["emi:n"] ?? "60");
  const P = parseNum(p), R = parseNum(r) / 12 / 100, N = parseNum(n);
  const emi = P > 0 && N > 0 ? (R > 0 ? (P * R * (1 + R) ** N) / ((1 + R) ** N - 1) : P / N) : NaN;
  const total = emi * N;
  const interest = total - P;
  const save = () => update((d) => ({ ...d, recents: { ...d.recents, "emi:p": p, "emi:r": r, "emi:n": n } }));
  return (
    <View>
      <Field numeric label="Loan amount" unit={cur} testID="emi-principal-input" value={p} onChangeText={setP} onBlur={save} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field style={{ flex: 1 }} numeric label="Interest" unit="% p.a." testID="emi-rate-input" value={r} onChangeText={setR} onBlur={save} />
        <Field style={{ flex: 1 }} numeric label="Tenure" unit="months" testID="emi-tenure-input" value={n} onChangeText={setN} onBlur={save} hint={N > 0 ? `${num(N / 12, 1)} years` : undefined} />
      </View>
      {isFinite(emi) ? (
        <View style={{ marginBottom: 12 }} testID="emi-split-bar">
          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            <T v="caption" style={{ flex: 1 }}>Principal {num((P / total) * 100, 0)}%</T>
            <T v="caption" muted>Interest {num((interest / total) * 100, 0)}%</T>
          </View>
          <Bar value={P} max={total} height={12} />
        </View>
      ) : null}
      <Result
        tool="emi"
        label="Monthly EMI"
        value={isFinite(emi) ? money(emi, cur, { decimals: true }) : "—"}
        breakdown={isFinite(emi) ? [["Principal", money(P, cur)], ["Total interest", money(interest, cur)], ["Total payable", money(total, cur)], ["First month interest", money(P * R, cur, { decimals: true })]] : undefined}
        send={
          isFinite(emi) && db.settings.modules.find((m) => m.id === "money")?.enabled
            ? {
                label: "Track as recurring",
                run: () => {
                  update((d) => upsertSubscription(d, { id: uid(), name: `Loan EMI · ${money(P, cur)}`, amount: Number(emi.toFixed(2)), cycle: "monthly", nextRenewal: addMonths(todayISO(), 1), category: "Loan EMI", active: true }));
                  toast("EMI added to Money subscriptions", "send-outline");
                  router.push("/money?tab=subscriptions");
                },
              }
            : undefined
        }
      />
      <T muted style={{ fontSize: 12, marginTop: 8, color: colors.muted }}>Reducing-balance method, monthly compounding.</T>
    </View>
  );
}
