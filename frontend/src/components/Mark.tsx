import Svg, { Circle, Path } from "react-native-svg";

/**
 * The Nucleus mark, drawn rather than loaded from a bitmap, so the lock screen
 * always shows the ring and core — the same mark as the launcher icon.
 */
export function Mark({ size = 72 }: { size?: number; radius?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Nucleus">
      <Circle cx="50" cy="50" r="50" fill="#0B0D12" />
      <Circle cx="50" cy="50" r="32" stroke="#D68E42" strokeWidth="6" fill="none" />
      <Path d="M50 6 v14" stroke="#0B0D12" strokeWidth="10" strokeLinecap="butt" />
      <Path d="M50 8 v12" stroke="#D68E42" strokeWidth="3.5" strokeLinecap="round" />
      <Circle cx="50" cy="50" r="11" fill="#D68E42" />
    </Svg>
  );
}
