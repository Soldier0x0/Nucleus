import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { galleryShots } from "@/src/core/gallery";
import { Header } from "@/src/components/Header";
import { PhotoGallery } from "@/src/components/PhotoGallery";

export default function GalleryScreen() {
  const { db } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const shots = [...galleryShots(db.utilities), ...galleryShots(db.txns.filter((row) => row.photo))];
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Gallery" />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24 }}>
        <PhotoGallery shots={shots} testID="bill-gallery" />
      </ScrollView>
    </View>
  );
}
