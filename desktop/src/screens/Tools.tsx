import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { addTxn, upsertSubscription } from "@core/actions";
import { addDays, addMonths, daysBetween, fmtDate, money, num, parseISO, parseNum, todayISO, uid } from "@core/format";
import { chanceFrames } from "@core/chance";
import { clockOk } from "@core/clock";
import { evaluateFormula } from "@core/formula";

/**
 * Tools on desktop: the phone's ten built-ins plus the tools you built in
 * the Tool Builder, sharing one document. Numbers are calculated in memory;
 * saved results live in the shared toolHistory.
 */
type Send = { label: string; run: () => void };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span>{label}</span>
      {children}
    </div>
  );
}

function ResultBox({ label, value, breakdown, tool, send }: { label: string; value: string; breakdown?: [string, string][]; tool: string; send?: Send }) {
  const { update } = useStore();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const none = value === "—";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="resultbox" data-testid={`${tool}-result`}>
      <p className="resultcap">{label}</p>
      <p className="resultval" data-testid={`${tool}-result-value`}>{value}</p>
      {breakdown && open ? (
        <table className="table resultbd">
          <tbody>
            {breakdown.map(([k, v]) => (
              <tr key={k}><td>{k}</td><td className="mono right">{v}</td></tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div className="row">
        {breakdown ? <button className="small-btn" onClick={() => setOpen(!open)}>{open ? "Hide breakdown" : "Breakdown"}</button> : null}
        <button className="small-btn" disabled={none} onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>
        <button
          className="small-btn"
          disabled={none}
          onClick={() => {
            update((d) => ({ ...d, toolHistory: [{ id: uid(), tool, label, value, at: new Date().toISOString() }, ...d.toolHistory].slice(0, 50) }));
          }}
          data-testid={`${tool}-save-button`}
        >
          Save
        </button>
        {send ? <button className="small-btn" onClick={send.run} data-testid={`${tool}-send-button`}>{send.label}</button> : null}
      </div>
    </div>
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

function UnitsTool() {
  const { db, update } = useStore();
  // The saved category could carry a stale key from an older build; falling back
  // to Length keeps the UserDefaults for from/to resolvable instead of crashing.
  const savedCat = db.recents["units:cat"];
  const [cat, setCat] = useState<string>(savedCat && UNITS[savedCat] ? savedCat : "Length");
  const [from, setFrom] = useState(DEFAULT_PAIR[cat][0]);
  const [to, setTo] = useState(DEFAULT_PAIR[cat][1]);
  const [val, setVal] = useState(db.recents["units:val"] ?? "1");
  const v = parseNum(val);
  const units = UNITS[cat];
  const out = isNaN(v) ? NaN : cat === "Temperature" ? fromC(toC(v, from), to) : (v * units[from].f) / units[to].f;
  const remember = (patch: Record<string, string>) => update((d) => ({ ...d, recents: { ...d.recents, ...patch } }));
  return (
    <div>
      <nav className="tabs" data-testid="units-category-row">
        {Object.keys(UNITS).map((c) => (
          <button
            key={c}
            className={cat === c ? "tab on" : "tab"}
            data-testid={`units-cat-${c}`}
            onClick={() => {
              setCat(c);
              setFrom(DEFAULT_PAIR[c][0]);
              setTo(DEFAULT_PAIR[c][1]);
              remember({ "units:cat": c });
            }}
          >
            {c}
          </button>
        ))}
      </nav>
      <div className="add-row">
        <Row label="Value">
          <input className="num filter" style={{ width: 140 }} value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => remember({ "units:val": val })} data-testid="units-input" />
        </Row>
        <select value={from} onChange={(e) => setFrom(e.target.value)} data-testid="units-from">
          {Object.entries(units).map(([k, u]) => (
            <option key={k} value={k}>{u.label} ({k})</option>
          ))}
        </select>
        <button
          className="small-btn"
          data-testid="units-swap-button"
          title="Swap units"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          ⇅
        </button>
        <select value={to} onChange={(e) => setTo(e.target.value)} data-testid="units-to">
          {Object.entries(units).map(([k, u]) => (
            <option key={k} value={k}>{u.label} ({k})</option>
          ))}
        </select>
      </div>
      <ResultBox tool="units" label={`${val || 0} ${from} in ${to}`} value={isNaN(out) ? "—" : `${num(out, Math.abs(out) < 1 ? 6 : 4)} ${to}`} />
    </div>
  );
}

// ---------- Percentage / GST ----------
function PercentTool() {
  const { db, update } = useStore();
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
      res = money(base + tax, cur);
      label = inclusive ? "Total (incl. GST)" : "Total with GST";
      bd = [["Base", money(base, cur)], [`GST ${B}%`, money(tax, cur)], ["CGST / SGST", `${money(tax / 2, cur)} each`], ["Total", money(base + tax, cur)]];
      amountForMoney = base + tax;
    } else if (mode === "discount") {
      const off = A * (B / 100);
      res = money(A - off, cur);
      label = "Price after discount";
      bd = [["Original", money(A, cur)], [`Discount ${B}%`, `-${money(off, cur)}`], ["You save", money(off, cur)]];
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
  return (
    <div>
      <nav className="tabs" data-testid="percent-mode">
        {([["gst", "GST"], ["discount", "Discount"], ["percent", "% of"], ["change", "Change"]] as [typeof mode, string][]).map(([m, l]) => (
          <button
            key={m}
            className={mode === m ? "tab on" : "tab"}
            onClick={() => {
              setMode(m);
              if (m !== "gst" && m !== "discount") setB("");
            }}
          >
            {l}
          </button>
        ))}
      </nav>
      <div className="add-row">
        <Row label={mode === "gst" ? "Amount" : mode === "discount" ? "Price" : mode === "percent" ? "Value" : "From"}>
          <input className="num filter" style={{ width: 140 }} value={a} onChange={(e) => setA(e.target.value)} placeholder="0" data-testid="percent-a-input" />
        </Row>
        <Row label={mode === "gst" ? "GST rate" : mode === "discount" ? "Discount" : mode === "percent" ? "Percent" : "To"}>
          <input
            className="num filter"
            style={{ width: 140 }}
            value={b}
            onChange={(e) => setB(e.target.value)}
            onBlur={() => mode === "gst" && update((d) => ({ ...d, recents: { ...d.recents, "percent:rate": b } }))}
            placeholder="0"
            data-testid="percent-b-input"
          />
        </Row>
      </div>
      {mode === "gst" ? (
        <>
          <nav className="tabs">
            {["5", "12", "18", "28"].map((r) => (
              <button key={r} className={b === r ? "tab on" : "tab"} onClick={() => setB(r)} data-testid={`percent-rate-${r}`}>{r}%</button>
            ))}
          </nav>
          <nav className="seg" data-testid="percent-gst-mode">
            {([["excl", "Add GST"], ["incl", "Price includes GST"]] as const).map(([v, l]) => (
              <button key={v} className={(inclusive ? "incl" : "excl") === v ? "on" : ""} onClick={() => setInclusive(v === "incl")}>{l}</button>
            ))}
          </nav>
          <div style={{ height: 12 }} />
        </>
      ) : null}
      <ResultBox
        tool="percent"
        label={label || "Result"}
        value={res}
        breakdown={bd.length ? bd : undefined}
        send={
          amountForMoney > 0
            ? {
                label: "Add as expense",
                run: () =>
                  update((d) =>
                    addTxn(d, { id: uid(), type: "expense", amount: Number(amountForMoney.toFixed(2)), category: "Shopping", date: todayISO(), note: mode === "gst" ? "From GST calculator" : "From discount calculator" }),
                  ),
              }
            : undefined
        }
      />
    </div>
  );
}

// ---------- Tip & split ----------
function SplitTool() {
  const { db, update } = useStore();
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
    <div>
      <Row label="Bill amount">
        <input className="num filter" style={{ width: 140 }} value={bill} onChange={(e) => setBill(e.target.value)} placeholder="0" data-testid="split-bill-input" />
      </Row>
      <nav className="tabs">
        {["0", "5", "10", "15", "20"].map((r) => (
          <button
            key={r}
            className={tip === r ? "tab on" : "tab"}
            onClick={() => {
              setTip(r);
              update((d) => ({ ...d, recents: { ...d.recents, "split:tip": r } }));
            }}
            data-testid={`split-tip-${r}`}
          >
            {r}%
          </button>
        ))}
      </nav>
      <div className="add-row" style={{ alignItems: "center" }}>
        <button className="small-btn" onClick={() => setPeople(Math.max(1, people - 1))} data-testid="split-people-minus">−</button>
        <span className="resultval" style={{ fontSize: 20 }} data-testid="split-people-count">{people}</span>
        <button className="small-btn" onClick={() => setPeople(Math.min(50, people + 1))} data-testid="split-people-plus">+</button>
      </div>
      <nav className="seg" data-testid="split-round">
        {([["up", "Round up"], ["exact", "Exact"]] as const).map(([v, l]) => (
          <button key={v} className={(round ? "up" : "exact") === v ? "on" : ""} onClick={() => setRound(v === "up")}>{l}</button>
        ))}
      </nav>
      <div style={{ height: 12 }} />
      <ResultBox
        tool="split"
        label="Each person pays"
        value={isNaN(each) ? "—" : money(each, cur)}
        breakdown={isNaN(total) ? undefined : [["Bill", money(B, cur)], [`Tip ${Tp}%`, money(B * (Tp / 100), cur)], ["Total", money(total, cur)], ...(round ? ([["Rounding extra", money(each * people - total, cur)]] as [string, string][]) : [])]}
        send={
          !isNaN(each)
            ? {
                label: "Log my share",
                run: () =>
                  update((d) => addTxn(d, { id: uid(), type: "expense", amount: Number(each.toFixed(2)), category: "Food", date: todayISO(), note: `Bill split · ${people} people` })),
              }
            : undefined
        }
      />
    </div>
  );
}

// ---------- Dates ----------
function DatesTool() {
  const [mode, setMode] = useState<"between" | "add">("between");
  const [a, setA] = useState(todayISO());
  const [b, setB] = useState(addMonths(todayISO(), 1));
  const [n, setN] = useState("30");
  const [unit, setUnit] = useState<"days" | "weeks" | "months">("days");
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
    <div>
      <nav className="tabs" data-testid="dates-mode">
        {([["between", "Between dates"], ["add", "Add / subtract"]] as const).map(([m, l]) => (
          <button key={m} className={mode === m ? "tab on" : "tab"} onClick={() => setMode(m)}>{l}</button>
        ))}
      </nav>
      <div className="add-row">
        <Row label={mode === "between" ? "From" : "Start date"}>
          <input type="date" className="filter" value={a} onChange={(e) => setA(e.target.value)} data-testid="dates-a" />
        </Row>
        {mode === "between" ? (
          <Row label="To">
            <input type="date" className="filter" value={b} onChange={(e) => setB(e.target.value)} data-testid="dates-b" />
          </Row>
        ) : (
          <>
            <Row label="Amount">
              <input className="num filter" style={{ width: 110 }} value={n} onChange={(e) => setN(e.target.value)} data-testid="dates-n-input" />
            </Row>
            <select className="filter" value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)} data-testid="dates-unit" style={{ width: 110 }}>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </>
        )}
      </div>
      <ResultBox tool="dates" label={mode === "between" ? "Difference" : "Resulting date"} value={value} breakdown={bd} />
    </div>
  );
}

// ---------- EMI ----------
function EmiTool() {
  const { db, update } = useStore();
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
    <div>
      <div className="add-row">
        <Row label={`Loan amount (${cur})`}>
          <input className="num filter" style={{ width: 140 }} value={p} onChange={(e) => setP(e.target.value)} onBlur={save} data-testid="emi-principal-input" />
        </Row>
        <Row label="Interest (% p.a.)">
          <input className="num filter" style={{ width: 110 }} value={r} onChange={(e) => setR(e.target.value)} onBlur={save} data-testid="emi-rate-input" />
        </Row>
        <Row label="Tenure (months)">
          <input className="num filter" style={{ width: 110 }} value={n} onChange={(e) => setN(e.target.value)} onBlur={save} data-testid="emi-tenure-input" />
        </Row>
      </div>
      {isFinite(emi) ? (
        <div style={{ marginBottom: 12 }} data-testid="emi-split-bar">
          <div className="row small muted">
            <span>Principal {num((P / total) * 100, 0)}%</span>
            <span>Interest {num((interest / total) * 100, 0)}%</span>
          </div>
          <div className="bar-pair">
            <div style={{ width: `${num((P / total) * 100, 0)}%` }} />
          </div>
        </div>
      ) : null}
      <ResultBox
        tool="emi"
        label="Monthly EMI"
        value={isFinite(emi) ? money(emi, cur) : "—"}
        breakdown={isFinite(emi) ? [["Principal", money(P, cur)], ["Total interest", money(interest, cur)], ["Total payable", money(total, cur)], ["First month interest", money(P * R, cur)]] : undefined}
        send={
          isFinite(emi)
            ? {
                label: "Track as recurring",
                run: () =>
                  update((d) =>
                    upsertSubscription(d, { id: uid(), name: `Loan EMI · ${money(P, cur)}`, amount: Number(emi.toFixed(2)), cycle: "monthly", nextRenewal: addMonths(todayISO(), 1), category: "Loan EMI", active: true }),
                  ),
              }
            : undefined
        }
      />
      <p className="muted small">Reducing-balance method, monthly compounding.</p>
    </div>
  );
}

