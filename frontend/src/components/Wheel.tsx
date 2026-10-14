import React, { useEffect, useRef } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Text, View } from "react-native";
import { fonts, radius, useTheme } from "@/src/theme";

const ITEM = 40;
const VISIBLE = 5;

/** One snapping wheel column. Scroll or tap an item to pick it. */
export function Wheel({ items, index, onChange, testID, width }: { items: string[]; index: number; onChange: (i: number) => void; testID: string; width: number }) {
  const { colors } = useTheme();
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM, animated: false });
  }, [index, items.length]);
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    if (i !== index) onChange(i);
  };
  return (
    <View style={{ width, height: ITEM * VISIBLE }} testID={testID}>
      <View pointerEvents="none" style={{ position: "absolute", top: ITEM * 2, left: 0, right: 0, height: ITEM, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(e) => e.nativeEvent.velocity?.y === 0 && settle(e)}
        contentContainerStyle={{ paddingVertical: ITEM * 2 }}
      >
        {items.map((label, i) => (
          <Pressable key={label + i} testID={`${testID}-${i}`} onPress={() => onChange(i)} style={{ height: ITEM, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.monoMedium, fontSize: i === index ? 18 : 15, color: i === index ? colors.onSurface : colors.muted }}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
