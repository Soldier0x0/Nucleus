import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { fonts, radius, useTheme, bindLookStyles } from "@/src/theme";
import { addDays, addMonths, fmtDate, parseISO, todayISO } from "@/src/core/format";
import { daysInMonth, MONTH_CHIPS, MONTHS, wheelISO, wheelYears } from "@/src/core/dateWheel";
import { Button, Icon, Press } from "./ui";
import { Wheel } from "./Wheel";
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

/** Date field: day, month and year wheels plus quick chips — no typing required. */
export function DateField({ label, value, onChange, testID, optional }: { label: string; value?: string; onChange: (v?: string) => void; testID?: string; optional?: boolean }) {
  const { colors } = useTheme();
  const today = todayISO();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? today);
  const d = parseISO(draft);
  const y = d.getFullYear();
  const m = d.getMonth();
  const years = wheelYears(parseISO(today).getFullYear(), y);
  const days = Array.from({ length: daysInMonth(y, m) }, (_, i) => String(i + 1));
  const pick = (iso: string) => (onChange(iso), setOpen(false));
  const id = (s: string) => (testID ? `${testID}-${s}` : s);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <Press testID={testID} onPress={() => (setDraft(value ?? today), setOpen(true))} style={[styles.box, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong, paddingHorizontal: 14 }]}>
        <Icon name="calendar-blank-outline" size={18} color={colors.muted} />
        <Text style={{ flex: 1, marginLeft: 10, fontFamily: fonts.monoMedium, fontSize: 15, color: value ? colors.onSurface : colors.muted }}>{value ? fmtDate(value) : "Not set"}</Text>
        <Icon name="chevron-down" size={18} color={colors.muted} />
      </Press>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label} testID={testID ? `${testID}-sheet` : undefined} footer={<Button label={`Set ${fmtDate(draft)}`} icon="check" testID={id("done")} onPress={() => pick(draft)} />}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
          <Wheel testID={id("wheel-day")} width={64} items={days} index={d.getDate() - 1} onChange={(i) => setDraft(wheelISO(y, m, i + 1))} />
          <Wheel testID={id("wheel-month")} width={80} items={MONTHS} index={m} onChange={(i) => setDraft(wheelISO(y, i, d.getDate()))} />
          <Wheel testID={id("wheel-year")} width={88} items={years.map(String)} index={years.indexOf(y)} onChange={(i) => setDraft(wheelISO(years[i], m, d.getDate()))} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {[
            { l: "Today", v: today },
            { l: "Yesterday", v: addDays(today, -1) },
            ...MONTH_CHIPS.map((n) => ({ l: `+${n} mo`, v: addMonths(today, n) })),
          ].map((q) => (
            <Press key={q.l} testID={id(`chip-${q.l.replace(/\W+/g, "")}`)} onPress={() => pick(q.v)} style={[styles.quick, { borderColor: colors.borderStrong }]}>
              <Text style={{ fontFamily: fonts.textMedium, fontSize: 13, color: colors.onSurface }}>{q.l}</Text>
            </Press>
          ))}
          {optional && value ? (
            <Press testID={id("clear")} onPress={() => (onChange(undefined), setOpen(false))} style={[styles.quick, { borderColor: colors.error }]}>
              <Text style={{ fontFamily: fonts.textMedium, fontSize: 13, color: colors.error }}>Clear</Text>
            </Press>
          ) : null}
        </View>
      </Sheet>
    </View>
  );
}

/** 24-hour time as HH:MM for odo and fuel timestamps. */
export function TimeField({ label, value, onChange, testID }: { label: string; value: string; onChange: (v: string) => void; testID?: string }) {
  const { colors } = useTheme();
  const chips = ["08:00", "12:30", "18:00", "21:00"];
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^\d:]/g, "").slice(0, 5))}
        placeholder="14:30"
        keyboardType="numbers-and-punctuation"
        style={[styles.box, styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong, fontFamily: fonts.monoMedium }]}
      />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {chips.map((chip) => (
          <Press key={chip} onPress={() => onChange(chip)} style={[styles.quick, { borderColor: colors.borderStrong }]}>
            <Text style={{ fontFamily: fonts.textMedium, fontSize: 13, color: colors.onSurface }}>{chip}</Text>
          </Press>
        ))}
      </View>
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
  quick: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
  opt: { flexDirection: "row", alignItems: "center", minHeight: 50, borderBottomWidth: 1 },
}));
