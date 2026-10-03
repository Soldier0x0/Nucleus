import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { pushCaptureText } from "@/src/core/captureBus";
import { pushReceiptText } from "@/src/core/receiptBus";
import { looksLikeReceipt } from "@/src/core/receipt";

/** Landing route for a shared line of text. The capture bar on Home does the parsing. */
export default function CaptureRoute() {
  const { text } = useLocalSearchParams<{ text?: string }>();
  const router = useRouter();
  useEffect(() => {
    const line = Array.isArray(text) ? text[0] : text;
    if (line && looksLikeReceipt(line)) {
      pushReceiptText(line);
      router.replace("/money");
      return;
    }
    if (line) pushCaptureText(line);
    router.replace("/(tabs)");
  }, [text, router]);
  return null;
}
