import React from "react";
import { View } from "react-native";
import { Sheet } from "./Sheet";
import { Button, T } from "./ui";

/**
 * One confirm sheet for every destructive step. Mount it as a sibling of the
 * sheet that opens it (inside a fragment), never inside another Sheet.
 * testIDs: `${id}-sheet`, `${id}-confirm`, `${id}-cancel`.
 */
export function ConfirmSheet({
  visible,
  id,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  icon = "delete-outline",
  danger = true,
  cancelLabel = "Cancel",
}: {
  visible: boolean;
  id: string;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: string;
  danger?: boolean;
  cancelLabel?: string;
}) {
  return (
    <Sheet visible={visible} onClose={onCancel} title={title} testID={`${id}-sheet`}>
      {typeof body === "string" ? <T style={{ marginBottom: 16 }}>{body}</T> : body}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button kind="ghost" label={cancelLabel} testID={`${id}-cancel`} onPress={onCancel} style={{ flex: 1 }} />
        <Button kind={danger ? "danger" : "primary"} label={confirmLabel} icon={icon} testID={`${id}-confirm`} onPress={onConfirm} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
