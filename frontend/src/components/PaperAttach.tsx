import { Image } from "expo-image";
import { View } from "react-native";
import { radius, useTheme } from "@/src/theme";
import { paperAttachSizeHint, paperTooBigToast, pickPaperDocument, pickPaperPhoto } from "@/src/core/paperFiles";
import { paperBadge } from "@/src/core/paperNormalize";
import { usePaperShield } from "@/src/core/paperShieldHook";
import type { Paper } from "@/src/core/types";
import { Button, T } from "./ui";
import { useToast } from "./Toast";

export function PaperAttach({
  paperId,
  uri,
  mime,
  onChange,
  testID,
}: {
  paperId: string;
  uri?: string;
  mime?: string;
  onChange: (next: { uri?: string; mime?: string; name?: string }) => void;
  testID: string;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const badge = uri ? (mime === "application/pdf" ? "PDF" : "Image") : null;
  usePaperShield(uri !== undefined);
  const attach = async (mode: "photo" | "document") => {
    const next = mode === "photo" ? await pickPaperPhoto() : await pickPaperDocument();
    if (next === "too-big") return toast(paperTooBigToast(), "file-alert-outline");
    if (next === "denied") return toast("File access is off for Nucleus.", "file-alert-outline");
    if (!next) return;
    onChange({ uri: next.uri, mime: next.mime, name: next.name });
  };
  return (
    <View style={{ marginBottom: 12 }}>
      {uri ? (
        mime === "application/pdf" ? (
          <View style={{ padding: 16, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, marginBottom: 8 }}>
            <T v="label">PDF attached</T>
            {badge ? <T muted style={{ fontSize: 12, marginTop: 4 }}>{badge}</T> : null}
          </View>
        ) : (
          <Image source={{ uri }} style={{ width: "100%", height: 140, borderRadius: radius.md, marginBottom: 8, backgroundColor: colors.surfaceTertiary }} contentFit="cover" />
        )
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button small kind="secondary" icon="image-outline" label={uri && mime !== "application/pdf" ? "Replace photo" : "Add photo"} testID={`${testID}-photo`} onPress={() => attach("photo")} />
        <Button small kind="secondary" icon="file-pdf-box" label={uri && mime === "application/pdf" ? "Replace document" : "Add document"} testID={`${testID}-document`} onPress={() => attach("document")} />
      </View>
      {uri ? <Button small kind="ghost" label="Remove file" testID={`${testID}-clear`} onPress={() => onChange({})} /> : null}
      <T muted style={{ fontSize: 12, marginTop: 4 }}>
        {paperAttachSizeHint()} Stored with your records on this phone. Easy fields may be read when you attach.
      </T>
    </View>
  );
}

export function paperBadgeForRow(paper: Paper): string | null {
  return paperBadge(paper);
}
