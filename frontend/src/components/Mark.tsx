import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { IconFamily, IconVariant } from "@/src/core/types";
import { markPalette } from "@/src/core/launcher";
import { MARK_OUTER_RADIUS } from "@/src/core/iconFill";

/**
 * Lock-screen mark. Same family and ground as the launcher picture the person picked.
 */
export function Mark({ size = 72, family = "paper", variant = "paper" }: { size?: number; family?: IconFamily; variant?: IconVariant }) {
  const p = markPalette(family, variant);
  const ring = family === "glass" ? 4.5 : family === "metal" ? 9 : 8;
  const core = family === "glass" ? 22 : family === "tiles" ? 14 : 16;
  const ringRadius = MARK_OUTER_RADIUS - ring / 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Nucleus">
      <Circle cx="50" cy="50" r="50" fill={p.ground} />
      {family === "tiles" ? (
        <>
          <Rect x="2" y="2" width="46" height="46" rx="8" fill="#C9843A" />
          <Rect x="52" y="2" width="46" height="46" rx="8" fill="#E2C39A" />
          <Rect x="2" y="52" width="46" height="46" rx="8" fill="#C4B08A" />
          <Rect x="52" y="52" width="46" height="46" rx="8" fill={variant === "amoled" || variant === "midnight" ? "#3A342C" : "#D7B48A"} />
          <Circle cx="50" cy="50" r={core} fill={p.core} />
        </>
      ) : (
        <>
          <Circle cx="50" cy="50" r={ringRadius} stroke={p.ring} strokeWidth={ring} fill="none" />
          <Path d="M50 6 v14" stroke={p.ground} strokeWidth="10" strokeLinecap="butt" />
          <Path d="M50 8 v12" stroke={p.tick} strokeWidth="3.5" strokeLinecap="round" />
          <Circle cx="50" cy="50" r={core} fill={p.core} />
        </>
      )}
    </Svg>
  );
}
