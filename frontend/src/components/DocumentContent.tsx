import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View, useWindowDimensions } from "react-native";
import Pdf from "./PdfViewer";
import { useTheme } from "@/src/theme";
import { paperMime } from "@/src/core/paperFiles";
import { attachmentNeedsViewerMaterialize, mistaggedJpegDataUri } from "@/src/core/paperNormalize";
import { PDF_VIEWER_FAIL_BODY, PREPARE_FILE_FAIL_BODY } from "@/src/core/documentViewerCopy";
import {
  MistaggedJpegError,
  localViewerUriMissing,
  pdfSourceUsesCache,
  toPdfSourcePath,
  viewerUriForAttachment,
} from "@/src/core/paperViewerUri";
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
  const [displayMime, setDisplayMime] = useState<string | undefined>(mime);
  const [failed, setFailed] = useState(false);
  const [failBody, setFailBody] = useState(DEFAULT_FAIL_BODY);
  const [pdfVaultFallback, setPdfVaultFallback] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!uri) {
      setLocalUri(null);
      setDisplayMime(mime);
      setFailed(false);
      setFailBody(DEFAULT_FAIL_BODY);
      setPdfVaultFallback(false);
      return;
    }
    setFailed(false);
    setFailBody(DEFAULT_FAIL_BODY);
    setPdfVaultFallback(false);
    setDisplayMime(mime);

    if (mistaggedJpegDataUri(uri, mime ?? "application/pdf")) {
      setLocalUri(uri);
      setDisplayMime("image/jpeg");
      return () => {
        alive = false;
      };
    }

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
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof MistaggedJpegError || mistaggedJpegDataUri(uri, mime ?? "application/pdf")) {
          setDisplayMime("image/jpeg");
          setLocalUri(uri);
          return;
        }
        console.warn("paper materialize failed", String(err));
        setFailed(true);
        setFailBody(PREPARE_FILE_FAIL_BODY);
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
  if (displayMime === "application/pdf") {
    const vaultDataUri = uri.startsWith("data:application/pdf") ? uri : null;
    const pathUri = toPdfSourcePath(localUri);
    const sourceUri = pdfVaultFallback && vaultDataUri ? vaultDataUri : pathUri;
    const cache = pdfSourceUsesCache(sourceUri);
    return (
      <View style={{ flex: 1 }} testID={testID ?? "doc-viewer-pdf"}>
        <Pdf
          key={pdfVaultFallback ? "vault-data" : "cache-path"}
          source={{ uri: sourceUri, cache }}
          style={{ flex: 1, width, height }}
          trustAllCerts={Platform.OS === "android"}
          enableAnnotationRendering={false}
          onError={(error) => {
            console.warn("pdf viewer failed", (error as { message?: string } | undefined)?.message ?? String(error));
            if (!pdfVaultFallback && vaultDataUri) {
              setPdfVaultFallback(true);
              return;
            }
            setFailBody(PDF_VIEWER_FAIL_BODY);
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
