import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { fonts, useTheme } from "@/src/theme";

/** Progress ring. `value` 0..1 (can exceed 1, ring shows overflow in error tone). */
export function Ring({ value, size = 120, stroke = 12, children, color, testID }: { value: number; size?: number; stroke?: number; children?: React.ReactNode; color?: string; testID?: string }) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const over = value > 1;
  const tone = color ?? (over ? colors.error : value >= 0.8 ? colors.warning : colors.brandPrimary);
  return (
    <View testID={testID} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceTertiary} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={stroke} fill="none" strokeDasharray={`${c * v} ${c}`} strokeLinecap="butt" />
        {/* tick marks every 10% — instrument feel */}
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * 2 * Math.PI - Math.PI / 2;
          const r1 = r + stroke / 2 + 2;
          const r2 = r1 + 3;
          return <Line key={i} x1={size / 2 + r1 * Math.cos(a)} y1={size / 2 + r1 * Math.sin(a)} x2={size / 2 + r2 * Math.cos(a)} y2={size / 2 + r2 * Math.sin(a)} stroke={colors.borderStrong} strokeWidth={1} />;
        })}
      </Svg>
      {children}
    </View>
  );
}

/** Semi-circular gauge, e.g. km since service vs interval. */
export function Gauge({ value, max, size = 200, label, sub, testID }: { value: number; max: number; size?: number; label?: string; sub?: string; testID?: string }) {
  const { colors } = useTheme();
  const stroke = 14;
  const r = size / 2 - stroke;
  const cx = size / 2;
  const cy = size / 2;
  const frac = max > 0 ? Math.max(0, Math.min(1.0, value / max)) : 0;
  const arc = (f: number) => {
    const a = Math.PI * (1 - f);
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };
  const start = arc(0);
  const end = arc(frac);
  const full = arc(1);
  const tone = value > max ? colors.error : frac >= 0.9 ? colors.warning : colors.brandPrimary;
  const h = size / 2 + 34;
  return (
    <View testID={testID} style={{ width: size, height: h }}>
      <Svg width={size} height={h}>
        <Path d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${full.x} ${full.y}`} stroke={colors.surfaceTertiary} strokeWidth={stroke} fill="none" />
        {frac > 0 && <Path d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`} stroke={tone} strokeWidth={stroke} fill="none" />}
        {Array.from({ length: 11 }).map((_, i) => {
          const a = Math.PI * (1 - i / 10);
          const r1 = r - stroke / 2 - 4;
          const r2 = r1 - (i % 5 === 0 ? 10 : 5);
          return <Line key={i} x1={cx + r1 * Math.cos(a)} y1={cy - r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy - r2 * Math.sin(a)} stroke={colors.borderStrong} strokeWidth={i % 5 === 0 ? 2 : 1} />;
        })}
        {/* needle */}
        <Line x1={cx} y1={cy} x2={cx + (r - 24) * Math.cos(Math.PI * (1 - frac))} y2={cy - (r - 24) * Math.sin(Math.PI * (1 - frac))} stroke={colors.onSurface} strokeWidth={3} />
        <Circle cx={cx} cy={cy} r={6} fill={colors.onSurface} />
        {label ? (
          <SvgText x={cx} y={cy + 26} fontSize={18} fontFamily={fonts.monoBold} fill={colors.onSurface} textAnchor="middle">
            {label}
          </SvgText>
        ) : null}
      </Svg>
      {sub ? null : null}
    </View>
  );
}

