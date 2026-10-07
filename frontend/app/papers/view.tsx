import React from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { Header } from "@/src/components/Header";
import { DocumentContent } from "@/src/components/DocumentContent";
import { EmptyState } from "@/src/components/ui";

export default function PaperViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db } = useStore();
  const { colors } = useTheme();
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
      <Header title={paper.title} testID="doc-viewer-header" />
      <DocumentContent paper={paper} />
    </View>
  );
}
