export type ChanceMode = "dice" | "coin" | "number";

export type ChanceOpts = {
  sides: number;
  count: number;
  lo: number;
  hi: number;
};

function face(mode: ChanceMode, opts: ChanceOpts, random: () => number): string {
  const sample = random();
  switch (mode) {
    case "dice": {
      const sides = Math.max(1, Math.floor(opts.sides));
      const index = Math.min(sides - 1, Math.floor(Math.max(0, sample) * sides));
      return String(index + 1);
    }
    case "coin":
      return sample < 0.5 ? "Tails" : "Heads";
    case "number": {
      const low = Math.min(opts.lo, opts.hi);
      const span = Math.abs(opts.hi - opts.lo);
      const index = Math.min(span, Math.floor(Math.max(0, sample) * (span + 1)));
      return String(low + index);
    }
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

/** Short frames, then the face that stays. Each call to `random` advances one face. */
export function chanceFrames(mode: ChanceMode, opts: ChanceOpts, random: () => number, ticks: number): { frames: string[][]; final: string[] } {
  const count = Math.max(1, Math.floor(opts.count));
  const draw = () => Array.from({ length: count }, () => face(mode, opts, random));
  const frames = Array.from({ length: Math.max(0, ticks) }, () => draw());
  return { frames, final: draw() };
}
