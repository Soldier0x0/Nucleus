import Svg, { Circle, Path } from "react-native-svg";
import type { VehicleBody } from "@/src/core/types";

/** Original side views. A model name picks one; it is not a photograph of that model. */
export function VehicleArt({ body, width = 156, color, accent }: { body: VehicleBody; width?: number; color: string; accent: string }) {
  const height = Math.round(width * 0.48);
  return (
    <Svg width={width} height={height} viewBox="0 0 160 76" accessibilityLabel={body}>
      <Body body={body} color={color} accent={accent} />
    </Svg>
  );
}

function Body({ body, color, accent }: { body: VehicleBody; color: string; accent: string }) {
  switch (body) {
    case "scooter":
      return <Scooter color={color} accent={accent} />;
    case "sport":
      return <Sport color={color} accent={accent} />;
    case "naked":
      return <Naked color={color} accent={accent} />;
    case "cruiser":
      return <Cruiser color={color} accent={accent} />;
    case "adventure":
      return <Adventure color={color} accent={accent} />;
    case "hatchback":
      return <Hatch color={color} accent={accent} />;
    case "sedan":
      return <Sedan color={color} accent={accent} />;
    case "suv":
      return <Suv color={color} accent={accent} />;
    case "pickup":
      return <Pickup color={color} accent={accent} />;
    case "van":
      return <Van color={color} accent={accent} />;
    case "other":
      return <Other color={color} accent={accent} />;
    default: {
      const unknown: never = body;
      return unknown;
    }
  }
}

function Wheels({ color, y = 58, rear = 34, front = 126, r = 10 }: { color: string; y?: number; rear?: number; front?: number; r?: number }) {
  return (
    <>
      <Circle cx={rear} cy={y} r={r} fill="none" stroke={color} strokeWidth={2.2} />
      <Circle cx={front} cy={y} r={r} fill="none" stroke={color} strokeWidth={2.2} />
      <Circle cx={rear} cy={y} r={2} fill={color} />
      <Circle cx={front} cy={y} r={2} fill={color} />
    </>
  );
}

function Scooter({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Wheels color={color} r={9} rear={32} front={128} />
      <Path d="M40 52 H98" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Path d="M62 52 C66 36 78 32 96 36 L108 48" fill={accent} fillOpacity={0.35} stroke={color} strokeWidth={2} />
      <Path d="M108 48 L124 28 H138 L128 48" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M24 48 L36 36" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

function Sport({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Wheels color={color} />
      <Path d="M28 46 L52 40 L92 28 L132 40 L140 50" fill={accent} fillOpacity={0.4} stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M70 34 L96 30 L108 40" fill="none" stroke={color} strokeWidth={1.6} />
      <Path d="M48 46 L36 54" stroke={color} strokeWidth={2} />
    </>
  );
}

function Naked({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Wheels color={color} />
      <Path d="M48 48 L70 30 H98 L112 46" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M72 40 H92 V50 H72 Z" fill={accent} fillOpacity={0.55} stroke={color} strokeWidth={1.6} />
      <Path d="M36 50 H52 M112 48 H128" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M98 30 L118 22" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

function Cruiser({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Wheels color={color} r={11} y={58} />
      <Path d="M46 50 C58 28 86 26 100 42 L118 50" fill={accent} fillOpacity={0.35} stroke={color} strokeWidth={2.2} />
      <Path d="M30 52 H50 M108 54 H128" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M100 42 L122 24" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

function Adventure({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Wheels color={color} r={12} y={56} />
      <Path d="M44 46 L70 26 H104 L124 44" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M104 26 L132 18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M74 36 H98 V48 H74 Z" fill={accent} fillOpacity={0.4} stroke={color} strokeWidth={1.5} />
      <Path d="M36 48 H50" stroke={color} strokeWidth={2} />
    </>
  );
}

function Hatch({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Wheels color={color} r={8} y={60} rear={42} front={118} />
      <Path d="M28 52 L36 36 H108 L124 48 V58 H28 Z" fill={accent} fillOpacity={0.28} stroke={color} strokeWidth={2.1} strokeLinejoin="round" />
      <Path d="M58 38 V52 M86 38 V52" stroke={color} strokeWidth={1.4} />
    </>
  );
}

function Sedan({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Wheels color={color} r={8} y={60} rear={40} front={122} />
      <Path d="M22 54 L34 40 H70 L86 28 H112 L128 40 H142 V58 H22 Z" fill={accent} fillOpacity={0.28} stroke={color} strokeWidth={2.1} strokeLinejoin="round" />
      <Path d="M70 40 V54 M100 32 V54" stroke={color} strokeWidth={1.4} />
    </>
  );
}

function Suv({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Wheels color={color} r={9} y={60} rear={42} front={118} />
      <Path d="M26 56 L32 28 H118 L132 44 V58 H26 Z" fill={accent} fillOpacity={0.3} stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M58 30 V54 M90 30 V54" stroke={color} strokeWidth={1.4} />
    </>
  );
}

function Pickup({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Wheels color={color} r={9} y={60} rear={46} front={124} />
      <Path d="M24 56 L30 34 H78 L92 46 H140 V58 H24 Z" fill={accent} fillOpacity={0.25} stroke={color} strokeWidth={2.1} strokeLinejoin="round" />
      <Path d="M92 46 V58" stroke={color} strokeWidth={1.6} />
    </>
  );
}

function Van({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Wheels color={color} r={8} y={60} rear={46} front={118} />
      <Path d="M24 58 V30 H112 L136 46 V58 Z" fill={accent} fillOpacity={0.28} stroke={color} strokeWidth={2.1} strokeLinejoin="round" />
      <Path d="M70 32 V56" stroke={color} strokeWidth={1.4} />
    </>
  );
}

function Other({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <Wheels color={color} r={8} />
      <Path d="M30 52 H130" stroke={color} strokeWidth={2} />
      <Circle cx={80} cy={36} r={12} fill={accent} fillOpacity={0.4} stroke={color} strokeWidth={2} />
    </>
  );
}
