const { copyFileSync, existsSync, mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const imageDir = join(__dirname, "image");
mkdirSync(imageDir, { recursive: true });

const POKEMON_COUNT = 1025;
const SPRITE_SIZE = 192;
const referencePath =
  "/var/folders/cq/g1cjktzn6fs1sq21lz7b27xh0000gp/T/codex-clipboard-babf48d0-21d4-4104-81d8-bbe3b222880e.png";

const palettes = [
  ["#5f9f64", "#7fbd72", "#d4ed9a", "#d94b52", "#2f3d28", "#1f251b"],
  ["#5c91d1", "#84b7e6", "#f4e0a5", "#8a5ed1", "#273b68", "#17213a"],
  ["#c68152", "#dfa36f", "#ffd2a0", "#3d3430", "#72412e", "#2b1e19"],
  ["#d76f8f", "#ee9fb8", "#ffe1ef", "#834aa0", "#6f314e", "#302035"],
  ["#7f76c9", "#aaa4e8", "#d8eff7", "#dfbf3e", "#48417e", "#25233f"],
  ["#42a7a0", "#75c7bd", "#f7e39a", "#cf5555", "#256d69", "#173b38"],
  ["#91bc5c", "#b7d875", "#f6eeac", "#447bc8", "#55772f", "#25331d"],
  ["#b581cb", "#d2a5e4", "#fae7ff", "#63bd84", "#754590", "#35223b"],
  ["#d6a34a", "#efc36d", "#fff0b2", "#e45b42", "#9a682c", "#3d2b16"],
  ["#709ba6", "#9cc4ca", "#d9f5ed", "#efcf54", "#456d77", "#1d3237"],
];

function svgWrap(content, size = SPRITE_SIZE) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
  <rect width="${size}" height="${size}" fill="none"/>
${content}
</svg>
`;
}

function r(x, y, w, h, fill) {
  return `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>\n`;
}

function path(d, fill) {
  return `  <path d="${d}" fill="${fill}"/>\n`;
}

function pxArt(rows, x, y, scale, map) {
  let out = "";
  rows.forEach((row, rowIndex) => {
    [...row].forEach((cell, colIndex) => {
      if (cell !== "." && map[cell]) {
        out += r(x + colIndex * scale, y + rowIndex * scale, scale, scale, map[cell]);
      }
    });
  });
  return out;
}

function playerSvg() {
  const map = {
    o: "#2a2323",
    h: "#1c1818",
    H: "#3b3030",
    r: "#dc4651",
    s: "#e7ae78",
    S: "#c98658",
    w: "#f4f0f4",
    v: "#b65ca4",
    V: "#7a417c",
    p: "#5a49a7",
    P: "#342a76",
    b: "#8c83a0",
    q: "#eee9e3",
  };
  const rows = [
    "................",
    "......oooo......",
    "....oohhhhoo....",
    "...ohhhhhhhho...",
    "..rohhhHHhhho...",
    "..rrhhsssssho...",
    "...ohssssssSo...",
    "...ohsosssoso...",
    "....hsssSSso....",
    ".....sssssS.....",
    "...oowwvvvo.....",
    "..owwwwvvVVo....",
    "..owwwvVvvVo....",
    "...owwvVVvo.....",
    "....opppPPo.....",
    "....opppPPo.....",
    "...oopp.PPoo....",
    "..qqbb...bbqq...",
    ".qqq.......qq...",
  ];
  let s = "";
  s += r(71, 31, 32, 18, "#1c1818");
  s += r(53, 55, 16, 38, "#1c1818");
  s += pxArt(rows, 31, 12, 7, map);
  s += r(103, 91, 30, 12, "#e7ae78");
  s += r(128, 101, 24, 10, "#e7ae78");
  s += r(146, 109, 10, 9, "#c98658");
  s += r(111, 104, 22, 7, "#c98658");
  s += r(72, 60, 6, 6, "#1f1a1a");
  s += r(95, 60, 6, 6, "#1f1a1a");
  s += r(82, 75, 18, 4, "#8f3e3e");
  return svgWrap(s);
}

function pokemonSvg(number) {
  const [base, mid, light, accent, shade, dark] = palettes[number % palettes.length];
  const power = number / POKEMON_COUNT;
  const family = number % 9;
  const sizeClass = number % 12;
  const profile =
    sizeClass === 0
      ? { scale: 0.64, lift: 34, long: 0.9 }
      : sizeClass === 1
        ? { scale: 0.78, lift: 24, long: 1.05 }
        : sizeClass === 2
          ? { scale: 0.92, lift: 14, long: 1.18 }
          : sizeClass === 3
            ? { scale: 1.08, lift: 4, long: 1 }
            : sizeClass === 4
              ? { scale: 1.22, lift: -8, long: 1.08 }
              : sizeClass === 5
                ? { scale: 0.72, lift: 30, long: 1.45 }
                : sizeClass === 6
                  ? { scale: 1.18, lift: -4, long: 0.82 }
                  : sizeClass === 7
                    ? { scale: 0.84, lift: 18, long: 0.78 }
                    : sizeClass === 8
                      ? { scale: 1.34, lift: -14, long: 1.16 }
                      : sizeClass === 9
                        ? { scale: 0.58, lift: 42, long: 0.82 }
                        : sizeClass === 10
                          ? { scale: 1.02, lift: 8, long: 1.35 }
                          : { scale: 0.96, lift: 12, long: 0.96 };
  const bodyW = Math.floor((58 + Math.floor(power * 26) + (family % 3) * 5) * profile.scale * profile.long);
  const bodyH = Math.floor((48 + Math.floor(power * 20) + (family % 2) * 6) * profile.scale);
  const x = Math.floor((SPRITE_SIZE - bodyW) / 2);
  const y = 70 - Math.floor(power * 12) - profile.lift;
  const headW = Math.floor((42 + (number % 5) * 4) * profile.scale);
  const headH = Math.floor((36 + (number % 4) * 3) * profile.scale);
  const headX = x + Math.floor(bodyW * 0.45) - Math.floor(headW / 2);
  const headY = y - Math.floor(16 * profile.scale) - Math.floor(power * 8);
  const tail = Math.floor((18 + (number % 8) * 3) * profile.scale);
  const foot = Math.max(7, Math.floor(13 * profile.scale));
  const eye = Math.max(4, Math.floor(7 * profile.scale));
  let s = "";

  s += path(`M ${x + 18} ${y + 24} L ${x + bodyW - 14} ${y + 20} L ${x + bodyW + 2} ${y + bodyH - 10} L ${x + bodyW - 20} ${y + bodyH + 12} L ${x + 20} ${y + bodyH + 10} L ${x - 4} ${y + bodyH - 8} Z`, dark);
  s += path(`M ${x + 15} ${y + 18} L ${x + bodyW - 15} ${y + 16} L ${x + bodyW - 2} ${y + bodyH - 15} L ${x + bodyW - 26} ${y + bodyH + 5} L ${x + 22} ${y + bodyH + 6} L ${x + 3} ${y + bodyH - 12} Z`, base);
  s += path(`M ${x + 30} ${y + 31} L ${x + bodyW - 26} ${y + 30} L ${x + bodyW - 30} ${y + bodyH} L ${x + 33} ${y + bodyH + 1} Z`, mid);
  s += path(`M ${x + 42} ${y + bodyH - 26} L ${x + bodyW - 38} ${y + bodyH - 27} L ${x + bodyW - 46} ${y + bodyH + 2} L ${x + 48} ${y + bodyH + 2} Z`, light);
  s += path(`M ${headX + 7} ${headY + 6} L ${headX + headW - 8} ${headY + 2} L ${headX + headW + 4} ${headY + headH - 9} L ${headX + headW - 10} ${headY + headH + 4} L ${headX + 8} ${headY + headH + 3} L ${headX - 3} ${headY + headH - 12} Z`, dark);
  s += path(`M ${headX + 8} ${headY + 8} L ${headX + headW - 9} ${headY + 5} L ${headX + headW + 1} ${headY + headH - 12} L ${headX + headW - 13} ${headY + headH} L ${headX + 10} ${headY + headH} L ${headX} ${headY + headH - 13} Z`, mid);
  s += path(`M ${headX + 20} ${headY + 16} L ${headX + headW - 16} ${headY + 14} L ${headX + headW - 22} ${headY + 28} L ${headX + 18} ${headY + 30} Z`, light);

  if (family === 0 || family === 4 || family === 8) {
    s += path(`M ${headX + 9} ${headY + 9} L ${headX + Math.floor(22 * profile.scale)} ${headY - Math.floor(24 * profile.scale)} L ${headX + Math.floor(30 * profile.scale)} ${headY + 14} Z`, accent);
    s += path(`M ${headX + headW - 10} ${headY + 7} L ${headX + headW - Math.floor(25 * profile.scale)} ${headY - Math.floor(28 * profile.scale)} L ${headX + headW - Math.floor(32 * profile.scale)} ${headY + 15} Z`, accent);
    s += path(`M ${x + bodyW - 5} ${y + 38} L ${x + bodyW + tail} ${y + 24} L ${x + bodyW + tail - 4} ${y + 47} L ${x + bodyW - 1} ${y + 56} Z`, accent);
  } else if (family === 1 || family === 5) {
    s += path(`M ${headX + 3} ${headY + 12} L ${headX - Math.floor(20 * profile.scale)} ${headY - 2} L ${headX - Math.floor(12 * profile.scale)} ${headY + Math.floor(31 * profile.scale)} Z`, accent);
    s += path(`M ${headX + headW - 2} ${headY + 10} L ${headX + headW + Math.floor(22 * profile.scale)} ${headY - 8} L ${headX + headW + Math.floor(14 * profile.scale)} ${headY + Math.floor(31 * profile.scale)} Z`, accent);
    s += path(`M ${x - 7} ${y + 48} L ${x - 26} ${y + 34} L ${x - 18} ${y + 67} Z`, accent);
  } else if (family === 2 || family === 6) {
    s += r(headX + Math.floor(12 * profile.scale), headY - Math.floor(22 * profile.scale), Math.max(5, Math.floor(9 * profile.scale)), Math.floor(30 * profile.scale), accent);
    s += r(headX + Math.floor(25 * profile.scale), headY - Math.floor(29 * profile.scale), Math.max(5, Math.floor(9 * profile.scale)), Math.floor(38 * profile.scale), accent);
    s += r(headX + headW - Math.floor(22 * profile.scale), headY - Math.floor(24 * profile.scale), Math.max(5, Math.floor(9 * profile.scale)), Math.floor(32 * profile.scale), accent);
    s += path(`M ${x + bodyW - 3} ${y + 42} L ${x + bodyW + tail} ${y + 48} L ${x + bodyW + tail + 8} ${y + 59} L ${x + bodyW + 2} ${y + 61} Z`, shade);
  } else {
    s += r(headX + 8, headY - Math.floor(12 * profile.scale), Math.floor(17 * profile.scale), Math.floor(20 * profile.scale), base);
    s += r(headX + headW - Math.floor(25 * profile.scale), headY - Math.floor(15 * profile.scale), Math.floor(17 * profile.scale), Math.floor(23 * profile.scale), base);
    s += path(`M ${x + bodyW - 2} ${y + 45} L ${x + bodyW + tail} ${y + 35} L ${x + bodyW + tail + 5} ${y + 50} L ${x + bodyW + 2} ${y + 62} Z`, accent);
  }

  s += r(headX + Math.floor(headW * 0.32), headY + Math.floor(headH * 0.58), eye, eye + 1, dark);
  s += r(headX + Math.floor(headW * 0.68), headY + Math.floor(headH * 0.56), eye, eye + 1, dark);
  s += r(headX + Math.floor(headW * 0.32) + 2, headY + Math.floor(headH * 0.58) + 1, 2, 2, "#ffffff");
  s += r(headX + Math.floor(headW * 0.68) + 2, headY + Math.floor(headH * 0.56) + 1, 2, 2, "#ffffff");
  s += r(headX + Math.floor(headW / 2) - Math.floor(10 * profile.scale), headY + Math.floor(headH * 0.9), Math.floor(20 * profile.scale), Math.max(3, Math.floor(5 * profile.scale)), dark);
  s += r(x + Math.floor(bodyW * 0.25), y + bodyH + 4, foot, Math.floor(13 * profile.scale), dark);
  s += r(x + Math.floor(bodyW * 0.7), y + bodyH + 4, foot, Math.floor(13 * profile.scale), dark);
  s += r(x + Math.floor(bodyW * 0.22), y + bodyH + Math.floor(15 * profile.scale), foot + 10, Math.max(4, Math.floor(6 * profile.scale)), "#eee8de");
  s += r(x + Math.floor(bodyW * 0.66), y + bodyH + Math.floor(15 * profile.scale), foot + 10, Math.max(4, Math.floor(6 * profile.scale)), "#eee8de");

  if (number % 7 === 0) {
    s += path(`M ${headX + Math.floor(headW / 2)} ${headY + 13} L ${headX + Math.floor(headW / 2) + 12} ${headY + 26} L ${headX + Math.floor(headW / 2)} ${headY + 39} L ${headX + Math.floor(headW / 2) - 12} ${headY + 26} Z`, "#fff4bb");
    s += r(headX + Math.floor(headW / 2) - 3, headY + 23, 6, 6, accent);
  }
  if (number % 11 === 0) {
    s += r(x + bodyW - 4, y + 10, 13, 13, "#fff2a8");
    s += r(x + bodyW + 1, y + 15, 4, 4, accent);
  }

  return svgWrap(s);
}

function previewSheet() {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1080" viewBox="0 0 1440 1080">
  <rect width="1440" height="1080" fill="#f6ead3"/>
  <text x="34" y="48" fill="#26241f" font-size="28" font-family="Arial, sans-serif" font-weight="700">Stardew-like crisp sprite preview</text>
  <text x="34" y="78" fill="#6a5749" font-size="16" font-family="Arial, sans-serif">player + pokemon-0001 to pokemon-0059</text>
`;
  const files = ["player", ...Array.from({ length: 59 }, (_, i) => String(i + 1).padStart(4, "0"))];
  files.forEach((id, index) => {
    const col = index % 10;
    const row = Math.floor(index / 10);
    const x = 34 + col * 138;
    const y = 108 + row * 156;
    s += `  <rect x="${x}" y="${y}" width="118" height="138" rx="6" fill="#fff8e8" stroke="#5a473a" stroke-width="3"/>\n`;
    if (id === "player") {
      s += `  <image href="player.png" x="${x + 31}" y="${y + 8}" width="56" height="119" preserveAspectRatio="xMidYMid meet"/>\n`;
    } else {
      s += `  <image href="pokemon-${id}.svg" x="${x - 32}" y="${y - 26}" width="192" height="192" preserveAspectRatio="xMidYMid meet"/>\n`;
    }
    s += `  <text x="${x + 59}" y="${y + 130}" fill="#26241f" font-size="13" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle">${id}</text>\n`;
  });
  s += "</svg>\n";
  return s;
}

if (existsSync(referencePath)) {
  copyFileSync(referencePath, join(imageDir, "player.png"));
  copyFileSync(referencePath, join(imageDir, "player-reference.png"));
}

writeFileSync(join(imageDir, "player.svg"), playerSvg());
for (let number = 1; number <= POKEMON_COUNT; number += 1) {
  writeFileSync(join(imageDir, `pokemon-${String(number).padStart(4, "0")}.svg`), pokemonSvg(number));
}
writeFileSync(join(imageDir, "preview-sheet.svg"), previewSheet());

console.log(`Generated ${POKEMON_COUNT + 3} sharper sprite files in ${imageDir}`);
