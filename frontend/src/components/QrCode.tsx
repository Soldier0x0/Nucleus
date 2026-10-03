import { useMemo } from "react";
import Svg, { Rect } from "react-native-svg";
import qrcode from "qrcode-generator";

/** A code for a short pack. Longer packs go out as a file. */
export function QrCode({ text, size = 220 }: { text: string; size?: number }) {
  const cells = useMemo(() => {
    try {
      const qr = qrcode(0, "L");
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      const dark: { row: number; col: number }[] = [];
      for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) if (qr.isDark(row, col)) dark.push({ row, col });
      return { n, dark };
    } catch {
      return null;
    }
  }, [text]);
  if (!cells) return null;
  const cell = size / cells.n;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill="#F4F1EA" />
      {cells.dark.map((c) => (
        <Rect key={`${c.row}-${c.col}`} x={c.col * cell} y={c.row * cell} width={cell} height={cell} fill="#0B0D12" />
      ))}
    </Svg>
  );
}
