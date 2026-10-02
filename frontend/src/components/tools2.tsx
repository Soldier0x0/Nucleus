import React, { useState } from "react";
import { View } from "react-native";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { addTxn } from "@/src/core/actions";
import { money, num, parseNum, todayISO, uid } from "@/src/core/format";
import { evaluateFormula } from "@/src/core/formula";
import { Field } from "./inputs";
import { Button, Chip, ChipRow, Eyebrow, Icon, IconButton, Segmented, T } from "./ui";
import { Bar } from "./charts";
import { Result } from "./tools";
import { useToast } from "./Toast";

// ---------- Cooking ----------
const KITCHEN: Record<string, number> = { tsp: 4.92892, tbsp: 14.7868, cup: 236.588, ml: 1, L: 1000, "fl oz": 29.5735, pint: 473.176 };
// g per cup, the usual kitchen approximations
const DENSITY: Record<string, number> = { Water: 236, "Flour (plain)": 125, "Sugar (granulated)": 200, "Sugar (icing)": 120, Rice: 185, Butter: 227, Milk: 244, Honey: 340, "Oil (veg)": 218, Salt: 273 };

export function CookingTool() {
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
    <View>
      <Segmented testID="cooking-mode" value={mode} onChange={setMode} options={[{ value: "volume", label: "Volume" }, { value: "weight", label: "Cups → grams" }, { value: "scale", label: "Servings" }]} />
      <View style={{ height: 12 }} />
      {mode === "scale" ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Field style={{ flex: 1 }} numeric label="Recipe serves" testID="cooking-serv-from" value={servFrom} onChangeText={setServFrom} />
          <Field style={{ flex: 1 }} numeric label="You need" testID="cooking-serv-to" value={servTo} onChangeText={setServTo} />
        </View>
      ) : (
        <>
          <Field numeric label="Amount" unit={from} onUnitPress={() => setFrom(nextKey(KITCHEN, from))} testID="cooking-input" value={val} onChangeText={setVal} hint="Tap the unit to change it" />
          {mode === "volume" ? (
            <View style={{ marginHorizontal: -16 }}>
              <ChipRow testID="cooking-to-row">
                {Object.keys(KITCHEN).map((k) => (
                  <Chip key={k} label={k} selected={to === k} testID={`cooking-to-${k}`} onPress={() => setTo(k)} />
                ))}
              </ChipRow>
            </View>
          ) : (
            <View style={{ marginHorizontal: -16 }}>
              <ChipRow testID="cooking-ing-row">
                {Object.keys(DENSITY).map((k) => (
                  <Chip key={k} label={k} selected={ing === k} testID={`cooking-ing-${k}`} onPress={() => setIng(k)} />
                ))}
              </ChipRow>
            </View>
          )}
        </>
      )}
      <Result tool="cooking" label={mode === "scale" ? "Multiply everything by" : mode === "weight" ? `${val} ${from} of ${ing}` : `${val} ${from} in ${to}`} value={value} breakdown={bd.length ? bd : undefined} />
      <T muted style={{ fontSize: 12, marginTop: 8 }}>Cup = 236.6 ml (US). Weights are standard kitchen averages, not lab values.</T>
    </View>
  );
}

const nextKey = (o: Record<string, number>, cur: string) => {
  const k = Object.keys(o);
  return k[(k.indexOf(cur) + 1) % k.length];
};

// ---------- Time ----------
const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");

