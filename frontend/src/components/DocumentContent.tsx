import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View, useWindowDimensions } from "react-native";
import Pdf from "react-native-pdf";
import { useTheme } from "@/src/theme";
import { paperMime } from "@/src/core/paperFiles";
import { viewerUriForAttachment } from "@/src/core/paperViewerUri";
import type { Paper } from "@/src/core/types";
import { EmptyState, T } from "./ui";
import { ZoomableImage } from "./ZoomableImage";

export function DocumentContent({ paper, testID }: { paper: Paper; testID?: string }) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const uri = paper.file ?? paper.photo;
  const mime = paperMime(paper);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!uri) {
      setLocalUri(null);
      return;
    }
    setFailed(false);
    viewerUriForAttachment(uri, mime ?? "image/jpeg", paper.id)
      .then((next) => {
        if (alive) setLocalUri(next);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [uri, mime, paper.id]);
  if (!uri) {
    return <EmptyState icon="file-document-outline" title="No file" body="Attach an image or PDF on the edit sheet." />;
  }
  if (!localUri) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (failed) {
    return <EmptyState icon="file-alert-outline" title="Could not open file" body="Try attaching the document again." />;
  }
  if (mime === "application/pdf") {
    return (
      <View style={{ flex: 1 }} testID={testID ?? "doc-viewer-pdf"}>
        <Pdf
          source={{ uri: localUri, cache: true }}
          style={{ flex: 1, width, height }}
          trustAllCerts={Platform.OS === "android"}
          onError={() => setFailed(true)}
          enablePaging
          enableDoubleTapZoom
          minScale={1}
          maxScale={4}
        />
      </View>
    );
  }
  return <ZoomableImage uri={localUri} testID={testID ?? "doc-viewer-image"} />;
}
