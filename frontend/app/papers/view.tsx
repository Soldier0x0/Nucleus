import React from "react";
import { View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { paperAttachmentUri, paperIsPdf } from "@/src/core/paperFiles";
import { Header } from "@/src/components/Header";
import { EmptyState, T } from "@/src/components/ui";

export default function PaperViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db } = useStore();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const paper = db.papers.find((row) => row.id === id);
  if (!paper) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title="Document" />
        <EmptyState icon="file-document-outline" title="Document not found" body="It may have been removed." />
      </View>
    );
  }
  const uri = paperAttachmentUri(paper);
  const pdf = paperIsPdf(paper);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={paper.title} testID="doc-viewer-header" />
      {!uri ? (
        <EmptyState icon="file-document-outline" title="No file" body="Attach an image or PDF on the edit sheet." />
      ) : pdf ? (
        <WebView testID="doc-viewer-pdf" originWhitelist={["*"]} source={{ uri }} style={{ flex: 1, width, height }} />
      ) : (
        <>
          <Image testID="doc-viewer-image" source={{ uri }} style={{ flex: 1, width, backgroundColor: colors.surfaceTertiary }} contentFit="contain" />
          <T muted style={{ textAlign: "center", padding: 8 }}>Pinch to zoom with your fingers.</T>
        </>
      )}
    </View>
  );
}
