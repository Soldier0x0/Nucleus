import React, { useContext, useLayoutEffect, useMemo } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import { dropIndex, moveItem, shiftFor } from "@/src/core/reorder";

export { moveItem };

function liftHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function gapHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

type ReorderGroupState = {
  active: SharedValue<number>;
  hover: SharedValue<number>;
  stride: SharedValue<number>;
};

const ReorderContext = React.createContext<ReorderGroupState | null>(null);

/** Rows in one list share the landing gap. Each list needs its own group. */
export function ReorderGroup({ children, rowHeight, orderKey }: { children: React.ReactNode; rowHeight: number; orderKey: string }) {
  const active = useSharedValue(-1);
  const hover = useSharedValue(-1);
  const stride = useSharedValue(rowHeight);
  const value = useMemo(() => ({ active, hover, stride }), [active, hover, stride]);
  useLayoutEffect(() => {
    active.value = -1;
    hover.value = -1;
  }, [orderKey, active, hover]);
  return <ReorderContext.Provider value={value}>{children}</ReorderContext.Provider>;
}

/**
 * Hold, then drag. Other rows move apart so the gap under the pointer is where the row will land.
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
  const group = useContext(ReorderContext);
  const ownActive = useSharedValue(-1);
  const ownHover = useSharedValue(-1);
  const ownStride = useSharedValue(rowHeight);
  const active = group?.active ?? ownActive;
  const hover = group?.hover ?? ownHover;
  const stride = group?.stride ?? ownStride;
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  useLayoutEffect(() => {
    y.value = 0;
    scale.value = 1;
  }, [index, scale, y]);
  const style = useAnimatedStyle(() => {
    const dragging = active.value === index;
    const shift = dragging ? y.value : shiftFor(index, active.value, hover.value) * stride.value;
    return {
      transform: [{ translateY: shift }, { scale: dragging ? scale.value : 1 }],
      zIndex: dragging ? 2 : 0,
      elevation: dragging ? 8 : 0,
    };
  });
  const gesture = Gesture.Pan()
    .activateAfterLongPress(320)
    .onStart(() => {
      active.value = index;
      hover.value = index;
      scale.value = withSpring(1.02);
      runOnJS(liftHaptic)();
    })
    .onUpdate((e) => {
      y.value = e.translationY;
      const next = dropIndex(index, e.translationY, stride.value || rowHeight, count);
      if (next !== hover.value) {
        hover.value = next;
        runOnJS(gapHaptic)();
      }
    })
    .onEnd((e) => {
      const pitch = stride.value || rowHeight;
      const next = dropIndex(index, e.translationY, pitch, count);
      scale.value = withSpring(1);
      if (next === index) {
        y.value = withSpring(0);
        active.value = -1;
        hover.value = -1;
        return;
      }
      hover.value = next;
      y.value = (next - index) * pitch;
      runOnJS(onMove)(index, next);
    })
    .onFinalize((_e, success) => {
      if (success) return;
      y.value = withSpring(0);
      scale.value = withSpring(1);
      active.value = -1;
      hover.value = -1;
    });
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={style}
        onLayout={(e) => {
          const height = e.nativeEvent.layout.height;
          if (height > 0 && active.value < 0) stride.value = height;
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
