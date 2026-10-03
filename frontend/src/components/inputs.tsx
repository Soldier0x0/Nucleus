import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { fonts, radius, useTheme, bindLookStyles } from "@/src/theme";
import { addDays, addMonths, fmtDate, parseISO, toISODate, todayISO } from "@/src/core/format";
import { Icon, Press, T } from "./ui";
import { Sheet } from "./Sheet";

/** Labelled input with the unit attached to the field (tap the unit to change it). */
export function Field({ label, unit, onUnitPress, testID, hint, error, style, numeric, ...rest }: TextInputProps & { label: string; unit?: string; onUnitPress?: () => void; testID?: string; hint?: string; error?: string; numeric?: boolean }) {
  const { colors } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 12 }, style as any]}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <View style={[styles.box, { backgroundColor: colors.surfaceSecondary, borderColor: error ? colors.error : focus ? colors.onSurface : colors.borderStrong }]}>
        <TextInput
          testID={testID}
          placeholderTextColor={colors.muted}
          keyboardType={numeric ? "decimal-pad" : rest.keyboardType}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          {...rest}
          style={[styles.input, { color: colors.onSurface, fontFamily: numeric ? fonts.monoMedium : fonts.text }]}
        />
        {unit ? (
          <Pressable testID={testID ? `${testID}-unit` : undefined} onPress={onUnitPress} disabled={!onUnitPress} style={[styles.unit, { borderLeftColor: colors.border }]}>
            <Text style={{ fontFamily: fonts.monoMedium, fontSize: 14, color: colors.onSurface }}>{unit}</Text>
            {onUnitPress ? <Icon name="chevron-down" size={16} color={colors.muted} /> : null}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={{ flexDirection: "row", gap: 4, marginTop: 4, alignItems: "center" }}>
          <Icon name="alert-circle-outline" size={14} color={colors.error} />
          <Text testID={testID ? `${testID}-error` : undefined} style={{ color: colors.error, fontFamily: fonts.textMedium, fontSize: 12 }}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text style={{ color: colors.muted, fontFamily: fonts.text, fontSize: 12, marginTop: 4 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

const WD = ["M", "T", "W", "T", "F", "S", "S"];

/** Date field with quick chips and a calendar sheet — no typing required. */
export function DateField({ label, value, onChange, testID, optional }: { label: string; value?: string; onChange: (v?: string) => void; testID?: string; optional?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState((value ?? todayISO()).slice(0, 7) + "-01");
  const first = parseISO(cursor);
  const startPad = (first.getDay() + 6) % 7;
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const today = todayISO();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <Press testID={testID} onPress={() => setOpen(true)} style={[styles.box, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong, paddingHorizontal: 14 }]}>
        <Icon name="calendar-blank-outline" size={18} color={colors.muted} />
        <Text style={{ flex: 1, marginLeft: 10, fontFamily: fonts.monoMedium, fontSize: 15, color: value ? colors.onSurface : colors.muted }}>{value ? fmtDate(value) : "Not set"}</Text>
        <Icon name="chevron-down" size={18} color={colors.muted} />
      </Press>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label} testID={testID ? `${testID}-sheet` : undefined}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Press testID={testID ? `${testID}-prev` : undefined} onPress={() => setCursor(addMonths(cursor, -1))} style={styles.navBtn}>
            <Icon name="chevron-left" size={24} />
          </Press>
          <T v="h2" style={{ flex: 1, textAlign: "center" }}>
            {first.toLocaleString("en-US", { month: "long" })} {first.getFullYear()}
          </T>
          <Press testID={testID ? `${testID}-next` : undefined} onPress={() => setCursor(addMonths(cursor, 1))} style={styles.navBtn}>
            <Icon name="chevron-right" size={24} />
          </Press>
        </View>
        <View style={styles.grid}>
          {WD.map((d, i) => (
            <Text key={i} style={[styles.cell, { color: colors.muted, fontFamily: fonts.monoMedium, fontSize: 11, height: 24 }]}>
              {d}
            </Text>
          ))}
          {cells.map((d, i) => {
            if (!d) return <View key={i} style={styles.cell} />;
            const iso = toISODate(new Date(first.getFullYear(), first.getMonth(), d));
            const sel = iso === value;
            const isToday = iso === today;
            return (
              <Pressable
                key={i}
                testID={testID ? `${testID}-day-${d}` : undefined}
                onPress={() => {
                  onChange(iso);
                  setOpen(false);
                }}
                style={[styles.cell, styles.day, sel && { backgroundColor: colors.surfaceInverse }, !sel && isToday && { borderWidth: 1, borderColor: colors.onSurface }]}
              >
                <Text style={{ fontFamily: fonts.monoMedium, fontSize: 14, color: sel ? colors.onSurfaceInverse : colors.onSurface }}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {[
            { l: "Today", v: today },
            { l: "Yesterday", v: addDays(today, -1) },
            { l: "+1 month", v: addMonths(today, 1) },
            { l: "+1 year", v: addMonths(today, 12) },
          ].map((q) => (
            <Press key={q.l} onPress={() => (onChange(q.v), setOpen(false))} style={[styles.quick, { borderColor: colors.borderStrong }]}>
              <Text style={{ fontFamily: fonts.textMedium, fontSize: 13, color: colors.onSurface }}>{q.l}</Text>
            </Press>
          ))}
          {optional && value ? (
            <Press onPress={() => (onChange(undefined), setOpen(false))} style={[styles.quick, { borderColor: colors.error }]}>
              <Text style={{ fontFamily: fonts.textMedium, fontSize: 13, color: colors.error }}>Clear</Text>
            </Press>
          ) : null}
        </View>
      </Sheet>
    </View>
  );
}

/** Option picker presented in a sheet (for units, categories, etc). */
export function OptionSheet({ visible, onClose, title, options, value, onPick, testID }: { visible: boolean; onClose: () => void; title: string; options: { value: string; label: string }[]; value?: string; onPick: (v: string) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} testID={testID}>
      {options.map((o) => (
        <Press
          key={o.value}
          testID={testID ? `${testID}-opt-${o.value}` : undefined}
          onPress={() => {
            onPick(o.value);
            onClose();
          }}
          style={[styles.opt, { borderBottomColor: colors.divider }]}
        >
          <Text style={{ flex: 1, fontFamily: fonts.textMedium, fontSize: 15, color: colors.onSurface }}>{o.label}</Text>
          {o.value === value ? <Icon name="check" size={20} /> : null}
        </Press>
      ))}
    </Sheet>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  label: { fontFamily: fonts.textMedium, fontSize: 12, marginBottom: 6, letterSpacing: 0.2 },
  box: { flexDirection: "row", alignItems: "center", minHeight: 50, borderWidth: 1, borderRadius: radius.md },
  input: { flex: 1, paddingHorizontal: 14, fontSize: 16, minHeight: 48 },
  unit: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 12, alignSelf: "stretch", borderLeftWidth: 1, minWidth: 56, justifyContent: "center" },
  navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: "center", justifyContent: "center", textAlign: "center" },
  day: { borderRadius: radius.md },
  quick: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
  opt: { flexDirection: "row", alignItems: "center", minHeight: 50, borderBottomWidth: 1 },
}));
