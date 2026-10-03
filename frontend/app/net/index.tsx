import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { useOnline } from "@/src/core/useOnline";
import { uid } from "@/src/core/format";
import { lookupDns, pingHost, startLanScan, stopLanScan, subscribeLan } from "@/src/native/android";
import { Header } from "@/src/components/Header";
import { Button, Card, Eyebrow, T } from "@/src/components/ui";
import { Field } from "@/src/components/inputs";
import { ModuleGate } from "@/src/components/ModuleGate";

/** Ping, DNS, and a scan of this phone's own private subnet. Results are not saved. */
export default function Network() {
  const { online, log } = useOnline();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const [host, setHost] = useState("");
  const [ping, setPing] = useState("");
  const [dns, setDns] = useState("");
  const [busy, setBusy] = useState<"ping" | "dns" | null>(null);
  const [scanning, setScanning] = useState(false);
  const [checked, setChecked] = useState(0);
  const [hosts, setHosts] = useState<string[]>([]);
  const [scanNote, setScanNote] = useState("");

  useEffect(() => {
    const stop = subscribeLan((event) => {
      if (event.type === "host" && event.ip) setHosts((list) => (list.includes(event.ip!) ? list : [...list, event.ip!].sort()));
      if (event.type === "progress") setChecked(event.checked ?? 0);
      if (event.type === "done") {
        setScanning(false);
        setScanNote(`${event.found ?? 0} answered`);
      }
      if (event.type === "error") {
        setScanning(false);
        setScanNote(event.message ?? "The scan stopped.");
      }
    });
    return () => {
      stop();
      stopLanScan();
    };
  }, []);

  const runPing = async () => {
    setBusy("ping");
    setPing("");
    try {
      const result = await pingHost(host);
      log({ id: uid(), at: new Date().toISOString(), service: "Ping", query: host.trim(), ok: result.ok });
      setPing(result.ok ? `${result.detail} · ${result.ms} ms` : result.detail);
    } catch (e: any) {
      setPing(e?.message ?? "No reply");
    } finally {
      setBusy(null);
    }
  };

  const runDns = async () => {
    setBusy("dns");
    setDns("");
    try {
      const result = await lookupDns(host);
      log({ id: uid(), at: new Date().toISOString(), service: "DNS", query: host.trim(), ok: true });
      setDns(result.addresses.join("\n") || "No address");
    } catch (e: any) {
      log({ id: uid(), at: new Date().toISOString(), service: "DNS", query: host.trim(), ok: false });
      setDns(e?.message ?? "That name did not resolve.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Network" testID="net-header" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <T muted style={{ fontSize: 12 }}>
          Online has to be on. A ping or a DNS lookup sends only the name you type. The scan looks at this phone's own private network, and only while this screen is open. Devices that do not answer on a common port stay hidden. Nothing from the scan is saved.
        </T>
        {!online ? <Card testID="net-offline"><T>Turn Online on in Settings. No check runs while it is off.</T></Card> : null}
        <>
            <Field label="Name or address" value={host} onChangeText={setHost} testID="net-host" autoCapitalize="none" autoCorrect={false} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button label="Ping" testID="net-ping" disabled={!online || !host.trim() || busy != null} onPress={runPing} style={{ flex: 1 }} />
              <Button kind="secondary" label="DNS" testID="net-dns" disabled={!online || !host.trim() || busy != null} onPress={runDns} style={{ flex: 1 }} />
            </View>
            {ping ? <T testID="net-ping-result">{ping}</T> : null}
            {dns ? <T testID="net-dns-result">{dns}</T> : null}
            <Eyebrow style={{ marginTop: 8 }}>This network</Eyebrow>
            <Button
              kind={scanning ? "danger" : "secondary"}
              label={scanning ? "Stop scan" : "Scan this network"}
              testID="net-scan"
              disabled={!online && !scanning}
              onPress={() => {
                if (scanning) {
                  stopLanScan();
                  setScanning(false);
                  return;
                }
                setHosts([]);
                setChecked(0);
                setScanNote("");
                const started = startLanScan();
                setScanning(started);
                if (started) log({ id: uid(), at: new Date().toISOString(), service: "This network", query: "private subnet", ok: true });
                else setScanNote("This check runs in the installed Android app.");
              }}
            />
            {scanning ? <T muted testID="net-progress">Checked {checked}</T> : null}
            {scanNote ? <T testID="net-scan-note">{scanNote}</T> : null}
            {hosts.map((ip) => <T key={ip} v="mono">{ip}</T>)}
        </>
      </ScrollView>
      <ModuleGate id="net" name="Network" icon="access-point-network" />
    </View>
  );
}
