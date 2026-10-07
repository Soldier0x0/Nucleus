import React, { useState } from "react";
import { Modal, View } from "react-native";
import { useTheme } from "@/src/theme";
import { paperAttachmentUri } from "@/src/core/paperFiles";
import type { Paper } from "@/src/core/types";
import { DocumentContent } from "./DocumentContent";
import { Header } from "./Header";
import { Button, IconButton, T } from "./ui";
import { Sheet } from "./Sheet";

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
  const [confirmDel, setConfirmDel] = useState(false);
  const uri = paperAttachmentUri(paper);
  if (!uri) return null;
  const headerRight =
    onEdit || onDelete ? (
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {onEdit ? <IconButton icon="pencil-outline" label="Edit paper" testID="doc-viewer-edit" onPress={onEdit} /> : null}
        {onDelete ? <IconButton icon="delete-outline" label="Delete paper" testID="doc-viewer-delete" onPress={() => setConfirmDel(true)} /> : null}
      </View>
    ) : undefined;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title={paper.title} testID="doc-viewer-header" onBack={onClose} right={headerRight} />
        <DocumentContent paper={paper} />
      </View>
      <Sheet visible={confirmDel} onClose={() => setConfirmDel(false)} title="Delete this paper?" testID="doc-viewer-delete-sheet">
        <T style={{ marginBottom: 16 }}>The file and expiry reminders for this document will be removed from Nucleus.</T>
        <Button
          kind="danger"
          label="Delete paper"
          icon="delete-outline"
          testID="doc-viewer-delete-confirm"
          onPress={() => {
            onDelete?.();
            setConfirmDel(false);
            onClose();
          }}
        />
      </Sheet>
    </Modal>
  );
}
