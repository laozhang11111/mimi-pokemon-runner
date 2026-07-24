const { readFileSync, writeFileSync } = require("fs");
const { crc32 } = require("zlib");
const zlib = require("zlib");

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readPng(file) {
  const source = readFileSync(file);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.toString("ascii", offset + 4, offset + 8);
    const data = source.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    }
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`${file} must be an 8-bit RGBA PNG`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  let rawOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;

    for (let x = 0; x < stride; x += 1) {
      let value = raw[rawOffset];
      rawOffset += 1;

      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;

      if (filter === 1) value = (value + left) & 255;
      if (filter === 2) value = (value + up) & 255;
      if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
      if (filter === 4) {
        const pa = Math.abs(up - upLeft);
        const pb = Math.abs(left - upLeft);
        const pc = Math.abs(left + up - upLeft - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = (value + predictor) & 255;
      }

      pixels[y * stride + x] = value;
    }
  }

  return { width, height, pixels };
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const body = Buffer.concat([name, data]);
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  name.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(body), output.length - 4);
  return output;
}

function writePng(file, image) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const stride = image.width * 4;
  const raw = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    const rawRow = y * (stride + 1);
    raw[rawRow] = 0;
    image.pixels.copy(raw, rawRow + 1, y * stride, y * stride + stride);
  }

  writeFileSync(file, Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

function copyPixel(source, sourceWidth, target, targetWidth, sx, sy, tx, ty) {
  const si = (sy * sourceWidth + sx) * 4;
  const ti = (ty * targetWidth + tx) * 4;
  target[ti] = source[si];
  target[ti + 1] = source[si + 1];
  target[ti + 2] = source[si + 2];
  target[ti + 3] = source[si + 3];
}

function transparentPixel(pixels, width, x, y) {
  const index = (y * width + x) * 4;
  pixels[index + 3] = 0;
}

function isWhite(pixels, width, x, y) {
  const index = (y * width + x) * 4;
  return pixels[index + 3] > 20 && pixels[index] > 235 && pixels[index + 1] > 235 && pixels[index + 2] > 235;
}

function fixSideSprite(file) {
  const image = readPng(file);
  const topPad = 10;
  if (image.height > 254) {
    for (let y = 0; y < topPad; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        transparentPixel(image.pixels, image.width, x, y);
      }
    }

    for (let y = topPad + 150; y < topPad + 236; y += 1) {
      for (let x = 46; x < 106; x += 1) {
        if (isWhite(image.pixels, image.width, x, y)) {
          transparentPixel(image.pixels, image.width, x, y);
        }
      }
    }

    writePng(file, image);
    return;
  }

  const output = {
    width: image.width,
    height: image.height + topPad,
    pixels: Buffer.alloc(image.width * (image.height + topPad) * 4),
  };

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      copyPixel(image.pixels, image.width, output.pixels, output.width, x, y, x, y + topPad);
    }
  }

  for (let y = topPad + 150; y < topPad + 236; y += 1) {
    for (let x = 46; x < 106; x += 1) {
      if (isWhite(output.pixels, output.width, x, y)) {
        transparentPixel(output.pixels, output.width, x, y);
      }
    }
  }

  writePng(file, output);
}

fixSideSprite("image/laozhang-right.png");
fixSideSprite("image/laozhang-left.png");
console.log("Fixed Lao Zhang side sprites");