/** Line chart with soft area fill and last-point marker. */
export function LineChart({ data, width, height = 120, testID, showAvg }: { data: number[]; width: number; height?: number; testID?: string; showAvg?: boolean }) {
  const { colors } = useTheme();
  if (data.length < 2) return <View testID={testID} style={{ width, height }} />;
  const pad = 8;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const x = (i: number) => pad + (i / (data.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);
  const d = data.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${y(v)}`).join(" ");
  const area = `${d} L ${x(data.length - 1)} ${height} L ${x(0)} ${height} Z`;
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  return (
    <Svg testID={testID} width={width} height={height}>
      <Defs>
        <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.brandPrimary} stopOpacity={0.25} />
          <Stop offset="1" stopColor={colors.brandPrimary} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <Line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke={colors.divider} strokeWidth={1} />
      ))}
      <Path d={area} fill="url(#fill)" />
      <Path d={d} stroke={colors.brandPrimary} strokeWidth={2.5} fill="none" />
      {showAvg && <Line x1={0} x2={width} y1={y(avg)} y2={y(avg)} stroke={colors.muted} strokeWidth={1} strokeDasharray="4 4" />}
      {data.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={y(v)} r={i === data.length - 1 ? 5 : 2.5} fill={i === data.length - 1 ? colors.onSurface : colors.brandPrimary} />
      ))}
    </Svg>
  );
}

/** Short number for chart labels: 950, 3.5k, 42k. */
export function compactValue(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10000) return `${Math.round(n / 1000)}k`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

/** Vertical month bars; highlights the last (current) bar. Values stay hidden unless asked. */
export function MonthBars({ data, width, height = 110, testID, showValues = false, format }: { data: { label: string; value: number }[]; width: number; height?: number; testID?: string; showValues?: boolean; format?: (value: number) => string }) {
  const { colors } = useTheme();
  const fmt = format ?? compactValue;
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = 8;
  const bw = (width - gap * (data.length - 1)) / data.length;
  const chartH = height - 18;
  return (
    <Svg testID={testID} width={width} height={height}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * (chartH - 4));
        const last = i === data.length - 1;
        return (
          <G key={d.label + i}>
            <Rect x={i * (bw + gap)} y={chartH - h} width={bw} height={h} rx={3} fill={last ? colors.brandPrimary : colors.surfaceTertiary} stroke={last ? "none" : colors.borderStrong} strokeWidth={1} />
            {showValues && d.value > 0 ? (
              <SvgText x={i * (bw + gap) + bw / 2} y={chartH - h - 3} fontSize={9} fontFamily={fonts.monoMedium} fill={colors.muted} textAnchor="middle">
                {fmt(d.value)}
              </SvgText>
            ) : null}
            <SvgText x={i * (bw + gap) + bw / 2} y={height - 4} fontSize={10} fontFamily={fonts.monoMedium} fill={colors.muted} textAnchor="middle">
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/** The slice order for a Pie, so a legend can point at the same colours. */
export const PIE_TONES = ["brandPrimary", "success", "info", "warning", "error", "brandSecondary", "brandTertiary", "muted"] as const;

type PieColors = { brandPrimary: string; success: string; info: string; warning: string; error: string; brandSecondary: string; brandTertiary: string; muted: string };

export function pieColor(colors: PieColors, index: number): string {
  return colors[PIE_TONES[index % PIE_TONES.length]];
}

/** Category share. Colours come from the theme; the legend stays with the screen. */
export function Pie({ data, size = 160, showValues = false, format, testID }: { data: { label: string; value: number; color?: string }[]; size?: number; showValues?: boolean; format?: (value: number) => string; testID?: string }) {
  const { colors } = useTheme();
  const rows = data.filter((d) => d.value > 0);
  const total = rows.reduce((s, d) => s + d.value, 0);
  if (!total) return <View testID={testID} style={{ width: size, height: size }} />;
  const fmt = format ?? compactValue;
  const r = size / 2;
  const cx = r;
  const cy = r;
  const slices = rows.map((d, i) => {
    const frac = d.value / total;
    const before = rows.slice(0, i).reduce((s, row) => s + row.value, 0) / total;
    const a0 = -Math.PI / 2 + before * Math.PI * 2;
    const a1 = a0 + frac * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const path =
      rows.length === 1
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
        : `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
    return { path, color: d.color ?? pieColor(colors, i), label: d.label, value: d.value, mid };
  });
  return (
    <View testID={testID} style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {slices.map((s) => (
          <Path key={s.label} d={s.path} fill={s.color} stroke={colors.surfaceSecondary} strokeWidth={1.5} />
        ))}
        {showValues
          ? slices.map((s) => (
              <SvgText key={`v-${s.label}`} x={cx + r * 0.62 * Math.cos(s.mid)} y={cy + r * 0.62 * Math.sin(s.mid) + 3} fontSize={10} fontFamily={fonts.monoMedium} fill={colors.onSurface} textAnchor="middle">
                {fmt(s.value)}
              </SvgText>
            ))
          : null}
      </Svg>
    </View>
  );
}

