import React from "react";
import { Modal, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";
import { useTheme } from "@/src/theme";
import { paperAttachmentUri, paperIsPdf } from "@/src/core/paperFiles";
import type { Paper } from "@/src/core/types";
import { Header } from "./Header";
import { T } from "./ui";

export function DocViewer({ paper, visible, onClose }: { paper: Paper; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const uri = paperAttachmentUri(paper);
  if (!uri) return null;
  const pdf = paperIsPdf(paper);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title={paper.title} testID="doc-viewer-header" />
        {pdf ? (
          <WebView
            testID="doc-viewer-pdf"
            originWhitelist={["*"]}
            source={{ uri }}
            style={{ flex: 1, width, height }}
          />
        ) : (
          <Image testID="doc-viewer-image" source={{ uri }} style={{ flex: 1, width, backgroundColor: colors.surfaceTertiary }} contentFit="contain" />
        )}
        {!pdf ? <T muted style={{ textAlign: "center", padding: 8 }}>Pinch to zoom with your fingers.</T> : null}
      </View>
    </Modal>
  );
}
