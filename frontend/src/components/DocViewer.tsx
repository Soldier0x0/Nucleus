import React from "react";
import { Modal, View } from "react-native";
import { useTheme } from "@/src/theme";
import { paperAttachmentUri } from "@/src/core/paperFiles";
import type { Paper } from "@/src/core/types";
import { DocumentContent } from "./DocumentContent";
import { Header } from "./Header";

export function DocViewer({ paper, visible, onClose }: { paper: Paper; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const uri = paperAttachmentUri(paper);
  if (!uri) return null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title={paper.title} testID="doc-viewer-header" />
        <DocumentContent paper={paper} />
      </View>
    </Modal>
  );
}