// ---------- Cooking ----------
const KITCHEN: Record<string, number> = { tsp: 4.92892, tbsp: 14.7868, cup: 236.588, ml: 1, L: 1000, "fl oz": 29.5735, pint: 473.176 };
// g per cup, the usual kitchen approximations
const DENSITY: Record<string, number> = { Water: 236, "Flour (plain)": 125, "Sugar (granulated)": 200, "Sugar (icing)": 120, Rice: 185, Butter: 227, Milk: 244, Honey: 340, "Oil (veg)": 218, Salt: 273 };

function CookingTool() {
  const [mode, setMode] = useState<"volume" | "weight" | "scale">("volume");
  const [val, setVal] = useState("1");
  const [from, setFrom] = useState("cup");
  const [to, setTo] = useState("ml");
  const [ing, setIng] = useState("Flour (plain)");
  const [servFrom, setServFrom] = useState("4");
  const [servTo, setServTo] = useState("6");
  const v = parseNum(val);
  const ml = isNaN(v) ? NaN : v * KITCHEN[from];
  let value = "—";
  let bd: [string, string][] = [];
  if (mode === "volume") {
    const out = ml / KITCHEN[to];
    value = isNaN(out) ? "—" : `${num(out, 2)} ${to}`;
    bd = Object.keys(KITCHEN).filter((k) => k !== from).map((k) => [k, num(ml / KITCHEN[k], 2)] as [string, string]);
  } else if (mode === "weight") {
    const grams = (ml / KITCHEN.cup) * DENSITY[ing];
    value = isNaN(grams) ? "—" : `${num(grams, 0)} g`;
    bd = [["Ingredient", ing], ["Per cup", `${DENSITY[ing]} g`], ["Volume", `${num(ml, 0)} ml`], ["Ounces", num(grams / 28.3495, 2)]];
  } else {
    const f = parseNum(servTo) / parseNum(servFrom);
    value = isFinite(f) ? `× ${num(f, 2)}` : "—";
    bd = isFinite(f) ? [["1 cup becomes", `${num(f, 2)} cup`], ["100 g becomes", `${num(100 * f, 0)} g`], ["1 tsp becomes", `${num(f, 2)} tsp`], ["Oven time", "keep the same, check 5 min early"]] : [];
  }
  return (
    <div>
      <nav className="tabs" data-testid="cooking-mode">
        {([["volume", "Volume"], ["weight", "Cups → grams"], ["scale", "Servings"]] as const).map(([m, l]) => (
          <button key={m} className={mode === m ? "tab on" : "tab"} onClick={() => setMode(m)}>{l}</button>
        ))}
      </nav>
      {mode === "scale" ? (
        <div className="add-row">
          <Row label="Recipe serves">
            <input className="num filter" style={{ width: 110 }} value={servFrom} onChange={(e) => setServFrom(e.target.value)} data-testid="cooking-serv-from" />
          </Row>
          <Row label="You need">
            <input className="num filter" style={{ width: 110 }} value={servTo} onChange={(e) => setServTo(e.target.value)} data-testid="cooking-serv-to" />
          </Row>
        </div>
      ) : (
        <div className="add-row">
          <Row label="Amount">
            <input className="num filter" style={{ width: 110 }} value={val} onChange={(e) => setVal(e.target.value)} data-testid="cooking-input" />
          </Row>
          <select className="filter" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="cooking-unit">
            {Object.keys(KITCHEN).map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      )}
      {mode === "volume" ? (
        <nav className="tabs" data-testid="cooking-to-row">
          {Object.keys(KITCHEN).map((k) => (
            <button key={k} className={to === k ? "tab on" : "tab"} onClick={() => setTo(k)} data-testid={`cooking-to-${k}`}>{k}</button>
          ))}
        </nav>
      ) : null}
      {mode === "weight" ? (
        <nav className="tabs" data-testid="cooking-ing-row">
          {Object.keys(DENSITY).map((k) => (
            <button key={k} className={ing === k ? "tab on" : "tab"} onClick={() => setIng(k)} data-testid={`cooking-ing-${k}`}>{k}</button>
          ))}
        </nav>
      ) : null}
      <ResultBox tool="cooking" label={mode === "scale" ? "Multiply everything by" : mode === "weight" ? `${val} ${from} of ${ing}` : `${val} ${from} in ${to}`} value={value} breakdown={bd.length ? bd : undefined} />
      <p className="muted small">Cup = 236.6 ml (US). Weights are standard kitchen averages, not lab values.</p>
    </div>
  );
}

// ---------- Time ----------
const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");

function TimeTool() {
  const [mode, setMode] = useState<"diff" | "add" | "zones">("diff");
  const [a, setA] = useState("09:30");
  const [b, setB] = useState("18:15");
  const [n, setN] = useState("90");
  const mins = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  let value = "—";
  let bd: [string, string][] = [];
  const badClock = mode !== "zones" && (!clockOk(a) || (mode === "diff" && !clockOk(b)));
  if (badClock) {
    value = "—";
    bd = [];
  } else if (mode === "diff") {
    const d = mins(b) - mins(a);
    const dd = d < 0 ? d + 1440 : d;
    value = `${pad(dd / 60)}:${pad(dd % 60)}`;
    bd = [["Total minutes", num(dd, 0)], ["In hours", num(dd / 60, 2)], ["Crosses midnight", d < 0 ? "Yes" : "No"], ["As a shift", `${num(dd / 60, 1)} h`]];
  } else if (mode === "add") {
    const t = (mins(a) + (parseNum(n) || 0) + 1440 * 10) % 1440;
    value = `${pad(t / 60)}:${pad(t % 60)}`;
    bd = [["Start", a], ["Offset", `${n} min`], ["Day shift", mins(a) + (parseNum(n) || 0) >= 1440 ? "+1 day" : mins(a) + (parseNum(n) || 0) < 0 ? "−1 day" : "same day"]];
  } else {
    const base = new Date();
    const zones: [string, number][] = [["India (IST)", 5.5], ["UTC", 0], ["London", 1], ["Berlin", 2], ["New York", -4], ["San Francisco", -7], ["Dubai", 4], ["Singapore", 8], ["Tokyo", 9], ["Sydney", 10]];
    const utc = base.getTime() + base.getTimezoneOffset() * 60000;
    value = base.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    bd = zones.map(([nm, off]) => {
      const d = new Date(utc + off * 3600000);
      return [nm, `${pad(d.getHours())}:${pad(d.getMinutes())}`] as [string, string];
    });
  }
  return (
    <div>
      <nav className="tabs" data-testid="time-mode">
        {([["diff", "Between"], ["add", "Add minutes"], ["zones", "Time zones"]] as const).map(([m, l]) => (
          <button key={m} className={mode === m ? "tab on" : "tab"} onClick={() => setMode(m)}>{l}</button>
        ))}
      </nav>
      <div className="add-row">
        {mode !== "zones" ? (
          <Row label="Start time (HH:MM)">
            <input className="num filter" style={{ width: 110 }} value={a} onChange={(e) => setA(e.target.value)} placeholder="09:30" data-testid="time-a-input" />
          </Row>
        ) : null}
        {mode === "diff" ? (
          <Row label="End time (HH:MM)">
            <input className="num filter" style={{ width: 110 }} value={b} onChange={(e) => setB(e.target.value)} placeholder="18:15" data-testid="time-b-input" />
          </Row>
        ) : null}
        {mode === "add" ? (
          <Row label="Minutes (use - to go back)">
            <input className="num filter" style={{ width: 110 }} value={n} onChange={(e) => setN(e.target.value)} data-testid="time-n-input" />
          </Row>
        ) : null}
      </div>
      {badClock ? <p className="small" style={{ color: "var(--error)" }} data-testid="time-error">Enter both times as HH:MM</p> : null}
      <ResultBox tool="time" label={mode === "zones" ? "Your local time" : mode === "diff" ? "Duration" : "Resulting time"} value={value} breakdown={bd} />
      {mode === "zones" ? <p className="muted small">Fixed standard offsets — daylight saving is not tracked offline.</p> : null}
    </div>
  );
}

// ---------- Growth ----------
function GrowthTool() {
  const { db } = useStore();
  const cur = db.settings.currency;
  const [mode, setMode] = useState<"sip" | "lumpsum" | "cagr" | "inflation">("sip");
  const [amt, setAmt] = useState("5000");
  const [rate, setRate] = useState("12");
  const [years, setYears] = useState("10");
  const [future, setFuture] = useState("200000");
  const A = parseNum(amt), R = parseNum(rate) / 100, Y = parseNum(years), F = parseNum(future);
  let value = "—";
  let bd: [string, string][] = [];
  let invested = NaN, result = NaN;
  if (mode === "sip") {
    const i = R / 12, n = Y * 12;
    result = i > 0 ? A * ((((1 + i) ** n - 1) / i) * (1 + i)) : A * n;
    invested = A * n;
    value = money(result, cur);
    bd = [["Monthly", money(A, cur)], ["Invested", money(invested, cur)], ["Gain", money(result - invested, cur)], ["Months", num(n, 0)]];
  } else if (mode === "lumpsum") {
    result = A * (1 + R) ** Y;
    invested = A;
    value = money(result, cur);
    bd = [["Invested", money(A, cur)], ["Gain", money(result - A, cur)], ["Doubles in", `${num(72 / (R * 100), 1)} years (rule of 72)`]];
  } else if (mode === "cagr") {
    const g = Y > 0 && A > 0 ? (F / A) ** (1 / Y) - 1 : NaN;
    value = isFinite(g) ? `${num(g * 100, 2)}% a year` : "—";
    bd = [["Start", money(A, cur)], ["End", money(F, cur)], ["Total growth", isFinite(g) ? `${num((F / A - 1) * 100, 1)}%` : "—"], ["Years", num(Y, 1)]];
  } else {
    result = A / (1 + R) ** Y;
    value = money(result, cur);
    bd = [["Today's amount", money(A, cur)], ["Inflation", `${num(R * 100, 1)}% a year`], ["In today's money", money(result, cur)], ["Lost to inflation", money(A - result, cur)]];
  }
  return (
    <div>
      <nav className="tabs" data-testid="growth-mode">
        {([["sip", "SIP"], ["lumpsum", "Lump sum"], ["cagr", "CAGR"], ["inflation", "Inflation"]] as const).map(([m, l]) => (
          <button key={m} className={mode === m ? "tab on" : "tab"} onClick={() => setMode(m)}>{l}</button>
        ))}
      </nav>
      <div className="add-row">
        <Row label={mode === "sip" ? `Monthly amount (${cur})` : mode === "cagr" ? `Starting value (${cur})` : `Amount (${cur})`}>
          <input className="num filter" style={{ width: 140 }} value={amt} onChange={(e) => setAmt(e.target.value)} data-testid="growth-amount-input" />
        </Row>
        {mode === "cagr" ? (
          <Row label={`Value later (${cur})`}>
            <input className="num filter" style={{ width: 140 }} value={future} onChange={(e) => setFuture(e.target.value)} data-testid="growth-future-input" />
          </Row>
        ) : (
          <Row label={mode === "inflation" ? "Inflation rate (% p.a.)" : "Expected return (% p.a.)"}>
            <input className="num filter" style={{ width: 110 }} value={rate} onChange={(e) => setRate(e.target.value)} data-testid="growth-rate-input" />
          </Row>
        )}
        <Row label="Years">
          <input className="num filter" style={{ width: 90 }} value={years} onChange={(e) => setYears(e.target.value)} data-testid="growth-years-input" />
        </Row>
      </div>
      {isFinite(result) && isFinite(invested) && result > 0 ? (
        <div style={{ marginBottom: 12 }} data-testid="growth-bar">
          <div className="row small muted">
            <span>Invested {num((invested / result) * 100, 0)}%</span>
            <span>Growth {num(((result - invested) / result) * 100, 0)}%</span>
          </div>
          <div className="bar-pair">
            <div style={{ width: `${num((invested / result) * 100, 0)}%` }} />
          </div>
        </div>
      ) : null}
      <ResultBox tool="growth" label={mode === "cagr" ? "Compound annual growth" : mode === "inflation" ? "Worth in today's money" : "Future value"} value={value} breakdown={bd} />
      <p className="muted small">Plain compound interest maths. Not advice — returns are assumptions you type in.</p>
    </div>
  );
}

// ---------- Randomizer ----------
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function RandomTool() {
  const [mode, setMode] = useState<"dice" | "coin" | "number" | "card" | "teams" | "wheel">("dice");
  const [sides, setSides] = useState("6");
  const [count, setCount] = useState(2);
  const [lo, setLo] = useState("1");
  const [hi, setHi] = useState("100");
  const [names, setNames] = useState("");
  const [teams, setTeams] = useState(2);
  const [out, setOut] = useState<string[]>([]);
  const [spin, setSpin] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const roll = () => {
    const r = (n: number) => Math.floor(Math.random() * n);
    if (timer.current) clearTimeout(timer.current);
    if (mode === "dice" || mode === "coin" || mode === "number") {
      const played = chanceFrames(
        mode,
        { sides: Math.max(2, parseNum(sides) || 6), count: mode === "number" ? 1 : count, lo: parseNum(lo) || 0, hi: parseNum(hi) || 100 },
        Math.random,
        5,
      );
      setSpin(null);
      let step = 0;
      const show = () => {
        if (step < played.frames.length) {
          setOut(played.frames[step] ?? played.final);
          step += 1;
          timer.current = setTimeout(show, 70);
          return;
        }
        setOut(played.final);
        timer.current = null;
      };
      show();
      return;
    }
    if (mode === "card") {
      const deck = RANKS.flatMap((x) => SUITS.map((s) => x + s));
      setOut(Array.from({ length: Math.min(count, 5) }, () => deck.splice(r(deck.length), 1)[0]));
    } else {
      const list = names.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
      if (!list.length) return setOut([]);
      if (mode === "wheel") {
        const pick = list[r(list.length)];
        setSpin(pick);
        setOut([pick]);
      } else {
        const shuffled = [...list].sort(() => Math.random() - 0.5);
        const buckets: string[][] = Array.from({ length: Math.max(2, teams) }, () => []);
        shuffled.forEach((nm, i) => buckets[i % buckets.length].push(nm));
        setOut(buckets.map((bk, i) => `Team ${i + 1}: ${bk.join(", ")}`));
      }
    }
  };

  const needsList = mode === "teams" || mode === "wheel";
  const noOptions = needsList && !names.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).length;

  return (
    <div>
      <nav className="tabs" data-testid="random-mode-row">
        {([["dice", "Dice"], ["coin", "Coin"], ["number", "Number"], ["card", "Cards"], ["teams", "Teams"], ["wheel", "Decide"]] as [typeof mode, string][]).map(([k, l]) => (
          <button
            key={k}
            className={mode === k ? "tab on" : "tab"}
            data-testid={`random-mode-${k}`}
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              setMode(k);
              setOut([]);
              setSpin(null);
            }}
          >
            {l}
          </button>
        ))}
      </nav>
      {mode === "dice" ? (
        <Row label="Sides">
          <input className="num filter" style={{ width: 110 }} value={sides} onChange={(e) => setSides(e.target.value)} data-testid="random-sides-input" />
        </Row>
      ) : null}
      {mode === "number" ? (
        <div className="add-row">
          <Row label="From">
            <input className="num filter" style={{ width: 110 }} value={lo} onChange={(e) => setLo(e.target.value)} data-testid="random-lo-input" />
          </Row>
          <Row label="To">
            <input className="num filter" style={{ width: 110 }} value={hi} onChange={(e) => setHi(e.target.value)} data-testid="random-hi-input" />
          </Row>
        </div>
      ) : null}
      {mode === "dice" || mode === "coin" || mode === "card" ? (
        <div className="add-row" style={{ alignItems: "center" }}>
          <button className="small-btn" onClick={() => setCount(Math.max(1, count - 1))} data-testid="random-count-minus">−</button>
          <span className="resultval" style={{ fontSize: 20 }} data-testid="random-count">{count}</span>
          <button className="small-btn" onClick={() => setCount(Math.min(5, count + 1))} data-testid="random-count-plus">+</button>
        </div>
      ) : null}
      {needsList ? (
        <>
          {/* keep: multi-line options text; one per line */}
          <Row label={mode === "wheel" ? "Options (one per line)" : "Names (one per line)"}>
            <textarea className="filter" rows={4} value={names} onChange={(e) => setNames(e.target.value)} placeholder={mode === "wheel" ? "Pizza\nDosa\nNoodles" : "Asha\nRavi\nMeera"} data-testid="random-names-input" style={{ maxWidth: 360 }} />
          </Row>
          {mode === "teams" ? (
            <div className="add-row" style={{ alignItems: "center" }}>
              <button className="small-btn" onClick={() => setTeams(Math.max(2, teams - 1))} data-testid="random-teams-minus">−</button>
              <span className="resultval" style={{ fontSize: 20 }} data-testid="random-teams">{teams}</span>
              <button className="small-btn" onClick={() => setTeams(Math.min(6, teams + 1))} data-testid="random-teams-plus">+</button>
            </div>
          ) : null}
        </>
      ) : null}
      <div className="row">
        <button className="primary" disabled={noOptions} onClick={roll} data-testid="random-roll-button">{mode === "wheel" ? "Decide for me" : "Randomise"}</button>
        {noOptions ? <span className="muted small">Add at least one option.</span> : null}
      </div>
      {out.length ? (
        <div className="resultbox" data-testid="random-result">
          <p className="resultcap">{spin ? "The wheel says" : "Result"}</p>
          {out.map((o, i) => (
            <p key={i} className={out.length > 2 ? "small" : "resultval"} style={{ marginTop: 4 }} data-testid={`random-out-${i}`}>{o}</p>
          ))}
          {mode === "dice" && out.length > 1 ? <p className="small">Total {out.reduce((acc, bx) => acc + Number(bx), 0)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------- Road trip ----------
function RoadTripTool() {
  const { db, update } = useStore();
  const cur = db.settings.currency;
  const [dist, setDist] = useState("450");
  const [mileage, setMileage] = useState("");
  const [price, setPrice] = useState("105");
  const [people, setPeople] = useState(2);
  const [tolls, setTolls] = useState("0");
  const lastFuel = [...db.fuel].sort((a, b) => b.date.localeCompare(a.date))[0];
  const distUnit = db.settings.distanceUnit;
  const defMileage = (() => {
    const v = db.vehicles.find((x) => x.id === db.settings.defaultVehicleId) ?? db.vehicles[0];
    if (!v) return "";
    const f = db.fuel.filter((x) => x.vehicleId === v.id).sort((a, b) => a.odometer - b.odometer);
    if (f.length < 2) return "";
    const km = f[f.length - 1].odometer - f[0].odometer;
    const l = f.slice(1).reduce((s, x) => s + x.litres, 0);
    return l > 0 ? (km / l).toFixed(1) : "";
  })();
  const M = parseNum(mileage || defMileage), D = parseNum(dist), P = parseNum(price || String(lastFuel?.price ?? 0)), TL = parseNum(tolls) || 0;
  const litres = M > 0 ? D / M : NaN;
  const fuelCost = litres * P;
  const total = fuelCost + TL;
  return (
    <div>
      <div className="add-row">
        <Row label={`Distance in ${distUnit} (round trip)`}>
          <input className="num filter" style={{ width: 110 }} value={dist} onChange={(e) => setDist(e.target.value)} data-testid="roadtrip-dist-input" />
        </Row>
        <Row label={`Mileage (${distUnit}/${db.settings.volumeUnit})`}>
          <input className="num filter" style={{ width: 110 }} value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder={defMileage || "15"} data-testid="roadtrip-mileage-input" />
        </Row>
        <Row label={`Fuel price (${cur})`}>
          <input className="num filter" style={{ width: 110 }} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={lastFuel ? String(lastFuel.price) : "100"} data-testid="roadtrip-price-input" />
        </Row>
        <Row label={`Tolls & parking (${cur})`}>
          <input className="num filter" style={{ width: 110 }} value={tolls} onChange={(e) => setTolls(e.target.value)} data-testid="roadtrip-tolls-input" />
        </Row>
      </div>
      <p className="muted small">{defMileage ? `Your logged average is ${defMileage}.` : "Log two fill-ups in Vehicles and mileage fills itself."}{lastFuel ? ` Last fill-up was ${money(lastFuel.price, cur)}.` : ""}</p>
      <div className="add-row" style={{ alignItems: "center" }}>
        <button className="small-btn" onClick={() => setPeople(Math.max(1, people - 1))} data-testid="roadtrip-people-minus">−</button>
        <span className="resultval" style={{ fontSize: 20 }} data-testid="roadtrip-people">{people}</span>
        <button className="small-btn" onClick={() => setPeople(Math.min(9, people + 1))} data-testid="roadtrip-people-plus">+</button>
        <span className="muted small">sharing the cost</span>
      </div>
      <ResultBox
        tool="roadtrip"
        label="Trip cost"
        value={isFinite(total) ? money(total, cur) : "—"}
        breakdown={isFinite(total) ? [["Fuel needed", `${num(litres, 1)} ${db.settings.volumeUnit}`], ["Fuel cost", money(fuelCost, cur)], ["Tolls & parking", money(TL, cur)], ["Per person", money(total / people, cur)], ["Per km", money(total / D, cur)]] : undefined}
        send={
          isFinite(total)
            ? {
                label: "Budget it",
                run: () =>
                  update((d) => addTxn(d, { id: uid(), type: "expense", amount: Number(total.toFixed(2)), category: "Travel", date: todayISO(), note: `Road trip · ${num(D, 0)} ${distUnit}` })),
              }
            : undefined
        }
      />
    </div>
  );
}

// ---------- custom tools (built in the Tool Builder) ----------
function CustomToolRunner({ toolId }: { toolId: string }) {
  const { db, update } = useStore();
  const tool = db.customTools.find((t) => t.id === toolId);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries((tool?.inputs ?? []).map((i) => [i.key, i.value])));
  if (!tool) return <p className="muted">This tool no longer exists.</p>;
  let value = "—";
  let error: string | undefined;
  let numeric = NaN;
  try {
    numeric = evaluateFormula(tool.formula, Object.fromEntries(tool.inputs.map((i) => [i.key, parseNum(vals[i.key] ?? i.value) || 0])));
    value = `${num(numeric, tool.decimals)}${tool.unit ? ` ${tool.unit}` : ""}`;
  } catch (e) {
    error = e instanceof Error ? e.message : "Check the formula";
  }
  return (
    <div>
      <div className="add-row">
        {tool.inputs.map((i) => (
          <Row key={i.id} label={i.unit ? `${i.label} (${i.unit})` : i.label}>
            <input className="num filter" style={{ width: 120 }} value={vals[i.key] ?? ""} onChange={(e) => setVals({ ...vals, [i.key]: e.target.value })} data-testid={`custom-${tool.id}-${i.key}`} />
          </Row>
        ))}
      </div>
      {error ? <p className="small" style={{ color: "var(--error)" }} data-testid="custom-tool-error">{error}</p> : null}
      <ResultBox
        tool={`custom:${tool.id}`}
        label={tool.outputLabel || tool.name}
        value={value}
        breakdown={[["Formula", tool.formula], ...tool.inputs.map((i) => [i.label, `${vals[i.key] ?? "0"}${i.unit ? ` ${i.unit}` : ""}`] as [string, string])]}
        send={tool.sendToMoney && isFinite(numeric) && numeric > 0 ? { label: "Add as expense", run: () => update((d) => addTxn(d, { id: uid(), type: "expense", amount: Number(numeric.toFixed(2)), category: "Other", date: todayISO(), note: `From ${tool.name}` })) } : undefined}
      />
      <p className="muted small">Your own tool · edit it in Tool Builder.</p>
    </div>
  );
}

const TOOL_LIST = [
  { id: "units", label: "Units" },
  { id: "percent", label: "GST & %" },
  { id: "split", label: "Tip & split" },
  { id: "dates", label: "Dates" },
  { id: "emi", label: "EMI" },
  { id: "growth", label: "Growth" },
  { id: "cooking", label: "Cooking" },
  { id: "time", label: "Time" },
  { id: "roadtrip", label: "Road trip" },
  { id: "random", label: "Decide" },
] as const;

type ToolRender = () => React.ReactElement;
const TOOL_COMPONENTS: Record<string, ToolRender> = {
  units: UnitsTool,
  percent: PercentTool,
  split: SplitTool,
  dates: DatesTool,
  emi: EmiTool,
  growth: GrowthTool,
  cooking: CookingTool,
  time: TimeTool,
  roadtrip: RoadTripTool,
  random: RandomTool,
};

export function Tools({ focusId }: { focusId?: string }) {
  const { db, update } = useStore();
  const initial = focusId && (TOOL_LIST.some((t) => t.id === focusId) || db.customTools.some((t) => t.id === focusId || `custom:${t.id}` === focusId));
  const [tool, setTool] = useState<string>(initial ? (focusId as string) : "units");
  const history = db.toolHistory.filter((h) => h.tool === tool).slice(0, 8);

  const cls = (id: string) => (tool === id ? "tab on" : "tab");
  const customOpen = tool.startsWith("custom:") ? tool.slice(7) : null;
  // Rendered as an element, never called as a function: each tool owns its own
  // hooks through its own fibre. Calling e.g. EmiTool() directly during this
  // render used to register its state inside Tools, so switching pills changed
  // the hook count and React unmounted the whole tree — the "blank screen" bug.
  const ToolComp = TOOL_COMPONENTS[tool];

  return (
    <>
      <header className="topbar">
        <div>
          <p className="caption">{TOOL_LIST.length} built-in tools · {db.customTools.length} of your own · results are saved per tool</p>
          <h1>Tools</h1>
        </div>
      </header>
      <div className="workcol">
        <nav className="tabwrap" aria-label="Tools" data-testid="tools-grid">
          {TOOL_LIST.map((t) => (
            <button key={t.id} className={cls(t.id)} data-testid={`tools-tile-${t.id}`} onClick={() => setTool(t.id)}>
              {t.label}
            </button>
          ))}
          {db.customTools.map((t) => (
            <button key={t.id} className={cls(`custom:${t.id}`)} data-testid={`tools-tile-custom-${t.id}`} onClick={() => setTool(`custom:${t.id}`)}>
              {t.name}
            </button>
          ))}
        </nav>
        <section className="card" data-testid={`tool-${tool}`}>
          {customOpen ? <CustomToolRunner key={tool} toolId={customOpen} /> : ToolComp ? <ToolComp key={tool} /> : null}
        </section>
        {history.length ? (
          <section className="card" data-testid="tools-history">
            <div className="row">
              <h2 style={{ margin: 0, flex: 1 }}>Saved results for this tool</h2>
              <button className="small-btn" onClick={() => update((d) => ({ ...d, toolHistory: d.toolHistory.filter((h) => h.tool !== tool) }))} data-testid="tools-history-clear">Clear all</button>
            </div>
            <table className="table wide">
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="muted small">{h.label}</td>
                    <td className="mono">{h.value}</td>
                    <td className="muted small no-print">{new Date(h.at).toLocaleDateString()}</td>
                    <td className="right no-print"><button className="link danger" onClick={() => update((d) => ({ ...d, toolHistory: d.toolHistory.filter((x) => x.id !== h.id) }))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
    </>
  );
}

