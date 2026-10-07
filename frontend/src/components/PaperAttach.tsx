import { Image } from "expo-image";
import { View } from "react-native";
import { radius, useTheme } from "@/src/theme";
import { pickPaperAttachment } from "@/src/core/paperFiles";
import { paperBadge } from "@/src/core/paperNormalize";
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
  onChange: (next: { uri?: string; mime?: string }) => void;
  testID: string;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const badge = uri ? (mime === "application/pdf" ? "PDF" : "Image") : null;
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
      <Button
        small
        kind="secondary"
        icon={uri ? "file-replace-outline" : "file-plus-outline"}
        label={uri ? "Replace file" : "Attach image or PDF"}
        testID={testID}
        onPress={async () => {
          const next = await pickPaperAttachment();
          if (next === "too-big") return toast("That file is too large for on-phone storage.", "file-alert-outline");
          if (next === "denied") return toast("File access is off for Nucleus.", "file-alert-outline");
          if (!next) return;
          onChange({ uri: next.uri, mime: next.mime });
        }}
      />
      {uri ? <Button small kind="ghost" label="Remove file" testID={`${testID}-clear`} onPress={() => onChange({})} /> : null}
      <T muted style={{ fontSize: 12, marginTop: 4 }}>Stored with your records on this phone. Easy fields may be read when you attach.</T>
    </View>
  );
}

export function paperBadgeForRow(paper: Paper): string | null {
  return paperBadge(paper);
}
