import React, { useEffect, useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme, bindLookStyles } from "@/src/theme";
import { useStore } from "@/src/core/store";
import type { Rule, RuleAction, RuleTriggerKind } from "@/src/core/types";
import { dryRun, evaluateRule, markFired, reminders, ruleSentence, TRIGGERS, triggerMeta } from "@/src/core/rules";
import { notificationsSupported, permissionState, requestPermission, scheduledCount, syncReminders } from "@/src/core/notify";
import { num, uid } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Button, Card, Chip, EmptyState, Eyebrow, Icon, IconButton, Press, Segmented, T } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { Field } from "@/src/components/inputs";
import { useToast } from "@/src/components/Toast";

const newRule = (): Rule => ({ id: uid(), name: "", trigger: { kind: "renewal", value: 3 }, actions: ["attention"], enabled: true, createdAt: new Date().toISOString() });

export default function Rules() {
  const { db, update, setSettings } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [edit, setEdit] = useState<Rule | null>(null);
  const [perm, setPerm] = useState<{ granted: boolean; canAskAgain: boolean; undetermined: boolean } | null>(null);
  const [askPerm, setAskPerm] = useState(false);
  const [scheduled, setScheduled] = useState(0);

  useEffect(() => {
    permissionState().then(setPerm);
    scheduledCount().then(setScheduled);
  }, [db.rules, db.settings.remindersEnabled]);

  const wantsReminders = db.rules.some((r) => r.enabled && r.actions.includes("notify"));

  const applyReminders = async () => {
    const list = reminders(db);
    const keys = await syncReminders(list);
    const once = list.filter((r) => r.once && keys.includes(r.key)).map((r) => r.key);
    if (once.length) update((d) => markFired(d, once));
    setScheduled(await scheduledCount());
    if (keys.length) toast(`${keys.length} reminder${keys.length === 1 ? "" : "s"} scheduled`, "bell-outline");
    return keys;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Rules" testID="rules-header" right={<IconButton icon="plus" label="New rule" testID="rule-add-button" onPress={() => setEdit(newRule())} />} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: sp.md, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {db.rules.length === 0 ? (
          <EmptyState
            testID="rules-empty"
            icon="source-branch"
            title="No rules yet"
            body="A rule is one sentence: when something is about to happen, Nucleus shows it in Attention or reminds you. All of it is evaluated on this device."
            action={<Button label="Create a rule" icon="plus" testID="rules-empty-add" onPress={() => setEdit(newRule())} />}
          />
        ) : null}

        {db.rules.map((r) => {
          const meta = triggerMeta(r.trigger.kind);
          const hits = evaluateRule(db, r);
          return (
            <Card key={r.id} testID={`rule-card-${r.id}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[styles.ic, { backgroundColor: r.enabled ? colors.brandTertiary : colors.surfaceTertiary }]}>
                  <Icon name={meta.icon} size={20} color={r.enabled ? colors.onBrandTertiary : colors.muted} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="h2" numberOfLines={1}>
                    {r.name || meta.label}
                  </T>
                  <T muted style={{ fontSize: 12 }}>
                    {hits.length ? `Matching now · ${hits.length}` : "Nothing matching right now"}
                  </T>
                </View>
                <Switch
                  testID={`rule-toggle-${r.id}`}
                  value={r.enabled}
                  onValueChange={(v) => update((d) => ({ ...d, rules: d.rules.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)) }))}
                  trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
                  thumbColor={colors.surfaceSecondary}
                />
              </View>
              <T style={{ marginTop: 10 }}>{ruleSentence(r)}</T>
              {hits.slice(0, 3).map((h) => (
                <View key={h.key} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <Icon name="circle-small" size={18} color={colors.muted} />
                  <T numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                    {h.title}
                  </T>
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Button small kind="secondary" label="Edit" icon="pencil-outline" testID={`rule-edit-${r.id}`} onPress={() => setEdit(r)} />
                <Button
                  small
                  kind="ghost"
                  label="Delete"
                  icon="delete-outline"
                  testID={`rule-delete-${r.id}`}
                  onPress={() => {
                    update((d) => ({ ...d, rules: d.rules.filter((x) => x.id !== r.id) }));
                    toast("Rule deleted", "delete-outline");
                  }}
                />
              </View>
            </Card>
          );
        })}

        {wantsReminders ? (
          <Card testID="rules-reminders-card" tone="tint">
            <Eyebrow style={{ color: colors.onBrandTertiary }}>Reminders</Eyebrow>
            <T color={colors.onBrandTertiary} style={{ marginTop: 6 }}>
              {!notificationsSupported
                ? "Reminders work in the installed Android or iOS app, not in this web preview."
                : perm?.granted
                  ? `${scheduled} reminder${scheduled === 1 ? "" : "s"} are scheduled with your phone. They are one-off alarms — nothing is sent anywhere.`
                  : "Nucleus needs permission to post reminders on your phone. Dated rules fire at 9 am on the day."}
            </T>
            {notificationsSupported ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {perm?.granted ? (
                  <Button small label="Re-sync reminders" icon="bell-ring-outline" testID="rules-sync-button" onPress={applyReminders} />
                ) : perm?.canAskAgain || perm?.undetermined ? (
                  <Button small label="Allow reminders" icon="bell-outline" testID="rules-permission-button" onPress={() => setAskPerm(true)} />
                ) : (
                  <Button small label="Open settings" icon="cog-outline" testID="rules-settings-button" onPress={() => Linking.openSettings()} />
                )}
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card testID="rules-quiet-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Icon name="weather-night" size={20} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <T v="label">Quiet hours</T>
              <T muted style={{ fontSize: 12 }}>
                {db.settings.quietHours.enabled ? `No reminders between ${String(db.settings.quietHours.from).padStart(2, "0")}:00 and ${String(db.settings.quietHours.to).padStart(2, "0")}:00 — they move to the morning.` : "Reminders can arrive at any hour."}
              </T>
            </View>
            <Switch
              testID="rules-quiet-switch"
              value={db.settings.quietHours.enabled}
              onValueChange={(v) => setSettings({ quietHours: { ...db.settings.quietHours, enabled: v } })}
              trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
              thumbColor={colors.surfaceSecondary}
            />
          </View>
          {db.settings.quietHours.enabled ? (
            <View style={{ marginTop: 12 }}>
              <Segmented
                testID="rules-quiet-window"
                value={`${db.settings.quietHours.from}-${db.settings.quietHours.to}`}
                onChange={(v) => {
                  const [from, to] = v.split("-").map(Number);
                  setSettings({ quietHours: { enabled: true, from, to } });
                }}
                options={[
                  { value: "21-7", label: "21 – 07" },
                  { value: "22-7", label: "22 – 07" },
                  { value: "23-8", label: "23 – 08" },
                ]}
              />
            </View>
          ) : null}
        </Card>
      </ScrollView>

      {edit ? <RuleSheet rule={edit} onClose={() => setEdit(null)} onSaved={applyReminders} /> : null}

      <Sheet visible={askPerm} onClose={() => setAskPerm(false)} title="Remind you on your phone?" testID="rules-permission-sheet">
        <T style={{ marginBottom: 12 }}>Nucleus will post a reminder shortly before the things your rules watch — a renewal, an expiry, a trip. The reminders are scheduled on this device from your own data; nothing is uploaded.</T>
        <T muted style={{ marginBottom: 16 }}>You can turn them off at any time, and quiet hours are respected.</T>
        <Button
          label="Continue"
          icon="bell-outline"
          testID="rules-permission-continue"
          onPress={async () => {
            const p = await requestPermission();
            setPerm(p);
            setAskPerm(false);
            if (p.granted) {
              setSettings({ remindersEnabled: true });
              await syncReminders(reminders(db));
              setScheduled(await scheduledCount());
              toast("Reminders are on", "bell-ring-outline");
            } else if (!p.canAskAgain && Platform.OS !== "web") {
              toast("Turn reminders on in system settings", "cog-outline");
            }
          }}
        />
      </Sheet>
    </View>
  );
}

function RuleSheet({ rule, onClose, onSaved }: { rule: Rule; onClose: () => void; onSaved: () => void }) {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const [kind, setKind] = useState<RuleTriggerKind>(rule.trigger.kind);
  const [value, setValue] = useState(String(rule.trigger.value));
  const [name, setName] = useState(rule.name);
  const [actions, setActions] = useState<RuleAction[]>(rule.actions);
  const meta = triggerMeta(kind);
  const v = Number(value) || meta.options[0];
  const draft: Rule = { ...rule, name: name.trim() || meta.label, trigger: { kind, value: v }, actions };
  const run = dryRun(db, draft);
  const exists = db.rules.some((r) => r.id === rule.id);
  const moduleOff = !db.settings.modules.find((m) => m.id === meta.module)?.enabled;

  const toggle = (a: RuleAction) => setActions((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  return (
    <Sheet
      visible
      onClose={onClose}
      title={exists ? "Edit rule" : "New rule"}
      testID="rule-sheet"
      footer={
        <Button
          label={exists ? "Save rule" : "Create rule"}
          icon="check"
          testID="rule-save-button"
          disabled={!actions.length}
          onPress={() => {
            update((d) => ({ ...d, rules: exists ? d.rules.map((r) => (r.id === draft.id ? draft : r)) : [...d.rules, draft] }));
            onClose();
            onSaved();
          }}
        />
      }
    >
      <Eyebrow style={{ marginBottom: 8 }}>When…</Eyebrow>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {TRIGGERS.map((t) => (
          <Chip
            key={t.kind}
            label={t.label}
            icon={t.icon}
            selected={kind === t.kind}
            testID={`rule-trigger-${t.kind}`}
            onPress={() => {
              setKind(t.kind);
              setValue(String(t.options[Math.floor(t.options.length / 2)]));
            }}
          />
        ))}
      </View>

      <Eyebrow style={{ marginBottom: 8 }}>{meta.unit === "%" ? "Threshold" : meta.unit === "amount" ? "Amount" : `How many ${meta.unit}`}</Eyebrow>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {meta.options.map((o) => (
          <Chip key={o} label={meta.unit === "%" ? `${o}%` : num(o, 0)} selected={v === o} testID={`rule-value-${o}`} onPress={() => setValue(String(o))} />
        ))}
      </View>
      <Field numeric label="Or type your own" unit={meta.unit === "amount" ? db.settings.currency : meta.unit} testID="rule-value-input" value={value} onChangeText={setValue} />

      <Eyebrow style={{ marginBottom: 8 }}>Then…</Eyebrow>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <Chip label="Show in Attention" icon="bell-badge-outline" selected={actions.includes("attention")} testID="rule-action-attention" onPress={() => toggle("attention")} />
        <Chip label="Remind me" icon="bell-outline" selected={actions.includes("notify")} testID="rule-action-notify" onPress={() => toggle("notify")} />
      </View>

      <Field label="Name this rule" testID="rule-name-input" value={name} onChangeText={setName} placeholder={meta.label} />

      <View style={[styles.preview, { backgroundColor: colors.surfaceInverse }]} testID="rule-preview">
        <T v="caption" color={colors.onSurfaceInverse} style={{ opacity: 0.7, letterSpacing: 1 }}>
          YOUR RULE
        </T>
        <T color={colors.onSurfaceInverse} style={{ marginTop: 6 }}>
          {ruleSentence(draft)}
        </T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
          <Icon name="history" size={16} color={colors.onSurfaceInverse} />
          <T color={colors.onSurfaceInverse} style={{ flex: 1, fontSize: 13, opacity: 0.85 }} testID="rule-dryrun">
            Dry run: this would have fired about {run.count} time{run.count === 1 ? "" : "s"} in the {run.window}.
          </T>
        </View>
      </View>

      {moduleOff ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" }}>
          <Icon name="alert-outline" size={18} color={colors.warning} />
          <T style={{ flex: 1, color: colors.warning, fontSize: 13 }}>The {meta.module} module is switched off, so this rule will stay quiet until you turn it back on.</T>
        </View>
      ) : null}

      {actions.includes("notify") ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" }}>
          <Icon name="cellphone-cog" size={18} color={colors.muted} />
          <T muted style={{ flex: 1, fontSize: 12 }}>Reminders need the installed app — they do not fire in Expo Go or the web preview.</T>
        </View>
      ) : null}

      {exists ? (
        <Press
          testID="rule-duplicate-button"
          onPress={() => {
            update((d) => ({ ...d, rules: [...d.rules, { ...draft, id: uid(), name: `${draft.name} copy`, createdAt: new Date().toISOString() }] }));
            onClose();
          }}
          style={{ marginTop: 16, flexDirection: "row", gap: 8, alignItems: "center" }}
        >
          <Icon name="content-duplicate" size={18} color={colors.muted} />
          <T muted>Duplicate this rule</T>
        </Press>
      ) : null}
    </Sheet>
  );
}

const styles = bindLookStyles(() => StyleSheet.create({
  ic: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  preview: { borderRadius: radius.lg, padding: 14, marginTop: 4 },
}));
