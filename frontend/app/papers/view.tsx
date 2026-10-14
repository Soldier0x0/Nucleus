import React, { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { removePaper } from "@/src/core/actions";
import { Header } from "@/src/components/Header";
import { DocumentContent } from "@/src/components/DocumentContent";
import { PaperSheet } from "@/src/components/PaperSheet";
import { EmptyState, IconButton } from "@/src/components/ui";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { useToast } from "@/src/components/Toast";

export default function PaperViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, update } = useStore();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const paper = db.papers.find((row) => row.id === id);
  if (!paper) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title="Document" />
        <EmptyState icon="file-document-outline" title="Document not found" body="It may have been removed." />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header
        title={paper.title}
        testID="doc-viewer-header"
        right={
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <IconButton icon="pencil-outline" label="Edit paper" testID="paper-view-edit" onPress={() => setEdit(true)} />
            <IconButton icon="delete-outline" label="Delete paper" testID="paper-view-delete" onPress={() => setConfirmDel(true)} />
          </View>
        }
      />
      <DocumentContent paper={paper} />
      {edit ? <PaperSheet paper={paper} onClose={() => setEdit(false)} onDeleted={() => router.back()} /> : null}
      <ConfirmSheet
        visible={confirmDel}
        id="paper-view-delete"
        title="Delete this paper?"
        body="The file and expiry reminders for this document will be removed from Nucleus. This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => {
          update((d) => removePaper(d, paper.id));
          setConfirmDel(false);
          toast("Paper deleted", "delete-outline");
          router.back();
        }}
      />
    </View>
  );
}
