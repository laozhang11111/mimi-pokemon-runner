const { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const POKEMON_COUNT = 1025;
const ROOT = __dirname;
const IMAGE_DIR = join(ROOT, "image");
const POKEDEX_PATH = join(IMAGE_DIR, "pokedex.json");
const PLAYER_SOURCE = "/Users/zhangduotian/Downloads/cfb6daad-fbdf-421a-9d85-436a43522956.png";

mkdirSync(IMAGE_DIR, { recursive: true });

function pad(number) {
  return String(number).padStart(4, "0");
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "pixel-hisui-runner-local-prototype" },
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${url}`);
  }
  return response.json();
}

async function download(url, filePath) {
  if (existsSync(filePath)) return;
  const response = await fetch(url, {
    headers: { "User-Agent": "pixel-hisui-runner-local-prototype" },
  });
  if (!response.ok) {
    throw new Error(`Asset failed ${response.status}: ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(filePath, bytes);
}

async function pool(items, concurrency, worker) {
  let index = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function main() {
  if (existsSync(PLAYER_SOURCE)) {
    copyFileSync(PLAYER_SOURCE, join(IMAGE_DIR, "player.png"));
    copyFileSync(PLAYER_SOURCE, join(IMAGE_DIR, "player-reference.png"));
  }

  let pokedex = [];
  if (existsSync(POKEDEX_PATH)) {
    pokedex = JSON.parse(readFileSync(POKEDEX_PATH, "utf8"));
  }

  const known = new Map(pokedex.map((item) => [item.id, item]));
  const ids = Array.from({ length: POKEMON_COUNT }, (_, index) => index + 1);

  await pool(ids, 8, async (id) => {
    if (known.has(id) && existsSync(join(IMAGE_DIR, `pokemon-${pad(id)}.png`))) return;

    const detail = await getJson(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const sprite =
      detail.sprites?.front_default ||
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    const file = `pokemon-${pad(id)}.png`;

    await download(sprite, join(IMAGE_DIR, file));
    known.set(id, {
      id,
      name: detail.name,
      height: detail.height,
      weight: detail.weight,
      sprite,
      file,
      types: detail.types.map((item) => item.type.name),
    });
    if (id % 50 === 0) {
      console.log(`Fetched #${pad(id)} ${detail.name}`);
    }
  });

  pokedex = ids.map((id) => known.get(id));
  writeFileSync(POKEDEX_PATH, `${JSON.stringify(pokedex, null, 2)}\n`);
  console.log(`Saved ${pokedex.length} Pokemon assets to ${IMAGE_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
