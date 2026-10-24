/** Small hand-rolled SVG charts. No chart or UI framework. */
export const PALETTE = ["#c98b2d", "#4a6fa5", "#3f7f5f", "#8a5fa8", "#4f8fa8", "#a85f7a", "#5a7fb0", "#6b8f3f", "#b06045", "#3f8f8f", "#565fa0", "#707a8a"];

export type Slice = { label: string; value: number; color?: string };

export function Donut({ slices, size = 190, thickness = 26, centerTop, centerBottom }: { slices: Slice[]; size?: number; thickness?: number; centerTop?: string; centerBottom?: string }) {
  const shown = slices.filter((s) => s.value > 0);
  const total = shown.reduce((sum, s) => sum + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label="Category share">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        {total > 0
          ? shown.map((s, i) => {
              const dash = (s.value / total) * c;
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color ?? PALETTE[i % PALETTE.length]}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offset += dash;
              return el;
            })
          : null}
      </svg>
      {centerTop ? (
        <div className="donut-center">
          <strong>{centerTop}</strong>
          {centerBottom ? <span className="muted small">{centerBottom}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function Bars({ data, height = 140, format }: { data: { label: string; value: number }[]; height?: number; format: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars" style={{ height }}>
      {data.map((d) => (
        <div className="bar-col" key={d.label} title={`${d.label}: ${format(d.value)}`}>
          <span className="bar-value small muted">{d.value > 0 ? format(d.value) : ""}</span>
          <div className="bar" style={{ height: `${Math.max(2, (d.value / max) * (height - 44))}px` }} />
          <span className="bar-label small muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Ring({ value, max, size = 150, thickness = 16, label, sub }: { value: number; max: number; size?: number; thickness?: number; label?: string; sub?: string }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const color = ratio >= 1 ? "var(--error)" : ratio >= 0.8 ? "#c98b2d" : "var(--ok)";
  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={label ?? "Progress"}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${ratio * c} ${c}`}
          strokeDashoffset={0}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
        />
      </svg>
      <div className="donut-center">
        <strong>{label}</strong>
        {sub ? <span className="muted small">{sub}</span> : null}
      </div>
    </div>
  );
}
