import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View, useWindowDimensions } from "react-native";
import Pdf from "react-native-pdf";
import { useTheme } from "@/src/theme";
import { paperMime } from "@/src/core/paperFiles";
import { attachmentNeedsViewerMaterialize } from "@/src/core/paperNormalize";
import { localViewerUriMissing, viewerUriForAttachment } from "@/src/core/paperViewerUri";
import type { Paper } from "@/src/core/types";
import { EmptyState } from "./ui";
import { ZoomableImage } from "./ZoomableImage";

const MISSING_FILE_BODY = "This file is missing from the phone. Attach it again.";
const DEFAULT_FAIL_BODY = "Try attaching the document again.";

export function DocumentContent({ paper, testID }: { paper: Paper; testID?: string }) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const uri = paper.file ?? paper.photo;
  const mime = paperMime(paper);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [failBody, setFailBody] = useState(DEFAULT_FAIL_BODY);
  useEffect(() => {
    let alive = true;
    if (!uri) {
      setLocalUri(null);
      setFailed(false);
      setFailBody(DEFAULT_FAIL_BODY);
      return;
    }
    setFailed(false);
    setFailBody(DEFAULT_FAIL_BODY);
    const needsMaterialize = attachmentNeedsViewerMaterialize(uri, mime ?? "image/jpeg");
    if (!needsMaterialize) {
      if (localViewerUriMissing(uri)) {
        setFailed(true);
        setFailBody(MISSING_FILE_BODY);
        setLocalUri(null);
      } else {
        setLocalUri(uri);
      }
      return () => {
        alive = false;
      };
    }
    setLocalUri(null);
    viewerUriForAttachment(uri, mime ?? "image/jpeg", paper.id)
      .then((next) => {
        if (alive) setLocalUri(next);
      })
      .catch(() => {
        if (alive) {
          setFailed(true);
          setFailBody(DEFAULT_FAIL_BODY);
        }
      });
    return () => {
      alive = false;
    };
  }, [uri, mime, paper.id]);
  if (!uri) {
    return <EmptyState icon="file-document-outline" title="No file" body="Attach an image or PDF on the edit sheet." />;
  }
  if (failed) {
    return <EmptyState icon="file-alert-outline" title="Could not open file" body={failBody} />;
  }
  if (!localUri) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (mime === "application/pdf") {
    const pdfCache = !(localUri.startsWith("file:") || localUri.startsWith("data:"));
    return (
      <View style={{ flex: 1 }} testID={testID ?? "doc-viewer-pdf"}>
        <Pdf
          source={{ uri: localUri, cache: pdfCache }}
          style={{ flex: 1, width, height }}
          trustAllCerts={Platform.OS === "android"}
          onError={() => {
            setFailBody(DEFAULT_FAIL_BODY);
            setFailed(true);
          }}
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
