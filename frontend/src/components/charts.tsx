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

/** Vertical month bars; highlights the last (current) bar. */
export function MonthBars({ data, width, height = 110, testID }: { data: { label: string; value: number }[]; width: number; height?: number; testID?: string }) {
  const { colors } = useTheme();
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
            <SvgText x={i * (bw + gap) + bw / 2} y={height - 4} fontSize={10} fontFamily={fonts.monoMedium} fill={colors.muted} textAnchor="middle">
              {d.label}
            </SvgText>
          </G>
        );
      })}
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
