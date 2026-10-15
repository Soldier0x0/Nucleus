import React from "react";
import { View } from "react-native";

/** Web preview only: react-native-pdf is native. The phone build renders real pages. */
export default function PdfViewer(props: { style?: object; onError?: (e: unknown) => void }) {
  return <View style={props.style} />;
}
