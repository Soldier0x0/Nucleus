import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { useLockSignal } from "@/src/core/lockSignal";
import { parsePairQrPayload } from "@/src/core/pairing";
import { buildPairRequest, handlePairResponse, parseDesktopAddress, parseInfoReply, phoneIdentity, setDesktopAddress, SyncError, syncErrorMessage, type DesktopIdentity } from "@/src/core/syncClient";
import { postSyncJson, syncFetch } from "@/src/core/syncTransport";
import { Button, Icon, T } from "@/src/components/ui";
import { Field } from "@/src/components/inputs";
import { useToast } from "@/src/components/Toast";
import { Section, SettingsScreen } from "./parts";

/** Pair a desktop by scanning its code, or by typing the address it shows. */
export function PairSettings() {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const gate = useLockSignal();
  const [permission, requestPermission] = useCameraPermissions();
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const scanning = useRef(true);
  const askedCamera = useRef(false);
  const deepHandled = useRef(false);
  const params = useLocalSearchParams<{ p?: string }>();

  /** Opened from the system camera scanning the desktop code: pair straight away. */
  useEffect(() => {
    const p = typeof params.p === "string" ? params.p.trim() : "";
    if (!p || deepHandled.current || gate !== "unlocked") return;
    deepHandled.current = true;
    void onScan(p);
  }, [params.p, gate, onScan]);

  /** Unlocking lands on this screen with the camera off; ask once, right away. */
  useEffect(() => {
    if (askedCamera.current || done || gate !== "unlocked") return;
    if (!permission || permission.granted || !permission.canAskAgain) return;
    askedCamera.current = true;
    void requestPermission();
  }, [done, gate, permission, requestPermission]);

  function fail(err: unknown) {
    const message = syncErrorMessage(err instanceof SyncError ? err.code : "unreachable");
    setError(message);
    toast(message, "alert-circle-outline");
  }

  /** Shared by the camera and the typed address: seal the request, keep what the desktop answers. */
  async function pairNow(desktop: DesktopIdentity, host: string, port: number, oneTimeCode: string) {
    const first = phoneIdentity(db);
    const request = buildPairRequest(first.identity, desktop, oneTimeCode);
    const reply = await postSyncJson(host, port, "/pair", request.body);
    const next = handlePairResponse(first.db, desktop, oneTimeCode, reply.body);
    const device = next.settings.pairedDevices.find((d) => d.id === desktop.deviceId) ?? next.settings.pairedDevices[next.settings.pairedDevices.length - 1];
    if (!device) throw new SyncError("bad-response");
    update(() => setDesktopAddress(next, device.id, host, port));
    setDone(device.name);
  }

  async function onScan(data: string) {
    if (busy || done || !scanning.current) return;
    const qr = parsePairQrPayload(data);
    if (!qr) {
      scanning.current = false;
      toast("That code is not a Nucleus pairing code", "alert-circle-outline");
      setTimeout(() => {
        scanning.current = true;
      }, 1200);
      return;
    }
    scanning.current = false;
    setBusy(true);
    setError("");
    try {
      await pairNow({ deviceId: qr.deviceId, name: qr.name, publicKey: qr.publicKey }, qr.host, qr.port, qr.code);
    } catch (err) {
      fail(err);
      scanning.current = true;
    } finally {
      setBusy(false);
    }
  }

  async function pairTyped() {
    const parsed = parseDesktopAddress(address);
    if (!parsed) {
      setError(syncErrorMessage("bad-address"));
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError("The code is the six digits shown on your desktop.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const info = await syncFetch(parsed.host, parsed.port, "/info");
      const desktop = info.status === 200 ? parseInfoReply(info.body) : null;
      if (!desktop) throw new SyncError(info.status === 503 ? "locked" : "bad-response");
      await pairNow(desktop, parsed.host, parsed.port, code.trim());
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const cameraReady = gate === "unlocked" && !done && permission?.granted;

  return (
    <SettingsScreen title="Pair a desktop" testID="settings-pair">
      <Section title="About this" anchor="about">
        <View style={{ padding: 12 }}>
          <T muted style={{ fontSize: 12 }} testID="pair-note">
            On your computer, open Nucleus, choose Desktop sync and show the pairing code. Point this phone at it, or type the address and code below.
          </T>
        </View>
      </Section>

      {done ? (
        <Section title="Paired" anchor="paired">
          <View style={{ padding: 12, gap: 12, alignItems: "flex-start" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon name="check-circle-outline" size={24} color={colors.success} />
              <T v="label" testID="pair-done">Paired with {done}</T>
            </View>
            <Button label="Done" icon="check" testID="pair-done-button" onPress={() => router.back()} />
          </View>
        </Section>
      ) : gate !== "unlocked" ? (
        <Section title="Locked" anchor="locked">
          <View style={{ padding: 12 }}>
            <T muted style={{ fontSize: 12 }} testID="pair-locked">
              Unlock Nucleus first. The camera stays off until your vault is open.
            </T>
          </View>
        </Section>
      ) : (
        <>
          <Section title="Scan the code" anchor="scan">
            {permission?.granted ? (
              <View style={{ margin: 12, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceTertiary }}>
                <View style={{ height: 260 }}>
                  <CameraView
                    style={{ flex: 1 }}
                    facing="back"
                    testID="pair-camera"
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={busy ? undefined : (scan) => void onScan(String(scan.data ?? ""))}
                  />
                </View>
                <View style={{ padding: 10 }}>
                  <T muted style={{ fontSize: 12 }} testID="pair-scan-hint">{busy ? "Pairing…" : "Hold the code inside the frame."}</T>
                </View>
              </View>
            ) : (
              <View style={{ padding: 12, gap: 10, alignItems: "flex-start" }}>
                <T muted style={{ fontSize: 12 }} testID="pair-permission-note">
                  {permission == null ? "Getting the camera ready…" : permission.canAskAgain ? "Nucleus uses the camera only to scan the pairing code." : "Camera access is off. Turn it on for Nucleus in Android Settings, or type the address below."}
                </T>
                {permission != null && permission.canAskAgain ? (
                  <Button small label="Allow camera" icon="camera-outline" testID="pair-permission-allow" onPress={() => void requestPermission()} />
                ) : null}
              </View>
            )}
          </Section>

          <Section title="Or type the address" anchor="typed">
            <View style={{ padding: 12, gap: 10 }}>
              <Field label="Address" testID="pair-manual-address" value={address} onChangeText={setAddress} placeholder="192.168.1.5:47821" autoCapitalize="none" autoCorrect={false} />
              <Field label="Code" testID="pair-manual-code" value={code} onChangeText={setCode} placeholder="123456" numeric maxLength={6} />
              <Button label={busy ? "Pairing…" : "Pair with the code"} icon="link-variant" testID="pair-manual-button" disabled={busy} onPress={() => void pairTyped()} />
            </View>
          </Section>
        </>
      )}

      {error ? (
        <View style={{ paddingHorizontal: 12 }}>
          <T color={colors.error} testID="pair-error">{error}</T>
        </View>
      ) : null}
    </SettingsScreen>
  );
}
