// Packs build/raw/icon-<size>.png files into a valid multi-size .ico (PNG entries, Vista+).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const buildDir = path.join(__dirname, "build");
const rawDir = path.join(buildDir, "raw");
const sizes = [16, 24, 32, 48, 64, 128, 256];

const pngs = sizes.map((s) => {
  const p = path.join(rawDir, `icon-${s}.png`);
  const data = fs.readFileSync(p);
  if (data[0] !== 0x89 || data[1] !== 0x50) throw new Error(`not a PNG: ${p}`);
  return { size: s, data };
});

const count = pngs.length;
const headerSize = 6 + 16 * count;
let offset = headerSize;
const chunks = [];

// ICONDIR
const head = Buffer.alloc(6);
head.writeUInt16LE(0, 0); // reserved
head.writeUInt16LE(1, 2); // type: icon
head.writeUInt16LE(count, 4);
chunks.push(head);

for (const { size, data } of pngs) {
  const e = Buffer.alloc(16);
  e[0] = size >= 256 ? 0 : size; // width
  e[1] = size >= 256 ? 0 : size; // height
  e[2] = 0; // colors
  e[3] = 0; // reserved
  e.writeUInt16LE(1, 4); // planes
  e.writeUInt16LE(32, 6); // bpp
  e.writeUInt32LE(data.length, 8); // bytes in resource
  e.writeUInt32LE(offset, 12); // image offset
  chunks.push(e, data);
  offset += data.length;
}

const ico = Buffer.concat(chunks);
fs.writeFileSync(path.join(buildDir, "icon.ico"), ico);

// verify
console.log(`icon.ico written: ${ico.length} bytes, ${count} entries`);
for (const { size, data } of pngs) {
  console.log(`  ${size}x${size}: ${data.length} bytes`);
}
