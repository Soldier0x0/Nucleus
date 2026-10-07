import React from "react";
import { useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

export function ZoomableImage({ uri, testID }: { uri: string; testID?: string }) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(4, Math.max(1, e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
      }
    });
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        tx.value = e.translationX;
        ty.value = e.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value <= 1.05) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
      }
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
      <Animated.View style={[{ flex: 1, width, height, alignItems: "center", justifyContent: "center" }, style]}>
        <Image testID={testID} source={{ uri }} style={{ width, height: height * 0.75 }} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}
