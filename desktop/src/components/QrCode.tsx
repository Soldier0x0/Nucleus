import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** Pairing QR. Same pack, same library as the phone's QrCode, drawn as SVG. */
export function QrCode({ text, size = 200 }: { text: string; size?: number }) {
  const cells = useMemo(() => {
    try {
      const qr = qrcode(0, "L");
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      const dark: [number, number][] = [];
      for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) if (qr.isDark(row, col)) dark.push([row, col]);
      return { n, dark };
    } catch {
      return null;
    }
  }, [text]);
  if (!cells) return null;
  const cell = size / cells.n;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Pairing code">
      <rect x={0} y={0} width={size} height={size} fill="#F4F1EA" />
      {cells.dark.map(([row, col]) => (
        <rect key={`${row}-${col}`} x={col * cell} y={row * cell} width={cell} height={cell} fill="#0B0D12" />
      ))}
    </svg>
  );
}
