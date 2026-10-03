import { useMemo, useState } from "react";
import { Platform, ScrollView, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { applyPack, buildPack, builtinTemplates, packChoices, parsePack, type PackChoice, type PackFile } from "@/src/core/packs";
import { Header } from "@/src/components/Header";
import { Button, Card, Eyebrow, Icon, Press, T } from "@/src/components/ui";
import { Field } from "@/src/components/inputs";
import { QrCode } from "@/src/components/QrCode";
import { useToast } from "@/src/components/Toast";

export default function Packs() {
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [name, setName] = useState("My pack");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [json, setJson] = useState("");
  const [incoming, setIncoming] = useState<PackFile | null>(null);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [paste, setPaste] = useState("");

  const rows = useMemo(() => {
    const out: { key: string; label: string; detail: string }[] = [];
    db.rules.forEach((r) => out.push({ key: `rule:${r.id}`, label: r.name, detail: "Rule" }));
    db.customTools.forEach((t) => out.push({ key: `tool:${t.id}`, label: t.name, detail: "Custom tool" }));
    db.notes.filter((n) => n.checklist.length).forEach((n) => out.push({ key: `list:${n.id}`, label: n.title || "Checklist", detail: "Checklist" }));
    db.templates.forEach((t) => out.push({ key: `saved:${t.id}`, label: t.name, detail: "Your template" }));
    builtinTemplates().forEach((t) => out.push({ key: `built:${t.name}`, label: t.name, detail: "Built-in template" }));
    return out;
  }, [db.rules, db.customTools, db.notes, db.templates]);

  const share = async () => {
    const pack = buildPack(name, {
      rules: db.rules.filter((r) => picked[`rule:${r.id}`]),
      tools: db.customTools.filter((t) => picked[`tool:${t.id}`]),
      checklists: db.notes.filter((n) => n.checklist.length && picked[`list:${n.id}`]).map((n) => ({ title: n.title || "Checklist", items: n.checklist.map((c) => c.text) })),
      templates: [
        ...db.templates.filter((t) => picked[`saved:${t.id}`]).map((t) => ({ name: t.name, groups: t.groups })),
        ...builtinTemplates().filter((t) => picked[`built:${t.name}`]),
      ],
    });
    if (!pack.rules.length && !pack.tools.length && !pack.checklists.length && !pack.templates.length) {
      toast("Choose at least one item", "alert-circle-outline");
      return;
    }
    const text = JSON.stringify(pack);
    setJson(text);
    if (Platform.OS === "web") {
      await Clipboard.setStringAsync(text);
      toast("Pack copied", "content-copy");
      return;
    }
    const safe = pack.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 24) || "pack";
    const file = new File(Paths.cache, `nucleus-pack-${safe}.json`);
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Share Nucleus pack" });
  };

  const openText = (text: string) => {
    try {
      const pack = parsePack(text);
      const choices = packChoices(db, pack);
      const next: Record<string, boolean> = {};
      choices.forEach((c) => {
        next[c.key] = !c.already;
      });
      setIncoming(pack);
      setApproved(next);
    } catch (e: any) {
      toast(e?.message ?? "Couldn't read that pack", "alert-circle-outline");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Packs" testID="packs-header" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <T muted style={{ fontSize: 12 }}>A pack is templates, custom tools, checklists and rules. The other phone adds only the rows you both approve. Your records stay here.</T>
        <Eyebrow>Share</Eyebrow>
        <Field label="Pack name" value={name} onChangeText={setName} testID="pack-name" />
        {rows.map((row) => (
          <Check key={row.key} testID={`pack-pick-${row.key}`} label={row.label} detail={row.detail} on={!!picked[row.key]} onPress={() => setPicked((p) => ({ ...p, [row.key]: !p[row.key] }))} />
        ))}
        <Button label="Share pack file" icon="export-variant" testID="pack-share" onPress={share} />
        {json && json.length <= 1200 ? (
          <Card testID="pack-qr">
            <T muted style={{ fontSize: 12, marginBottom: 8 }}>This pack is short enough for a code. On the other phone, paste the text or open the file. The camera stays off.</T>
            <View style={{ alignItems: "center" }}>
              <QrCode text={json} />
            </View>
            <Button kind="ghost" label="Copy pack text" testID="pack-copy" onPress={() => Clipboard.setStringAsync(json).then(() => toast("Copied", "content-copy"))} />
          </Card>
        ) : null}
        <Eyebrow style={{ marginTop: 8 }}>Bring in</Eyebrow>
        <Button kind="secondary" label="Open a pack file" icon="file-document-outline" testID="pack-open" onPress={async () => {
          const res = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
          if (res.canceled || !res.assets?.[0]) return;
          const asset = res.assets[0];
          const text = Platform.OS === "web" ? (asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text()) : await new File(asset.uri).text();
          openText(text);
        }} />
        <TextInput testID="pack-paste" value={paste} onChangeText={setPaste} multiline placeholder="Paste pack text" placeholderTextColor={colors.muted} style={{ minHeight: 80, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, color: colors.onSurface, textAlignVertical: "top" }} />
        <Button kind="secondary" label="Read pasted pack" testID="pack-read" onPress={() => openText(paste)} />
        {incoming ? <Review pack={incoming} choices={packChoices(db, incoming)} approved={approved} setApproved={setApproved} onAdd={() => { update((d) => applyPack(d, incoming, Object.entries(approved).filter(([, on]) => on).map(([key]) => key))); setIncoming(null); toast("Pack added", "check"); }} /> : null}
      </ScrollView>
    </View>
  );
}

function Check({ label, detail, on, onPress, testID }: { label: string; detail: string; on: boolean; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Press testID={testID} onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 }}>
      <Icon name={on ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={on ? colors.brandPrimary : colors.muted} />
      <View style={{ flex: 1 }}>
        <T numberOfLines={1}>{label}</T>
        <T muted style={{ fontSize: 12 }}>{detail}</T>
      </View>
    </Press>
  );
}

function Review({ pack, choices, approved, setApproved, onAdd }: { pack: PackFile; choices: PackChoice[]; approved: Record<string, boolean>; setApproved: (next: Record<string, boolean>) => void; onAdd: () => void }) {
  return (
    <Card testID="pack-review">
      <T v="h2">{pack.name}</T>
      <T muted style={{ fontSize: 12, marginBottom: 8 }}>Already here stays off. Turn on only what you want added.</T>
      {choices.map((c) => (
        <Check key={c.key} testID={`pack-approve-${c.key}`} label={c.label} detail={c.already ? `${c.detail} · already here` : c.detail} on={!!approved[c.key]} onPress={() => setApproved({ ...approved, [c.key]: !approved[c.key] })} />
      ))}
      <Button label="Add selected" testID="pack-add" onPress={onAdd} />
    </Card>
  );
}
