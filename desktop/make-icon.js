/* Generates a 1024x1024 RGBA app icon (neon "play" triangle on a dark backdrop,
   matching Light Again's launcher glyph) with zero image dependencies — just
   Node's built-in zlib. Output: icon-src.png, fed to `tauri icon`. */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const S = 1024;
const buf = Buffer.alloc(S * S * 4);

// CRC32 (so we don't depend on a specific Node version's zlib.crc32)
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (b) => {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

// Play triangle (points right), centered.
const ax = 392, ay = 300, bx = 392, by = 724, cx = 748, cy = 512;
function sign(px, py, x1, y1, x2, y2) { return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2); }
function inTri(px, py) {
  const d1 = sign(px, py, ax, ay, bx, by);
  const d2 = sign(px, py, bx, by, cx, cy);
  const d3 = sign(px, py, cx, cy, ax, ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

const cxC = 512, cyC = 512;
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    // Dark vertical gradient backdrop
    const tg = y / S;
    let r = Math.round(20 - 10 * tg);
    let g = Math.round(18 - 9 * tg);
    let b = Math.round(31 - 14 * tg);
    // Soft cyan radial glow toward the centre
    const dx = x - cxC, dy = y - cyC;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const glow = Math.max(0, 1 - dist / 560);
    r += Math.round(8 * glow * glow);
    g += Math.round(70 * glow * glow);
    b += Math.round(90 * glow * glow);
    // Neon play triangle
    if (inTri(x, y)) { r = 90; g = 255; b = 255; }
    buf[i] = Math.min(255, r);
    buf[i + 1] = Math.min(255, g);
    buf[i + 2] = Math.min(255, b);
    buf[i + 3] = 255;
  }
}

// Encode PNG (RGBA, filter 0 per scanline)
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td), 0);
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  buf.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);
const out = path.join(__dirname, 'icon-src.png');
fs.writeFileSync(out, png);
console.log('wrote', out, png.length, 'bytes');