export function TimeTool() {
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
  if (mode === "diff") {
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
    <View>
      <Segmented testID="time-mode" value={mode} onChange={setMode} options={[{ value: "diff", label: "Between" }, { value: "add", label: "Add minutes" }, { value: "zones", label: "Time zones" }]} />
      <View style={{ height: 12 }} />
      {mode !== "zones" ? <Field label="Start time (HH:MM)" testID="time-a-input" value={a} onChangeText={setA} placeholder="09:30" /> : null}
      {mode === "diff" ? <Field label="End time (HH:MM)" testID="time-b-input" value={b} onChangeText={setB} placeholder="18:15" /> : null}
      {mode === "add" ? <Field numeric label="Minutes (use - to go back)" unit="min" testID="time-n-input" value={n} onChangeText={setN} keyboardType="numbers-and-punctuation" /> : null}
      <Result tool="time" label={mode === "zones" ? "Your local time" : mode === "diff" ? "Duration" : "Resulting time"} value={value} breakdown={bd} />
      {mode === "zones" ? <T muted style={{ fontSize: 12, marginTop: 8 }}>Fixed standard offsets — daylight saving is not tracked offline.</T> : null}
    </View>
  );
}

// ---------- Growth ----------
export function GrowthTool() {
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
    <View>
      <Segmented testID="growth-mode" value={mode} onChange={setMode} options={[{ value: "sip", label: "SIP" }, { value: "lumpsum", label: "Lump sum" }, { value: "cagr", label: "CAGR" }, { value: "inflation", label: "Inflation" }]} />
      <View style={{ height: 12 }} />
      <Field numeric label={mode === "sip" ? "Monthly amount" : mode === "cagr" ? "Starting value" : "Amount"} unit={cur} testID="growth-amount-input" value={amt} onChangeText={setAmt} />
      {mode === "cagr" ? <Field numeric label="Value later" unit={cur} testID="growth-future-input" value={future} onChangeText={setFuture} /> : <Field numeric label={mode === "inflation" ? "Inflation rate" : "Expected return"} unit="% p.a." testID="growth-rate-input" value={rate} onChangeText={setRate} />}
      <Field numeric label="Years" unit="yr" testID="growth-years-input" value={years} onChangeText={setYears} />
      {isFinite(result) && isFinite(invested) && result > 0 ? (
        <View style={{ marginBottom: 12 }} testID="growth-bar">
          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            <T v="caption" style={{ flex: 1 }}>Invested {num((invested / result) * 100, 0)}%</T>
            <T v="caption" muted>Growth {num(((result - invested) / result) * 100, 0)}%</T>
          </View>
          <Bar value={invested} max={result} height={12} />
        </View>
      ) : null}
      <Result tool="growth" label={mode === "cagr" ? "Compound annual growth" : mode === "inflation" ? "Worth in today's money" : "Future value"} value={value} breakdown={bd} />
      <T muted style={{ fontSize: 12, marginTop: 8 }}>Plain compound interest maths. Not advice — returns are assumptions you type in.</T>
    </View>
  );
}

