/**
 * Tiny safe expression evaluator for the custom tool builder.
 * Recursive-descent parser — no `eval`, no `Function`, no property access.
 * Supports: numbers, variables, + - * / % ^, unary minus, parentheses and a
 * fixed list of maths functions.
 */
const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  sqrt: Math.sqrt,
  pow: Math.pow,
  log: Math.log,
  exp: Math.exp,
};

export const FUNCTION_NAMES = Object.keys(FUNCS);

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = Number(src.slice(i, j));
      if (!isFinite(n)) throw new Error(`Not a number: ${src.slice(i, j)}`);
      out.push({ t: "num", v: n });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/%^(),".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`Character not allowed: ${c}`);
  }
  return out;
}

/** Evaluate `src` with the given variables. Throws a readable error on bad input. */
export function evaluateFormula(src: string, vars: Record<string, number>): number {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = (v: string) => {
    const t = toks[p];
    if (!t || t.t !== "op" || t.v !== v) throw new Error(`Expected "${v}"`);
    p++;
  };

  const primary = (): number => {
    const t = peek();
    if (!t) throw new Error("Formula ends too early");
    if (t.t === "num") {
      p++;
      return t.v;
    }
    if (t.t === "id") {
      p++;
      const fn = FUNCS[t.v];
      if (fn) {
        eat("(");
        const args: number[] = [factorChain()];
        while (peek() && peek().t === "op" && (peek() as any).v === ",") {
          p++;
          args.push(factorChain());
        }
        eat(")");
        return fn(...args);
      }
      if (!(t.v in vars)) throw new Error(`Unknown name "${t.v}"`);
      return vars[t.v];
    }
    if (t.v === "(") {
      p++;
      const v = factorChain();
      eat(")");
      return v;
    }
    if (t.v === "-") {
      p++;
      return -primary();
    }
    if (t.v === "+") {
      p++;
      return primary();
    }
    throw new Error(`Unexpected "${t.v}"`);
  };

  const power = (): number => {
    const base = primary();
    const t = peek();
    if (t && t.t === "op" && t.v === "^") {
      p++;
      return base ** power();
    }
    return base;
  };

  const term = (): number => {
    let v = power();
    for (;;) {
      const t = peek();
      if (!t || t.t !== "op" || !["*", "/", "%"].includes(t.v)) return v;
      p++;
      const r = power();
      v = t.v === "*" ? v * r : t.v === "/" ? v / r : v % r;
    }
  };

  function factorChain(): number {
    let v = term();
    for (;;) {
      const t = peek();
      if (!t || t.t !== "op" || !["+", "-"].includes(t.v)) return v;
      p++;
      const r = term();
      v = t.v === "+" ? v + r : v - r;
    }
  }

  const result = factorChain();
  if (p < toks.length) throw new Error("Could not read the whole formula");
  if (!isFinite(result)) throw new Error("Result is not a finite number");
  return result;
}

/** Variable-ish words used in a formula (for validation against the inputs). */
export function formulaNames(src: string): string[] {
  try {
    return Array.from(new Set(lex(src).filter((t) => t.t === "id" && !FUNCS[t.v]).map((t) => (t as any).v)));
  } catch {
    return [];
  }
}
