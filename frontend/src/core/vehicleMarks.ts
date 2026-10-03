import type { VehicleBody } from "./types";

export type VehicleMark = {
  id: string;
  role: "bike" | "car" | "other";
  wheel: { rear: number; front: number; y: number; r: number };
  /** Closed body. Cars have one. Bikes do not. */
  cabin: string | null;
  /** Handlebar. Bikes have one. Cars do not. */
  bars: string | null;
  strokes: string[];
  fills: string[];
};

const SCOOTER: VehicleMark = {
  id: "bike-scooter",
  role: "bike",
  wheel: { rear: 36, front: 124, y: 58, r: 12 },
  cabin: null,
  bars: "M112 26 H136",
  strokes: ["M48 50 L36 58", "M108 40 L112 26", "M44 50 H96"],
  fills: ["M62 52 C66 36 78 32 96 36 L108 48 Z"],
};

const SPORT: VehicleMark = {
  id: "bike-sport",
  role: "bike",
  wheel: { rear: 32, front: 128, y: 58, r: 12 },
  cabin: null,
  bars: "M104 30 L124 22",
  strokes: ["M28 48 L52 42", "M70 36 L98 32"],
  fills: ["M40 50 L68 40 L112 32 L132 46 L140 52 Z"],
};

const NAKED: VehicleMark = {
  id: "bike-naked",
  role: "bike",
  wheel: { rear: 34, front: 126, y: 58, r: 13 },
  cabin: null,
  bars: "M98 28 L122 16",
  strokes: ["M46 52 L68 30 H96", "M36 52 H54", "M110 48 H128"],
  fills: ["M72 38 H94 V50 H72 Z"],
};

const CRUISER: VehicleMark = {
  id: "bike-cruiser",
  role: "bike",
  wheel: { rear: 30, front: 132, y: 58, r: 14 },
  cabin: null,
  bars: "M104 40 L128 18",
  strokes: ["M26 54 H48", "M112 54 H136"],
  fills: ["M50 52 C62 30 88 28 104 44 L118 52 Z"],
};

const ADVENTURE: VehicleMark = {
  id: "bike-adventure",
  role: "bike",
  wheel: { rear: 32, front: 128, y: 56, r: 14 },
  cabin: null,
  bars: "M102 22 L134 12",
  strokes: ["M42 48 L68 24 H104 L122 44", "M34 50 H50"],
  fills: ["M74 34 H100 V48 H74 Z"],
};

const HATCH: VehicleMark = {
  id: "car-hatchback",
  role: "car",
  wheel: { rear: 42, front: 118, y: 60, r: 8 },
  cabin: "M28 52 L36 36 H108 L124 48 V58 H28 Z",
  bars: null,
  strokes: ["M58 38 V52", "M86 38 V52"],
  fills: [],
};

const SEDAN: VehicleMark = {
  id: "car-sedan",
  role: "car",
  wheel: { rear: 40, front: 122, y: 60, r: 8 },
  cabin: "M22 54 L34 40 H70 L86 28 H112 L128 40 H142 V58 H22 Z",
  bars: null,
  strokes: ["M70 40 V54", "M100 32 V54"],
  fills: [],
};

const SUV: VehicleMark = {
  id: "car-suv",
  role: "car",
  wheel: { rear: 42, front: 118, y: 60, r: 9 },
  cabin: "M26 56 L32 28 H118 L132 44 V58 H26 Z",
  bars: null,
  strokes: ["M58 30 V54", "M90 30 V54"],
  fills: [],
};

const PICKUP: VehicleMark = {
  id: "car-pickup",
  role: "car",
  wheel: { rear: 46, front: 124, y: 60, r: 9 },
  cabin: "M24 56 L30 34 H78 L92 46 H140 V58 H24 Z",
  bars: null,
  strokes: ["M92 46 V58"],
  fills: [],
};

const VAN: VehicleMark = {
  id: "car-van",
  role: "car",
  wheel: { rear: 46, front: 118, y: 60, r: 8 },
  cabin: "M24 58 V30 H112 L136 46 V58 Z",
  bars: null,
  strokes: ["M70 32 V56"],
  fills: [],
};

const OTHER: VehicleMark = {
  id: "other",
  role: "other",
  wheel: { rear: 34, front: 126, y: 58, r: 8 },
  cabin: null,
  bars: null,
  strokes: ["M30 52 H130"],
  fills: [],
};

/** Side-view mark for a body. A bike never reuses a car mark. */
export function markFor(body: VehicleBody): VehicleMark {
  switch (body) {
    case "scooter":
      return SCOOTER;
    case "sport":
      return SPORT;
    case "naked":
      return NAKED;
    case "cruiser":
      return CRUISER;
    case "adventure":
      return ADVENTURE;
    case "hatchback":
      return HATCH;
    case "sedan":
      return SEDAN;
    case "suv":
      return SUV;
    case "pickup":
      return PICKUP;
    case "van":
      return VAN;
    case "other":
      return OTHER;
    default: {
      const unknown: never = body;
      return unknown;
    }
  }
}