// ---------- Randomizer ----------
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function RandomTool() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<"dice" | "coin" | "number" | "card" | "teams" | "wheel">("dice");
  const [sides, setSides] = useState("6");
  const [count, setCount] = useState(2);
  const [lo, setLo] = useState("1");
  const [hi, setHi] = useState("100");
  const [names, setNames] = useState("");
  const [teams, setTeams] = useState(2);
  const [out, setOut] = useState<string[]>([]);
  const [spin, setSpin] = useState<string | null>(null);

  const roll = () => {
    const r = (n: number) => Math.floor(Math.random() * n);
    if (mode === "dice") setOut(Array.from({ length: count }, () => String(r(Math.max(2, parseNum(sides) || 6)) + 1)));
    else if (mode === "coin") setOut(Array.from({ length: count }, () => (r(2) ? "Heads" : "Tails")));
    else if (mode === "number") {
      const L = parseNum(lo) || 0, H = parseNum(hi) || 100;
      setOut([String(Math.min(L, H) + r(Math.abs(H - L) + 1))]);
    } else if (mode === "card") {
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
        shuffled.forEach((n, i) => buckets[i % buckets.length].push(n));
        setOut(buckets.map((b, i) => `Team ${i + 1}: ${b.join(", ")}`));
      }
    }
  };

  return (
    <View>
      <View style={{ marginHorizontal: -16 }}>
        <ChipRow testID="random-mode-row">
          {([["dice", "Dice", "dice-5-outline"], ["coin", "Coin", "circle-outline"], ["number", "Number", "numeric"], ["card", "Cards", "cards-outline"], ["teams", "Teams", "account-group-outline"], ["wheel", "Decide", "chart-donut"]] as const).map(([k, l, ic]) => (
            <Chip key={k} label={l} icon={ic} selected={mode === k} testID={`random-mode-${k}`} onPress={() => (setMode(k), setOut([]), setSpin(null))} />
          ))}
        </ChipRow>
      </View>
      {mode === "dice" ? <Field numeric label="Sides" unit="d" testID="random-sides-input" value={sides} onChangeText={setSides} /> : null}
      {mode === "number" ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Field style={{ flex: 1 }} numeric label="From" testID="random-lo-input" value={lo} onChangeText={setLo} />
          <Field style={{ flex: 1 }} numeric label="To" testID="random-hi-input" value={hi} onChangeText={setHi} />
        </View>
      ) : null}
      {mode === "dice" || mode === "coin" || mode === "card" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 }}>
          <IconButton icon="minus" filled testID="random-count-minus" label="Fewer" onPress={() => setCount(Math.max(1, count - 1))} />
          <T v="monoXl" testID="random-count">{count}</T>
          <IconButton icon="plus" filled testID="random-count-plus" label="More" onPress={() => setCount(Math.min(5, count + 1))} />
          <T muted style={{ flex: 1 }}>how many</T>
        </View>
      ) : null}
      {mode === "teams" || mode === "wheel" ? (
        <>
          <Field label={mode === "wheel" ? "Options (one per line)" : "Names (one per line)"} testID="random-names-input" value={names} onChangeText={setNames} multiline style={{ minHeight: 90 }} placeholder={mode === "wheel" ? "Pizza\nDosa\nNoodles" : "Asha\nRavi\nMeera"} />
          {mode === "teams" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <IconButton icon="minus" filled testID="random-teams-minus" label="Fewer teams" onPress={() => setTeams(Math.max(2, teams - 1))} />
              <T v="monoXl" testID="random-teams">{teams}</T>
              <IconButton icon="plus" filled testID="random-teams-plus" label="More teams" onPress={() => setTeams(Math.min(6, teams + 1))} />
              <T muted style={{ flex: 1 }}>teams</T>
            </View>
          ) : null}
        </>
      ) : null}
      <Button label={mode === "wheel" ? "Decide for me" : "Randomise"} icon="dice-multiple-outline" testID="random-roll-button" onPress={roll} />
      {out.length ? (
        <View style={[{ backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: 16, marginTop: 12 }]} testID="random-result">
          <T v="caption" color={colors.onSurfaceInverse} style={{ opacity: 0.7, letterSpacing: 1 }}>
            {spin ? "THE WHEEL SAYS" : "RESULT"}
          </T>
          {out.map((o, i) => (
            <T key={i} v={out.length > 2 ? "label" : "monoXl"} color={colors.onSurfaceInverse} style={{ marginTop: 6 }} testID={`random-out-${i}`}>
              {o}
            </T>
          ))}
          {mode === "dice" && out.length > 1 ? (
            <T color={colors.onSurfaceInverse} style={{ marginTop: 8, opacity: 0.8 }}>
              Total {out.reduce((a, b) => a + Number(b), 0)}
            </T>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ---------- Road trip ----------
export function RoadTripTool() {
  const { db, update } = useStore();
  const toast = useToast();
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
    <View>
      <Field numeric label="Distance (round trip)" unit={db.settings.distanceUnit} testID="roadtrip-dist-input" value={dist} onChangeText={setDist} />
      <Field numeric label="Mileage" unit={`${db.settings.distanceUnit}/${db.settings.volumeUnit}`} testID="roadtrip-mileage-input" value={mileage} onChangeText={setMileage} placeholder={defMileage || "15"} hint={defMileage ? `Your logged average is ${defMileage}` : "Log two fill-ups and this fills itself"} />
      <Field numeric label="Fuel price" unit={cur} testID="roadtrip-price-input" value={price} onChangeText={setPrice} placeholder={lastFuel ? String(lastFuel.price) : "100"} hint={lastFuel ? `Last fill-up was ${money(lastFuel.price, cur, { decimals: true })}` : undefined} />
      <Field numeric label="Tolls & parking" unit={cur} testID="roadtrip-tolls-input" value={tolls} onChangeText={setTolls} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <IconButton icon="minus" filled testID="roadtrip-people-minus" label="Fewer" onPress={() => setPeople(Math.max(1, people - 1))} />
        <T v="monoXl" testID="roadtrip-people">{people}</T>
        <IconButton icon="plus" filled testID="roadtrip-people-plus" label="More" onPress={() => setPeople(Math.min(9, people + 1))} />
        <T muted style={{ flex: 1 }}>sharing the cost</T>
      </View>
      <Result
        tool="roadtrip"
        label="Trip cost"
        value={isFinite(total) ? money(total, cur) : "—"}
        breakdown={isFinite(total) ? [["Fuel needed", `${num(litres, 1)} ${db.settings.volumeUnit}`], ["Fuel cost", money(fuelCost, cur)], ["Tolls & parking", money(TL, cur)], ["Per person", money(total / people, cur)], ["Per km", money(total / D, cur, { decimals: true })]] : undefined}
        send={isFinite(total) && db.settings.modules.find((m) => m.id === "money")?.enabled ? { label: "Budget it", run: () => (update((d) => addTxn(d, { id: uid(), type: "expense", amount: Number(total.toFixed(2)), category: "Travel", date: todayISO(), note: `Road trip · ${num(D, 0)} ${distUnit}` })), toast("Added to Money", "send-outline")) } : undefined}
      />
    </View>
  );
}

// ---------- custom tools (built in the Tool Builder) ----------
export function CustomToolRunner({ toolId }: { toolId: string }) {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const tool = db.customTools.find((t) => t.id === toolId);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries((tool?.inputs ?? []).map((i) => [i.key, i.value])));
  if (!tool) return <T muted>This tool no longer exists.</T>;
  let value = "—";
  let error: string | undefined;
  let numeric = NaN;
  try {
    numeric = evaluateFormula(tool.formula, Object.fromEntries(tool.inputs.map((i) => [i.key, parseNum(vals[i.key] ?? i.value) || 0])));
    value = `${num(numeric, tool.decimals)}${tool.unit ? ` ${tool.unit}` : ""}`;
  } catch (e: any) {
    error = e?.message ?? "Check the formula";
  }
  return (
    <View>
      {tool.inputs.map((i) => (
        <Field key={i.id} numeric label={i.label} unit={i.unit} testID={`custom-${tool.id}-${i.key}`} value={vals[i.key] ?? ""} onChangeText={(t) => setVals({ ...vals, [i.key]: t })} />
      ))}
      {error ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <Icon name="alert-circle-outline" size={18} color={colors.error} />
          <T style={{ flex: 1, color: colors.error, fontSize: 13 }} testID="custom-tool-error">
            {error}
          </T>
        </View>
      ) : null}
      <Result
        tool={`custom:${tool.id}`}
        label={tool.outputLabel || tool.name}
        value={value}
        breakdown={[["Formula", tool.formula], ...tool.inputs.map((i) => [i.label, `${vals[i.key] ?? "0"}${i.unit ? ` ${i.unit}` : ""}`] as [string, string])]}
        send={tool.sendToMoney && isFinite(numeric) && numeric > 0 ? { label: "Add as expense", run: () => (update((d) => addTxn(d, { id: uid(), type: "expense", amount: Number(numeric.toFixed(2)), category: "Other", date: todayISO(), note: `From ${tool.name}` })), toast("Expense added to Money", "send-outline")) } : undefined}
      />
      <Eyebrow style={{ marginTop: 12 }}>Your own tool · edit it in Tool Builder</Eyebrow>
    </View>
  );
}
