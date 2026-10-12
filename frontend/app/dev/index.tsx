import React, { useMemo, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { copyTemporary } from "@/src/core/clipboard";
import { fromB64, fromUtf8, toB64, toUtf8 } from "@/src/core/crypto";
import { num } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Button, Chip, ChipRow, Eyebrow, Icon, Segmented, T } from "@/src/components/ui";
import { Field } from "@/src/components/inputs";
import { useToast } from "@/src/components/Toast";
import { ModuleGate } from "@/src/components/ModuleGate";

type Out = { value: string; error?: string; facts?: [string, string][] };

const TOOLS = [
  { id: "json", label: "JSON", icon: "code-json" },
  { id: "base64", label: "Base64", icon: "alpha-b-box-outline" },
  { id: "url", label: "URL", icon: "link-variant" },
  { id: "jwt", label: "JWT", icon: "shield-key-outline" },
  { id: "hash", label: "Hash", icon: "fingerprint" },
  { id: "uuid", label: "UUID", icon: "identifier" },
  { id: "time", label: "Timestamp", icon: "clock-outline" },
  { id: "regex", label: "Regex", icon: "regex" },
  { id: "diff", label: "Diff", icon: "compare-horizontal" },
  { id: "text", label: "Text", icon: "format-letter-case" },
  { id: "color", label: "Colour", icon: "palette-outline" },
] as const;

