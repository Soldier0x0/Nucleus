import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Platform, View } from "react-native";
import { radius, useTheme } from "@/src/theme";
import { Button, T } from "./ui";
import { useToast } from "./Toast";
import { withExternalActivity } from "@/src/core/externalActivity";

const MAX = 180_000;

/** A photo from the library, small enough to live inside the encrypted document. No camera, no text scanning. */
export async function pickSmallPhoto(): Promise<string | null | "too-big" | "denied"> {
  // Android's system photo picker needs no storage permission (both are blocked in app.json).
  const perm = Platform.OS === "android" ? { granted: true } : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return "denied";
  const res = await withExternalActivity(() =>
    ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.25, base64: true, allowsEditing: true }),
  );
  if (res.canceled || !res.assets[0]?.base64) return null;
  if (res.assets[0].base64.length > MAX) return "too-big";
  return `data:image/jpeg;base64,${res.assets[0].base64}`;
}

export function PhotoNote({ uri, onChange, testID }: { uri?: string; onChange: (next?: string) => void; testID: string }) {
  const { colors } = useTheme();
  const toast = useToast();
  return (
    <View style={{ marginBottom: 12 }}>
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: 140, borderRadius: radius.md, marginBottom: 8, backgroundColor: colors.surfaceTertiary }} contentFit="cover" /> : null}
      <Button
        small
        kind="secondary"
        icon={uri ? "image-edit-outline" : "image-outline"}
        label={uri ? "Replace photo" : "Attach a photo"}
        testID={testID}
        onPress={async () => {
          const next = await pickSmallPhoto();
          if (next === "too-big") return toast("That photo is too large. Crop a smaller one.", "image-off-outline");
          if (next === "denied") return toast("Photo access is off for Nucleus.", "image-off-outline");
          if (!next) return;
          onChange(next);
        }}
      />
      {uri ? <Button small kind="ghost" label="Remove photo" testID={`${testID}-clear`} onPress={() => onChange(undefined)} /> : null}
      <T muted style={{ fontSize: 12, marginTop: 4 }}>Stored with your records on this phone. Text on the photo is not read.</T>
    </View>
  );
}
