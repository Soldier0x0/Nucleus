import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { IconFamily, IconVariant } from "@/src/core/types";
import { markPalette } from "@/src/core/launcher";

/**
 * Lock-screen mark. Same family and ground as the launcher picture the person picked.
 */
export function Mark({ size = 72, family = "paper", variant = "paper" }: { size?: number; family?: IconFamily; variant?: IconVariant }) {
  const p = markPalette(family, variant);
  const ring = family === "glass" ? 3.2 : family === "metal" ? 7 : 6;
  const core = family === "glass" ? 18 : family === "tiles" ? 8 : 11;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Nucleus">
      <Circle cx="50" cy="50" r="50" fill={p.ground} />
      {family === "tiles" ? (
        <>
          <Rect x="8" y="8" width="36" height="36" rx="8" fill="#C9843A" />
          <Rect x="56" y="8" width="36" height="36" rx="8" fill="#E2C39A" />
          <Rect x="8" y="56" width="36" height="36" rx="8" fill="#C4B08A" />
          <Rect x="56" y="56" width="36" height="36" rx="8" fill={variant === "amoled" || variant === "midnight" ? "#3A342C" : "#D7B48A"} />
          <Circle cx="50" cy="50" r={core} fill={p.core} />
        </>
      ) : (
        <>
          <Circle cx="50" cy="50" r="32" stroke={p.ring} strokeWidth={ring} fill="none" />
          <Path d="M50 6 v14" stroke={p.ground} strokeWidth="10" strokeLinecap="butt" />
          <Path d="M50 8 v12" stroke={p.tick} strokeWidth="3.5" strokeLinecap="round" />
          <Circle cx="50" cy="50" r={core} fill={p.core} />
        </>
      )}
    </Svg>
  );
}
