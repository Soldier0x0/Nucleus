import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const SIZE = 432;
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "../assets/launcher");

const GROUND = {
  paper: [243, 237, 228],
  midnight: [11, 13, 18],
  dune: [231, 211, 181],
  amoled: [0, 0, 0],
};

function palette(family, variant) {
  const ground = GROUND[variant];
  if (family === "paper" && variant === "paper") return { ground, ring: [26, 26, 26], core: [201, 132, 58], tick: [26, 26, 26] };
  if (family === "paper" && variant === "midnight") return { ground, ring: [214, 142, 66], core: [244, 239, 230], tick: [214, 142, 66] };
  if (family === "paper" && variant === "dune") return { ground, ring: [196, 181, 160], core: [201, 132, 58], tick: [196, 181, 160] };
  if (family === "paper" && variant === "amoled") return { ground, ring: [58, 58, 58], core: [214, 142, 66], tick: [58, 58, 58] };
  if (family === "metal") return { ground, ring: [201, 132, 58], core: [224, 161, 90], tick: [201, 132, 58] };
  if (family === "glass") return { ground, ring: [201, 161, 90], core: [232, 184, 106], tick: [201, 161, 90] };
  return { ground, ring: ground, core: [214, 142, 66], tick: ground };
}

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function paint(family, variant) {
  const p = palette(family, variant);
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const cx = (SIZE - 1) / 2;
  const cy = cx;
  const scale = SIZE / 100;
  const outer = 47 * scale;
  const stroke = (family === "glass" ? 4.5 : family === "metal" ? 9 : 8) * scale;
  const core = (family === "glass" ? 22 : family === "tiles" ? 14 : 16) * scale;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let color = p.ground;
      if (family === "tiles") {
        const left = x < SIZE / 2;
        const top = y < SIZE / 2;
        if (left && top) color = [201, 132, 58];
        else if (!left && top) color = [226, 195, 154];
        else if (left && !top) color = [196, 176, 138];
        else color = variant === "amoled" || variant === "midnight" ? [58, 52, 44] : [215, 180, 138];
        if (dist <= core) color = p.core;
      } else if (dist <= outer && dist >= outer - stroke) color = p.ring;
      else if (dist <= core) color = p.core;
      else if (Math.abs(dx) <= 1.6 * scale && y < cy - outer + stroke * 1.4 && y > 6 * scale) color = p.tick;
      const i = (y * SIZE + x) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 255;
    }
  }
  return png(SIZE, SIZE, buf);
}

fs.mkdirSync(OUT, { recursive: true });
for (const family of ["paper", "metal", "glass", "tiles"]) {
  for (const variant of ["paper", "midnight", "dune", "amoled"]) {
    fs.writeFileSync(path.join(OUT, `${family}-${variant}.png`), paint(family, variant));
  }
}
fs.writeFileSync(path.join(OUT, "../icon.png"), paint("paper", "paper"));
fs.writeFileSync(path.join(OUT, "../adaptive-icon.png"), paint("paper", "paper"));
