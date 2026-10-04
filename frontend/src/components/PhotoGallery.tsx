import { useRef, useState } from "react";
import { Image, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { stepGallery, type GalleryShot } from "@/src/core/gallery";

export function PhotoGallery({ shots, testID }: { shots: GalleryShot[]; testID: string }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const last = useRef(0);
  const page = Math.max(280, width);

  const onEnd = (offset: number, current: number, apply: (next: number) => void) => {
    const direction = offset >= last.current ? "next" : "prev";
    last.current = offset;
    const stepped = stepGallery(current, shots.length, direction);
    apply(stepped.index);
  };

  return (
    <View testID={testID}>
      <ScrollView
        horizontal
        pagingEnabled
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => onEnd(event.nativeEvent.contentOffset.x, index, setIndex)}
      >
        {shots.map((shot, shotIndex) => (
          <Pressable key={shot.id} onPress={() => setOpen(shotIndex)}>
            <Image source={{ uri: shot.uri }} style={{ width: page, height: 180 }} />
          </Pressable>
        ))}
      </ScrollView>
      {open !== null ? (
        <ScrollView
          horizontal
          pagingEnabled
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => onEnd(event.nativeEvent.contentOffset.x, open, setOpen)}
        >
          {shots.map((shot) => (
            <Image key={`open-${shot.id}`} source={{ uri: shot.uri }} style={{ width: page, height: 320 }} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
