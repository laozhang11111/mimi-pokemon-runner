const { readFileSync, writeFileSync, existsSync, copyFileSync } = require("node:fs");
const { join } = require("node:path");
const zlib = require("node:zlib");

const imageDir = join(__dirname, "image");
const inputPath = join(imageDir, "player.png");
const backupPath = join(imageDir, "player-original.png");

function readPng(buffer) {
  const signature = buffer.subarray(0, 8);
  if (signature.toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Not a PNG file");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || colorType !== 2) {
    throw new Error(`Expected 8-bit RGB PNG, got bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const compressed = Buffer.concat(idat);
  const raw = zlib.inflateSync(compressed);
  const bpp = 3;
  const stride = width * bpp;
  const pixels = Buffer.alloc(width * height * bpp);
  let rawOffset = 0;
  let outOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const scanline = Buffer.from(raw.subarray(rawOffset, rawOffset + stride));
    rawOffset += stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? scanline[x - bpp] : 0;
      const up = previous[x] || 0;
      const upLeft = x >= bpp ? previous[x - bpp] || 0 : 0;
      let value = scanline[x];

      if (filter === 1) {
        value = (value + left) & 255;
      } else if (filter === 2) {
        value = (value + up) & 255;
      } else if (filter === 3) {
        value = (value + Math.floor((left + up) / 2)) & 255;
      } else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predict = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = (value + predict) & 255;
      }
      scanline[x] = value;
    }

    scanline.copy(pixels, outOffset);
    previous = scanline;
    outOffset += stride;
  }

  return { width, height, pixels };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}

function writeRgbaPng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function isBackgroundLike(r, g, b) {
  return r > 220 && g > 220 && b > 220 && Math.max(r, g, b) - Math.min(r, g, b) < 34;
}

function makeTransparent() {
  if (!existsSync(backupPath)) {
    copyFileSync(inputPath, backupPath);
  }

  const source = readPng(readFileSync(inputPath));
  const { width, height, pixels } = source;
  const total = width * height;
  const bg = new Uint8Array(total);
  const queue = [];

  function visit(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (bg[index]) return;
    const p = index * 3;
    if (!isBackgroundLike(pixels[p], pixels[p + 1], pixels[p + 2])) return;
    bg[index] = 1;
    queue.push(index);
  }

  for (let x = 0; x < width; x += 1) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    visit(0, y);
    visit(width - 1, y);
  }

  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const x = index % width;
    const y = Math.floor(index / width);
    visit(x + 1, y);
    visit(x - 1, y);
    visit(x, y + 1);
    visit(x, y - 1);
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < total; index += 1) {
    const src = index * 3;
    const dst = index * 4;
    rgba[dst] = pixels[src];
    rgba[dst + 1] = pixels[src + 1];
    rgba[dst + 2] = pixels[src + 2];
    rgba[dst + 3] = bg[index] ? 0 : 255;
  }

  writeFileSync(inputPath, writeRgbaPng(width, height, rgba));
  console.log(`Made player background transparent: ${inputPath}`);
  console.log(`Original backup: ${backupPath}`);
}

makeTransparent();