/** Online vs in-person bars, two per month. Values stay hidden unless asked. */
export function ChannelBars({ data, width, height = 110, testID, showValues = false, format }: { data: { label: string; online: number; inPerson: number }[]; width: number; height?: number; testID?: string; showValues?: boolean; format?: (value: number) => string }) {
  const { colors } = useTheme();
  const fmt = format ?? compactValue;
  const max = Math.max(1, ...data.flatMap((d) => [d.online, d.inPerson]));
  const gap = 10;
  const groupW = (width - gap * Math.max(0, data.length - 1)) / Math.max(1, data.length);
  const bw = Math.max(3, (groupW - 4) / 2);
  const chartH = height - 18;
  return (
    <Svg testID={testID} width={width} height={height}>
      {data.map((d, i) => {
        const x = i * (groupW + gap);
        const ho = Math.max(2, (d.online / max) * (chartH - 4));
        const hp = Math.max(2, (d.inPerson / max) * (chartH - 4));
        return (
          <G key={d.label + i}>
            <Rect x={x} y={chartH - ho} width={bw} height={ho} rx={2} fill={colors.info} />
            <Rect x={x + bw + 4} y={chartH - hp} width={bw} height={hp} rx={2} fill={colors.success} />
            {showValues ? (
              <>
                <SvgText x={x + bw / 2} y={chartH - ho - 3} fontSize={9} fontFamily={fonts.monoMedium} fill={colors.muted} textAnchor="middle">
                  {d.online > 0 ? fmt(d.online) : ""}
                </SvgText>
                <SvgText x={x + bw + 4 + bw / 2} y={chartH - hp - 3} fontSize={9} fontFamily={fonts.monoMedium} fill={colors.muted} textAnchor="middle">
                  {d.inPerson > 0 ? fmt(d.inPerson) : ""}
                </SvgText>
              </>
            ) : null}
            <SvgText x={x + groupW / 2} y={height - 4} fontSize={10} fontFamily={fonts.monoMedium} fill={colors.muted} textAnchor="middle">
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/** Fill-up cost bars with a mileage line, for one vehicle. Values stay hidden unless asked. */
export function FillChart({ data, width, height = 140, testID, showValues = false, format }: { data: { label: string; cost: number; mileage?: number }[]; width: number; height?: number; testID?: string; showValues?: boolean; format?: (value: number, kind: "cost" | "mileage") => string }) {
  const { colors } = useTheme();
  if (!data.length) return <View testID={testID} style={{ width, height }} />;
  const fmt = (value: number, kind: "cost" | "mileage") => (format ? format(value, kind) : compactValue(value));
  const maxCost = Math.max(1, ...data.map((d) => d.cost));
  const miles = data.map((d) => d.mileage).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const minM = miles.length ? Math.min(...miles) : 0;
  const rangeM = miles.length ? Math.max(...miles) - minM || 1 : 1;
  const gap = 6;
  const bw = (width - gap * (data.length - 1)) / data.length;
  const chartH = height - 18;
  const top = 14;
  const plot = chartH - top;
  const barH = (cost: number) => Math.max(2, (cost / maxCost) * (plot - 4));
  const pointY = (v: number) => top * 0.4 + (1 - (v - minM) / rangeM) * (plot - 8);
  const points = data.map((d, i) => ({
    x: i * (bw + gap) + bw / 2,
    y: typeof d.mileage === "number" && Number.isFinite(d.mileage) ? pointY(d.mileage) : null,
  }));
  const line = points.filter((p) => p.y !== null).map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  return (
    <Svg testID={testID} width={width} height={height}>
      {data.map((d, i) => {
        const h = barH(d.cost);
        return (
          <G key={d.label + i}>
            <Rect x={i * (bw + gap)} y={chartH - h} width={bw} height={h} rx={2} fill={colors.brandSecondary} opacity={0.55} />
            {showValues && d.cost > 0 ? (
              <SvgText x={i * (bw + gap) + bw / 2} y={chartH - h - 3} fontSize={8} fontFamily={fonts.monoMedium} fill={colors.muted} textAnchor="middle">
                {fmt(d.cost, "cost")}
              </SvgText>
            ) : null}
            <SvgText x={i * (bw + gap) + bw / 2} y={height - 4} fontSize={9} fontFamily={fonts.monoMedium} fill={colors.muted} textAnchor="middle">
              {d.label}
            </SvgText>
          </G>
        );
      })}
      {line ? <Path d={line} stroke={colors.brandPrimary} strokeWidth={2} fill="none" /> : null}
      {points.map((p, i) =>
        p.y === null ? null : (
          <G key={`p-${i}`}>
            <Circle cx={p.x} cy={p.y} r={3} fill={colors.brandPrimary} />
            {showValues && data[i].mileage !== undefined ? (
              <SvgText x={p.x} y={p.y - 6} fontSize={8} fontFamily={fonts.monoMedium} fill={colors.muted} textAnchor="middle">
                {fmt(data[i].mileage as number, "mileage")}
              </SvgText>
            ) : null}
          </G>
        ),
      )}
    </Svg>
  );
}

/** Horizontal proportion bar with optional limit marker. */
export function Bar({ value, max, limit, height = 8, testID }: { value: number; max: number; limit?: number; height?: number; testID?: string }) {
  const { colors } = useTheme();
  const f = max > 0 ? Math.min(1, value / max) : 0;
  const over = limit !== undefined && limit > 0 && value > limit;
  return (
    <View testID={testID} style={{ height, borderRadius: height / 2, backgroundColor: colors.surfaceTertiary, overflow: "hidden" }}>
      <View style={{ width: `${f * 100}%`, height, backgroundColor: over ? colors.error : colors.brandPrimary }} />
      {limit !== undefined && limit > 0 && max > 0 ? <View style={{ position: "absolute", left: `${Math.min(1, limit / max) * 100}%`, top: 0, bottom: 0, width: 2, backgroundColor: colors.onSurface }} /> : null}
    </View>
  );
}

/** Countdown bar: how much of a window remains (e.g. 30-day expiry window). */
export function Countdown({ remaining, window, testID }: { remaining: number; window: number; testID?: string }) {
  const { colors } = useTheme();
  const f = Math.max(0, Math.min(1, remaining / window));
  const tone = remaining <= 0 ? colors.error : f < 0.25 ? colors.warning : colors.success;
  const segs = 20;
  return (
    <View testID={testID} style={{ flexDirection: "row", gap: 2 }}>
      {Array.from({ length: segs }).map((_, i) => (
        <View key={i} style={{ flex: 1, height: 8, borderRadius: 1, backgroundColor: i < Math.round(f * segs) ? tone : colors.surfaceTertiary }} />
      ))}
    </View>
  );
}
