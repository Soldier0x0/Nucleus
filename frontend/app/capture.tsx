import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { pushCaptureText } from "@/src/core/captureBus";

/** Landing route for a shared line of text. The capture bar on Home does the parsing. */
export default function CaptureRoute() {
  const { text } = useLocalSearchParams<{ text?: string }>();
  const router = useRouter();
  useEffect(() => {
    const line = Array.isArray(text) ? text[0] : text;
    if (line) pushCaptureText(line);
    router.replace("/(tabs)");
  }, [text, router]);
  return null;
}
