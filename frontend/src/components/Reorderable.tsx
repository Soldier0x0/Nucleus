import React from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

function liftHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Hold, then drag. The row snaps back and the list reorders by how many row-heights you moved.
 * Arrow buttons stay available beside it for anyone who does not drag.
 */
export function DragRow({
  index,
  count,
  rowHeight,
  onMove,
  children,
}: {
  index: number;
  count: number;
  rowHeight: number;
  onMove: (from: number, to: number) => void;
  children: React.ReactNode;
}) {
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: scale.value }],
    zIndex: scale.value > 1 ? 2 : 0,
  }));
  const gesture = Gesture.Pan()
    .activateAfterLongPress(320)
    .onStart(() => {
      scale.value = withSpring(1.02);
      runOnJS(liftHaptic)();
    })
    .onUpdate((e) => {
      y.value = e.translationY;
    })
    .onEnd((e) => {
      const slots = Math.round(e.translationY / rowHeight);
      const next = Math.max(0, Math.min(count - 1, index + slots));
      y.value = withSpring(0);
      scale.value = withSpring(1);
      if (next !== index) runOnJS(onMove)(index, next);
    })
    .onFinalize(() => {
      y.value = withSpring(0);
      scale.value = withSpring(1);
    });
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
