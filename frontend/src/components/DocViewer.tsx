import React from "react";
import { Modal, View } from "react-native";
import { useTheme } from "@/src/theme";
import { paperAttachmentUri } from "@/src/core/paperFiles";
import type { Paper } from "@/src/core/types";
import { DocumentContent } from "./DocumentContent";
import { Header } from "./Header";
import { IconButton } from "./ui";

/**
 * Viewer for one paper. Delete is requested through `onDelete`; the caller owns
 * the single confirm dialog so list, viewer and vehicle tile share one step.
 */
export function DocViewer({
  paper,
  visible,
  onClose,
  onEdit,
  onDelete,
}: {
  paper: Paper;
  visible: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { colors } = useTheme();
  const uri = paperAttachmentUri(paper);
  if (!uri) return null;
  const headerRight =
    onEdit || onDelete ? (
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {onEdit ? <IconButton icon="pencil-outline" label="Edit paper" testID="doc-viewer-edit" onPress={onEdit} /> : null}
        {onDelete ? <IconButton icon="delete-outline" label="Delete paper" testID="doc-viewer-delete" onPress={onDelete} /> : null}
      </View>
    ) : undefined;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title={paper.title} testID="doc-viewer-header" onBack={onClose} right={headerRight} />
        <DocumentContent paper={paper} />
      </View>
    </Modal>
  );
}
