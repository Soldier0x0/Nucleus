import React, { useEffect, useState } from "react";
import { Switch, TextInput, View } from "react-native";
import { useTheme } from "@/src/theme";
import type { ModuleId } from "@/src/core/types";
import { useStore } from "@/src/core/store";
import { biometricAvailable, clearFailures, clearPin, hasDecoyPin, setDecoyPin, setPin, verifyPin } from "@/src/core/security";
import { LOCK_TIMEOUT_OPTIONS, lockTimeoutLabel, unlockSettingsForNewLock } from "@/src/core/lockSettings";
import { MODULES } from "@/src/core/modules";
import { shownInDecoy } from "@/src/core/profiles";
import { useRouter } from "expo-router";
import { Button, Chip, Icon, Segmented, T } from "@/src/components/ui";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { PinPad } from "@/src/components/PinPad";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { Row, Section, SettingsScreen, useSettingsAnchor, useSwitchColors } from "./parts";

/** Security and privacy: lock, profiles, screenshots, clipboard and privacy mode. */
export function SecuritySettings() {
  const { db, setSettings, session, profiles, activeProfileId, addProfile, switchProfile, renameProfile, deleteProfile, prepareDecoy } = useStore();
  const s = db.settings;
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const sw = useSwitchColors();
  const [pinFlow, setPinFlow] = useState<null | "enter" | "confirm">(null);
  const [first, setFirst] = useState("");
  const [pinErr, setPinErr] = useState<string>();
  const [pinKey, setPinKey] = useState(0);
  const [profileName, setProfileName] = useState("");
  const [rename, setRename] = useState("");
  const [delProfile, setDelProfile] = useState<string | null>(null);
  const [decoyFlow, setDecoyFlow] = useState<null | "enter" | "confirm">(null);
  const [decoyFirst, setDecoyFirst] = useState("");
  const [decoyOn, setDecoyOn] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = session === "real" && s.lockEnabled ? hasDecoyPin() : Promise.resolve(false);
    load.then((on) => {
      if (!cancelled) setDecoyOn(on);
    });
    return () => {
      cancelled = true;
    };
  }, [session, s.lockEnabled, pinKey]);
  useEffect(() => {
    let cancelled = false;
    const load = session === "real" ? biometricAvailable() : Promise.resolve(false);
    load.then((ok) => {
      if (!cancelled) setBioEnrolled(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [session, pinKey]);
  const anchor = useSettingsAnchor();
  return (
    <SettingsScreen title="Security and privacy" testID="settings-security" anchor={anchor}>
      <Section title="Security & privacy" anchor="security">
        <View style={{ padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}>
            <Icon name="lock-outline" size={20} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <T v="label">App lock</T>
              <T muted style={{ fontSize: 12 }}>
                {s.lockEnabled
                  ? `On · asks on open, after the phone locks, and after ${lockTimeoutLabel(s.lockTimeoutSec ?? 30).toLowerCase()} away`
                  : "Off · fingerprint or face unlock is available once lock is on and a PIN is set"}
              </T>
            </View>
            <Switch
              testID="settings-lock-switch"
              value={s.lockEnabled}
              onValueChange={async (v) => {
                if (v) {
                  setPinErr(undefined);
                  setPinFlow("enter");
                } else {
                  await clearPin();
                  await clearFailures();
                  setSettings({ lockEnabled: false, biometricEnabled: false, moduleLocks: [] });
                  toast("App lock turned off", "lock-open-outline");
                }
              }}
              {...sw}
            />
          </View>
          <View style={{ opacity: s.lockEnabled ? 1 : 0.45 }} pointerEvents={s.lockEnabled ? "auto" : "none"}>
            <T v="label" style={{ marginBottom: 4 }}>How you unlock</T>
            <T muted style={{ fontSize: 12, marginBottom: 8 }}>Your PIN always works as a fallback.</T>
            <Segmented
              testID="settings-unlock-method"
              value={s.unlockMethod}
              onChange={async (v) => {
                if (!s.lockEnabled) return;
                if (v !== "pin" && !(await biometricAvailable())) return toast("No fingerprint or face enrolled on this device", "alert-circle-outline");
                setSettings({ unlockMethod: v, biometricEnabled: v !== "pin" });
              }}
              options={[
                { value: "pin", label: "PIN" },
                { value: "biometric", label: "Fingerprint or face" },
                { value: "both", label: "Both" },
              ]}
            />
            {!bioEnrolled && s.lockEnabled ? (
              <T muted style={{ fontSize: 12, marginTop: 6 }} testID="settings-bio-hint">Enroll a fingerprint or face in Android settings to use biometrics here.</T>
            ) : null}
          </View>
          {s.lockEnabled ? (
            <View>
              <T v="label" style={{ marginBottom: 6 }}>Lock again after switching away</T>
              <Segmented
                testID="settings-lock-timeout"
                value={String(s.lockTimeoutSec ?? 30)}
                onChange={(v) => setSettings({ lockTimeoutSec: Number(v) })}
                options={LOCK_TIMEOUT_OPTIONS.map((o) => ({ value: String(o.sec), label: o.label }))}
              />
            </View>
          ) : null}
        </View>
        {s.lockEnabled ? (
          <>
            <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
              <T v="label" style={{ marginBottom: 8 }}>When the lock asks</T>
              <T muted style={{ fontSize: 12 }} testID="settings-lock-policy">
                It asks when you open the app, when the phone was locked or the screen turned off, and when you return after longer than {lockTimeoutLabel(s.lockTimeoutSec ?? 30).toLowerCase()}. Short trips to the photo picker or share sheet do not ask again.
              </T>
              <T muted style={{ fontSize: 12, marginTop: 6 }} testID="settings-pin-backoff">
                Wrong PINs are slower each time: five attempts are free, then waiting doubles from 30 seconds up to 30 minutes.
              </T>
            </View>
            <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
              <T v="label" style={{ marginBottom: 4 }}>Ask again for these modules</T>
              <T muted style={{ fontSize: 12, marginBottom: 8 }}>Opening them needs your PIN or biometrics again.</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {MODULES.filter((m) => m.status === "available" && (session === "real" || shownInDecoy(m.id))).map((m) => {
                  const on = (s.moduleLocks ?? []).includes(m.id as ModuleId);
                  return (
                    <Chip
                      key={m.id}
                      label={m.name}
                      icon={on ? "lock-outline" : "lock-open-variant-outline"}
                      selected={on}
                      testID={`settings-module-lock-${m.id}`}
                      onPress={() => setSettings({ moduleLocks: on ? (s.moduleLocks ?? []).filter((x) => x !== m.id) : [...(s.moduleLocks ?? []), m.id as ModuleId] })}
                    />
                  );
                })}
              </View>
            </View>
            {session === "real" ? (
              <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
                <T v="label">Decoy PIN</T>
                <T muted style={{ fontSize: 12, marginTop: 4, marginBottom: 8 }}>
                  {decoyOn ? "Set. It only works on the lock screen, and the app looks the same afterwards." : "A second PIN opens a sample workspace. Nothing on screen marks it as different. It only works on the lock screen."}
                </T>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button small kind="secondary" label={decoyOn ? "Change decoy PIN" : "Set decoy PIN"} testID="settings-decoy-button" onPress={() => (setPinErr(undefined), setDecoyFlow("enter"))} />
                </View>
              </View>
            ) : null}
          </>
        ) : null}
        <Row icon="content-copy" label="Clear clipboard after copying" sub="Wipes copied amounts after a minute" right={<Switch testID="settings-clipboard-switch" value={s.clipboardAutoClear} onValueChange={(v) => setSettings({ clipboardAutoClear: v })} {...sw} />} />
        <Row icon="eye-off-outline" label="Privacy mode" sub="Mask every amount until tapped" right={<Switch testID="settings-privacy-switch" value={s.privacyMode} onValueChange={(v) => setSettings({ privacyMode: v })} {...sw} />} />
        <Row icon="shield-account-outline" label="Privacy and usage" sub="What stays on this phone" testID="settings-privacy-usage" onPress={() => router.push("/privacy")} right={<Icon name="chevron-right" size={18} color={colors.muted} />} />
        <Row
          icon="cellphone-screenshot"
          label="Allow screen sharing"
          sub="Off by default. When on, Discord, WhatsApp, and screenshots can show this screen. Turn off after demos."
          right={
            <Switch
              testID="settings-screenshot-switch"
              value={!s.blockScreenshots}
              onValueChange={(v) => setSettings({ blockScreenshots: !v })}
              {...sw}
            />
          }
        />
      </Section>

      {session === "real" ? (
        <Section title="Profiles" anchor="profiles">
          <View style={{ padding: 12, gap: 8 }}>
            <T muted style={{ fontSize: 12 }}>Each profile keeps its own records, theme and boards. Hold is for tiles — tap a profile to switch.</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {profiles.map((p) => (
                <Chip key={p.id} label={p.id === activeProfileId && s.givenName ? s.givenName : p.name} selected={p.id === activeProfileId} testID={`profile-${p.id}`} onPress={() => switchProfile(p.id)} />
              ))}
            </View>
            <TextInput testID="profile-name-input" value={profileName} onChangeText={setProfileName} placeholder="New profile name" placeholderTextColor={colors.muted} style={{ height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
            <Button
              small
              kind="secondary"
              icon="plus"
              label="Add profile"
              testID="profile-add-button"
              onPress={async () => {
                const ok = await addProfile(profileName);
                if (!ok) toast("Six profiles is the limit", "alert-circle-outline");
                else {
                  setProfileName("");
                  toast("Profile added", "account-outline");
                }
              }}
            />
            <TextInput testID="profile-rename-input" value={rename} onChangeText={setRename} placeholder="Rename the open profile" placeholderTextColor={colors.muted} style={{ height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
            <Button small kind="ghost" label="Rename" testID="profile-rename-button" disabled={!rename.trim()} onPress={() => renameProfile(activeProfileId, rename).then(() => setRename(""))} />
            {profiles.filter((p) => p.id !== activeProfileId).map((p) => (
              <Button key={p.id} small kind="danger" label={`Delete ${p.name}`} testID={`profile-delete-${p.id}`} onPress={() => setDelProfile(p.id)} />
            ))}
          </View>
        </Section>
      ) : null}

      <Sheet visible={!!pinFlow} onClose={() => setPinFlow(null)} title={pinFlow === "confirm" ? "Confirm PIN" : "Choose a 4-digit PIN"} testID="settings-pin-sheet">
        <PinPad
          testID="settings-pin"
          resetKey={pinKey}
          error={pinErr}
          onComplete={async (p) => {
            if (pinFlow === "enter") {
              setFirst(p);
              setPinErr(undefined);
              setPinFlow("confirm");
              setPinKey((k) => k + 1);
            } else if (p === first) {
              await setPin(p);
              const bio = await biometricAvailable();
              const unlock = unlockSettingsForNewLock(bio);
              setSettings({ lockEnabled: true, ...unlock });
              setPinFlow(null);
              if (bio) toast("App lock is on · fingerprint or face included", "lock-outline");
              else toast("App lock is on · add a fingerprint or face in Android settings for biometrics", "lock-outline");
            } else {
              setPinErr("PINs didn't match");
              setPinFlow("enter");
              setPinKey((k) => k + 1);
            }
          }}
        />
      </Sheet>

      <Sheet visible={!!decoyFlow} onClose={() => setDecoyFlow(null)} title={decoyFlow === "confirm" ? "Confirm decoy PIN" : "Choose a decoy PIN"} testID="settings-decoy-sheet">
        <T muted style={{ marginBottom: 12 }}>Use a different PIN from your real one. Entering it on the lock screen opens the sample workspace.</T>
        <PinPad
          testID="settings-decoy-pin"
          resetKey={pinKey}
          error={pinErr}
          onComplete={async (p) => {
            if (decoyFlow === "enter") {
              if ((await verifyPin(p)) === "primary") {
                setPinErr("That is your real PIN. Choose another.");
                setPinKey((k) => k + 1);
                return;
              }
              setDecoyFirst(p);
              setPinErr(undefined);
              setDecoyFlow("confirm");
              setPinKey((k) => k + 1);
            } else if (p === decoyFirst) {
              await setDecoyPin(p);
              await prepareDecoy();
              setDecoyOn(true);
              setDecoyFlow(null);
              toast("Decoy PIN saved", "shield-lock-outline");
            } else {
              setPinErr("PINs didn't match");
              setDecoyFlow("enter");
              setPinKey((k) => k + 1);
            }
          }}
        />
      </Sheet>

      <ConfirmSheet
        visible={!!delProfile}
        id="profile-delete"
        title={`Delete ${profiles.find((p) => p.id === delProfile)?.name ?? "profile"}?`}
        body="Every record in this profile is removed. This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setDelProfile(null)}
        onConfirm={() => {
          if (!delProfile) return;
          deleteProfile(delProfile);
          setDelProfile(null);
          toast("Profile deleted", "account-remove-outline");
        }}
      />
    </SettingsScreen>
  );
}
