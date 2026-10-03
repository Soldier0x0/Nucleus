import Svg, { Circle, Path } from "react-native-svg";
import type { VehicleBody } from "@/src/core/types";
import { markFor } from "@/src/core/vehicleMarks";

/** Original side views. A model name picks one; it is not a photograph of that model. */
export function VehicleArt({ body, width = 156, color, accent }: { body: VehicleBody; width?: number; color: string; accent: string }) {
  const height = Math.round(width * 0.48);
  const mark = markFor(body);
  return (
    <Svg width={width} height={height} viewBox="0 0 160 76" accessibilityLabel={body}>
      <Circle cx={mark.wheel.rear} cy={mark.wheel.y} r={mark.wheel.r} fill="none" stroke={color} strokeWidth={2.2} />
      <Circle cx={mark.wheel.front} cy={mark.wheel.y} r={mark.wheel.r} fill="none" stroke={color} strokeWidth={2.2} />
      <Circle cx={mark.wheel.rear} cy={mark.wheel.y} r={2} fill={color} />
      <Circle cx={mark.wheel.front} cy={mark.wheel.y} r={2} fill={color} />
      {mark.fills.map((d) => (
        <Path key={`fill-${d}`} d={d} fill={accent} fillOpacity={0.4} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      ))}
      {mark.cabin ? <Path d={mark.cabin} fill={accent} fillOpacity={0.28} stroke={color} strokeWidth={2.1} strokeLinejoin="round" /> : null}
      {mark.bars ? <Path d={mark.bars} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" /> : null}
      {mark.strokes.map((d) => (
        <Path key={`stroke-${d}`} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      ))}
    </Svg>
  );
}