export default function DevTools() {
  const { db } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [tool, setTool] = useState<string>("json");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [mode, setMode] = useState("encode");
  const [hashAlgo, setHashAlgo] = useState("SHA256");
  const [hashOut, setHashOut] = useState("");
  const [uuids, setUuids] = useState<string[]>([]);

  const out: Out = useMemo(() => {
    try {
      if (tool === "json") {
        if (!a.trim()) return { value: "" };
        const parsed = JSON.parse(a);
        const text = mode === "encode" ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
        const count = (o: any): number => (o && typeof o === "object" ? Object.values(o).reduce((s: number, v) => s + count(v), 1) : 1);
        return { value: text, facts: [["Valid", "yes"], ["Nodes", String(count(parsed))], ["Characters", String(text.length)], ["Top-level type", Array.isArray(parsed) ? `array(${parsed.length})` : typeof parsed] ] };
      }
      if (tool === "base64") return { value: a ? (mode === "encode" ? toB64(toUtf8(a)) : fromUtf8(fromB64(a))) : "" };
      if (tool === "url") return { value: a ? (mode === "encode" ? encodeURIComponent(a) : decodeURIComponent(a)) : "" };
      if (tool === "jwt") {
        if (!a.trim()) return { value: "" };
        const [h, p, sig] = a.trim().split(".");
        if (!h || !p) throw new Error("A JWT has three dot-separated parts");
        const head = JSON.parse(fromUtf8(fromB64(h.replace(/-/g, "+").replace(/_/g, "/"))));
        const body = JSON.parse(fromUtf8(fromB64(p.replace(/-/g, "+").replace(/_/g, "/"))));
        const exp = body.exp ? new Date(body.exp * 1000) : null;
        return {
          value: `${JSON.stringify(head, null, 2)}\n\n${JSON.stringify(body, null, 2)}`,
          facts: [["Algorithm", head.alg ?? "—"], ["Expires", exp ? exp.toLocaleString() : "no exp"], ["Expired", exp ? (exp.getTime() < Date.now() ? "yes" : "no") : "—"], ["Signature", sig ? "present (not verified offline)" : "missing"]],
        };
      }
      if (tool === "time") {
        if (!a.trim()) {
          const now = Date.now();
          return { value: String(Math.floor(now / 1000)), facts: [["Milliseconds", String(now)], ["ISO", new Date(now).toISOString()], ["Local", new Date(now).toLocaleString()]] };
        }
        const n = Number(a.trim());
        const d = isFinite(n) ? new Date(n > 1e12 ? n : n * 1000) : new Date(a.trim());
        if (isNaN(d.getTime())) throw new Error("Not a timestamp or date");
        return { value: d.toISOString(), facts: [["Unix (s)", String(Math.floor(d.getTime() / 1000))], ["Unix (ms)", String(d.getTime())], ["Local", d.toLocaleString()], ["Weekday", d.toLocaleDateString(undefined, { weekday: "long" })]] };
      }
      if (tool === "regex") {
        if (!a) return { value: "" };
        const re = new RegExp(a, "g");
        const matches = [...b.matchAll(re)];
        return { value: matches.length ? matches.map((m, i) => `${i + 1}. "${m[0]}" @ ${m.index}${m.length > 1 ? ` · groups: ${m.slice(1).join(", ")}` : ""}`).join("\n") : "No matches", facts: [["Matches", String(matches.length)], ["Pattern", a]] };
      }
      if (tool === "diff") {
        const la = a.split("\n"), lb = b.split("\n");
        const lines: string[] = [];
        let same = 0;
        for (let i = 0; i < Math.max(la.length, lb.length); i++) {
          if (la[i] === lb[i]) {
            same++;
            lines.push(`  ${la[i] ?? ""}`);
          } else {
            if (la[i] !== undefined) lines.push(`- ${la[i]}`);
            if (lb[i] !== undefined) lines.push(`+ ${lb[i]}`);
          }
        }
        return { value: lines.join("\n"), facts: [["Lines left", String(la.length)], ["Lines right", String(lb.length)], ["Identical lines", String(same)]] };
      }
      if (tool === "text") {
        const words = a.trim() ? a.trim().split(/\s+/).length : 0;
        const cleaned = a.replace(/[ \t]+/g, " ").replace(/\s+\n/g, "\n").trim();
        return {
          value: mode === "encode" ? cleaned : a.toUpperCase(),
          facts: [["Characters", String(a.length)], ["Without spaces", String(a.replace(/\s/g, "").length)], ["Words", String(words)], ["Lines", String(a ? a.split("\n").length : 0)], ["Reading time", `${num(Math.max(words / 200, 0), 1)} min`]],
        };
      }
      if (tool === "color") {
        const hex = a.trim().replace("#", "");
        if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return { value: "", error: a.trim() ? "Enter a hex colour like 1E90FF" : undefined };
        const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
        const [r, g, bl] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
        const mx = Math.max(r, g, bl) / 255, mn = Math.min(r, g, bl) / 255, l = (mx + mn) / 2;
        const s = mx === mn ? 0 : l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
        let h = 0;
        if (mx !== mn) {
          const rn = r / 255, gn = g / 255, bn = bl / 255;
          h = mx === rn ? (gn - bn) / (mx - mn) + (gn < bn ? 6 : 0) : mx === gn ? (bn - rn) / (mx - mn) + 2 : (rn - gn) / (mx - mn) + 4;
          h *= 60;
        }
        const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (bl / 255);
        return {
          value: `#${full.toUpperCase()}`,
          facts: [["RGB", `${r}, ${g}, ${bl}`], ["HSL", `${num(h, 0)}°, ${num(s * 100, 0)}%, ${num(l * 100, 0)}%`], ["Relative luminance", num(lum, 3)], ["Readable text on it", lum > 0.45 ? "dark text" : "light text"]],
        };
      }
      return { value: "" };
    } catch (e: any) {
      return { value: "", error: e?.message ?? "Could not process that" };
    }
  }, [tool, a, b, mode]);

  const twoFields = tool === "regex" || tool === "diff";
  const show = tool === "hash" ? hashOut : tool === "uuid" ? uuids.join("\n") : out.value;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Dev Tools" testID="dev-header" />
      <ChipRow testID="dev-chip-row">
        {TOOLS.map((t) => (
          <Chip key={t.id} label={t.label} icon={t.icon} selected={tool === t.id} testID={`dev-chip-${t.id}`} onPress={() => (setTool(t.id), setA(""), setB(""), setHashOut(""), setUuids([]))} />
        ))}
      </ChipRow>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: sp.lg, paddingTop: 4, paddingBottom: insets.bottom + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {["base64", "url", "json", "text"].includes(tool) ? (
          <>
            <Segmented
              testID="dev-mode"
              value={mode}
              onChange={setMode}
              options={
                tool === "json"
                  ? [{ value: "encode", label: "Pretty" }, { value: "decode", label: "Minify" }]
                  : tool === "text"
                    ? [{ value: "encode", label: "Clean up" }, { value: "decode", label: "UPPERCASE" }]
                    : [{ value: "encode", label: "Encode" }, { value: "decode", label: "Decode" }]
              }
            />
            <View style={{ height: 12 }} />
          </>
        ) : null}

        {tool === "uuid" ? (
          <Button label="Generate 5 UUIDs" icon="refresh" testID="dev-uuid-button" onPress={() => setUuids(Array.from({ length: 5 }, () => Crypto.randomUUID()))} />
        ) : tool === "hash" ? (
          <>
            <Field label="Text to hash" testID="dev-hash-input" value={a} onChangeText={setA} multiline style={{ minHeight: 80 }} placeholder="anything" />
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {["SHA256", "SHA512", "SHA1", "MD5"].map((h) => (
                <Chip key={h} label={h} selected={hashAlgo === h} testID={`dev-hash-${h}`} onPress={() => setHashAlgo(h)} />
              ))}
            </View>
            <Button
              label="Hash it"
              icon="fingerprint"
              testID="dev-hash-button"
              disabled={!a.trim()}
              onPress={async () => {
                const map: Record<string, Crypto.CryptoDigestAlgorithm> = { SHA256: Crypto.CryptoDigestAlgorithm.SHA256, SHA512: Crypto.CryptoDigestAlgorithm.SHA512, SHA1: Crypto.CryptoDigestAlgorithm.SHA1, MD5: Crypto.CryptoDigestAlgorithm.MD5 };
                try {
                  setHashOut(await Crypto.digestStringAsync(map[hashAlgo], a));
                } catch {
                  setHashOut("");
                  toast(`${hashAlgo} is not available on this platform`, "alert-circle-outline");
                }
              }}
            />
          </>
        ) : (
          <>
            <Field
              label={tool === "regex" ? "Pattern (without slashes)" : tool === "diff" ? "Left text" : tool === "time" ? "Timestamp or date (blank = now)" : tool === "color" ? "Hex colour" : "Input"}
              testID="dev-a-input"
              value={a}
              onChangeText={setA}
              multiline={!["time", "color"].includes(tool)}
              autoCapitalize="none"
              style={!["time", "color", "regex"].includes(tool) ? { minHeight: 100 } : undefined}
              placeholder={tool === "regex" ? "\\d{4}-\\d{2}-\\d{2}" : tool === "color" ? "#1E90FF" : tool === "time" ? "1767225600" : "paste here"}
            />
            {twoFields ? <Field label={tool === "regex" ? "Test text" : "Right text"} testID="dev-b-input" value={b} onChangeText={setB} multiline style={{ minHeight: 100 }} autoCapitalize="none" /> : null}
          </>
        )}

        {out.error ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 }}>
            <Icon name="alert-circle-outline" size={18} color={colors.error} />
            <T style={{ flex: 1, color: colors.error, fontSize: 13 }} testID="dev-error">
              {out.error}
            </T>
          </View>
        ) : null}

        {show ? (
          <View style={{ backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: 16, marginTop: 12 }} testID="dev-output">
            <T v="caption" color={colors.onSurfaceInverse} style={{ opacity: 0.7, letterSpacing: 1 }}>
              OUTPUT
            </T>
            {tool === "color" ? <View style={{ height: 44, borderRadius: radius.md, marginTop: 8, backgroundColor: show }} testID="dev-color-swatch" /> : null}
            <T v="mono" color={colors.onSurfaceInverse} style={{ marginTop: 8, fontSize: 13 }} selectable testID="dev-output-value">
              {show}
            </T>
            {out.facts?.length ? (
              <View style={{ marginTop: 12, gap: 4 }}>
                {out.facts.map(([k, v]) => (
                  <View key={k} style={{ flexDirection: "row" }}>
                    <T color={colors.onSurfaceInverse} style={{ flex: 1, opacity: 0.75, fontSize: 13 }}>
                      {k}
                    </T>
                    <T v="mono" color={colors.onSurfaceInverse} style={{ fontSize: 13 }}>
                      {v}
                    </T>
                  </View>
                ))}
              </View>
            ) : null}
            <Button
              small
              kind="secondary"
              label="Copy"
              icon="content-copy"
              style={{ marginTop: 12, alignSelf: "flex-start" }}
              testID="dev-copy-button"
              onPress={async () => {
                await copyTemporary(show, db.settings.clipboardAutoClear ? 60 : 3600);
                toast("Copied", "content-copy");
              }}
            />
          </View>
        ) : null}

        <Eyebrow style={{ marginTop: 20 }}>Everything runs on this device — nothing is uploaded, not even hashes.</Eyebrow>
      </KeyboardAwareScrollView>
      <ModuleGate id="dev" name="Dev Tools" icon="code-braces" />
    </View>
  );
}
