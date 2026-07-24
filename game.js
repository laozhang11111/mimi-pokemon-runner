const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const heartsEl = document.querySelector("#hearts");
const scoreEl = document.querySelector("#score");
const distanceEl = document.querySelector("#distance");
const currentPokemonEl = document.querySelector("#currentPokemon");
const scoreHistoryEl = document.querySelector("#scoreHistory");
const restartButton = document.querySelector("#restartButton");
const overlay = document.querySelector("#overlay");
const modeButtons = document.querySelectorAll(".mode-buttons button");
const scoreboard = document.querySelector(".scoreboard");
const touchKeys = document.querySelectorAll(".touch-key");

const W = canvas.width;
const H = canvas.height;
const MAX_HP = 10;
const DUAL_MAX_HP = 20;
const TRIPLE_MAX_HP = 30;
const MIMI_SPEED = 260;
const MIMI_HITBOX_W = 32;
const MIMI_HITBOX_H = 90;
const POKEMON_COUNT = 1025;
const BASE_WORLD_SPEED = 170;
const BASE_MONSTER_SPAWN_MIN = 0.72;
const BASE_MONSTER_SPAWN_MAX = 1.2;
const keys = new Set();
const activeTouchKeys = new Set();
const imageCache = new Map();
const schoolBackgroundImage = loadImage("image/school-drawing-bg.png");
const playerPoseImages = {
  up: loadImage("image/player-up.png"),
  down: loadImage("image/player-down.png"),
  left: loadImage("image/player-left.png"),
  right: loadImage("image/player-right.png"),
};
const laozhangPoseImages = {
  up: loadImage("image/laozhang-up.png"),
  down: loadImage("image/laozhang-down.png"),
  left: loadImage("image/laozhang-left.png"),
  right: loadImage("image/laozhang-right.png"),
};
const mamaPoseImages = {
  up: loadImage("image/mama-up.png"),
  down: loadImage("image/mama-down.png"),
  left: loadImage("image/mama-left.png"),
  right: loadImage("image/mama-right.png"),
};
const playerImagesReady = Promise.all(
  [...Object.values(playerPoseImages), ...Object.values(laozhangPoseImages), ...Object.values(mamaPoseImages)].map(waitForImage),
);
let pokedex = [];
let pokedexReady = null;

let state;
let lastTime = 0;
let animationId = 0;

ctx.imageSmoothingEnabled = false;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);

function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  imageCache.set(src, image);
  return image;
}

function waitForImage(image) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve(image);
  return new Promise((resolve) => {
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => resolve(image), { once: true });
  });
}

async function loadPokedex() {
  try {
    const response = await fetch("image/pokedex.json");
    if (!response.ok) return;
    pokedex = await response.json();
  } catch (error) {
    pokedex = [];
  }
}

function ensurePokedex() {
  if (!pokedexReady) pokedexReady = loadPokedex();
  return pokedexReady;
}

function hydratePokemonDeck() {
  if (!state || pokedex.length === 0) return;
  const pokedexById = new Map(pokedex.map((entry) => [Number(entry.id), entry]));
  state.pokemonDeck = state.pokemonDeck.map((entry) => ({ ...entry, ...(pokedexById.get(Number(entry.id)) || {}) }));
  for (const monster of state.monsters) {
    monster.name = pokemonName(monster.number);
  }
  updateHud();
}

function resetGame(mode = state?.mode || "single") {
  const players = createPlayers(mode);
  const maxHp = getMaxHp(mode);
  state = {
    status: "playing",
    mode,
    maxHp,
    hp: maxHp,
    score: 0,
    distance: 0,
    speed: BASE_WORLD_SPEED,
    invincible: 0,
    teamShield: 0,
    teamShieldReadyScore: 100,
    teamCollisionUntil: 0,
    teamCollisionPlayers: new Set(),
    monsterTimer: 0,
    ballTimer: 2.5,
    nextPokemonIndex: 0,
    pokemonDeck: createPokemonDeck(),
    saved: false,
    players,
    player: players[0],
    monsters: [],
    balls: [],
    particles: [],
  };
  ensurePokedex().then(hydratePokemonDeck);
  lastTime = performance.now();
  overlay.classList.remove("cover");
  overlay.classList.add("hidden");
  restartButton.classList.remove("hidden-control");
  restartButton.textContent = "重新开始";
  updateHud();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

function getMaxHp(mode) {
  if (mode === "triple") return TRIPLE_MAX_HP;
  if (mode === "dual") return DUAL_MAX_HP;
  return MAX_HP;
}

function createPlayers(mode) {
  const mimi = {
    id: "mimi",
    name: "张米米",
    poses: playerPoseImages,
    x: 86,
    y: H - 138,
    w: 48,
    h: 102,
    speed: MIMI_SPEED,
    collisionScale: 1,
    step: 0,
    direction: "right",
  };
  if (mode === "single") return [mimi];

  const laozhangHeight = Math.round(mimi.h * (170 / 124));
  const laozhang = {
    id: "laozhang",
    name: "老张",
    poses: laozhangPoseImages,
    normalizePoseHeight: true,
    x: 30,
    y: H - laozhangHeight - 36,
    w: Math.round(mimi.w * (170 / 124)),
    h: laozhangHeight,
    speed: MIMI_SPEED * 1.5,
    collisionScale: 1.5,
    verticalActionPose: true,
    step: 0,
    direction: "right",
  };

  if (mode === "dual") {
    mimi.x = 108;
    return [mimi, laozhang];
  }

  const mamaHeight = Math.round(mimi.h * (158 / 124));
  const mama = {
    id: "mama",
    name: "妈妈",
    poses: mamaPoseImages,
    normalizePoseHeight: true,
    x: 150,
    y: H - mamaHeight - 36,
    w: Math.round(mimi.w * (158 / 124)),
    h: mamaHeight,
    speed: MIMI_SPEED * 1.25,
    collisionScale: 1.25,
    verticalActionPose: true,
    step: 0,
    direction: "right",
  };
  mimi.x = 205;
  laozhang.x = 32;
  return [mimi, laozhang, mama];
}

function createPokemonDeck() {
  const deck =
    pokedex.length > 0
      ? pokedex.map((entry) => ({ ...entry }))
      : Array.from({ length: POKEMON_COUNT }, (_, index) => {
          const id = index + 1;
          return {
            id,
            name: pokemonName(id),
            zhName: pokemonName(id),
            height: 8,
            weight: 200,
            file: `pokemon-${String(id).padStart(4, "0")}.png`,
          };
        });

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function gameOver() {
  state.status = "over";
  saveScore("defeat");
  overlay.classList.remove("cover");
  overlay.classList.remove("hidden");
  restartButton.classList.remove("hidden-control");
  overlay.querySelector("h2").textContent = "冒险结束";
  overlay.querySelector("p").textContent = `你躲过了 ${state.score} 只宝可梦，跑了 ${Math.floor(state.distance)} 米。最终得分已记录。`;
  updateModeButtonText("单人重开", "双人重开", "三人重开", "历史记录");
}

function gameWin() {
  state.status = "win";
  saveScore("win");
  overlay.classList.remove("cover");
  overlay.classList.remove("hidden");
  restartButton.classList.remove("hidden-control");
  overlay.querySelector("h2").textContent = "满分通关";
  overlay.querySelector("p").textContent = `1025 只宝可梦全部通过，最终得分已记录。`;
  updateModeButtonText("单人再玩", "双人再玩", "三人再玩", "历史记录");
}

function updateModeButtonText(singleText, dualText, tripleText, historyText = "历史记录") {
  for (const button of modeButtons) {
    if (button.dataset.action === "history") {
      button.textContent = historyText;
    } else if (button.dataset.mode === "triple") {
      button.textContent = tripleText;
    } else {
      button.textContent = button.dataset.mode === "dual" ? dualText : singleText;
    }
  }
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  if (state.status === "playing") {
    update(dt);
  }
  draw();
  animationId = requestAnimationFrame(loop);
}

function update(dt) {
  for (const player of state.players) {
    updatePlayer(player, dt);
  }

  state.distance += state.speed * dt * 0.06;
  const difficulty = getDifficulty();
  const targetSpeed = BASE_WORLD_SPEED * difficulty.speedMultiplier;
  state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 1.8);
  state.invincible = Math.max(0, state.invincible - dt);
  state.teamShield = Math.max(0, state.teamShield - dt);
  state.teamCollisionUntil = Math.max(0, state.teamCollisionUntil - dt);
  if (state.teamCollisionUntil <= 0 && state.teamCollisionPlayers.size > 0) {
    state.teamCollisionPlayers.clear();
  }

  state.monsterTimer -= dt;
  state.ballTimer -= dt;
  if (state.monsterTimer <= 0 && state.nextPokemonIndex < state.pokemonDeck.length) {
    spawnMonster();
    state.monsterTimer = rand(BASE_MONSTER_SPAWN_MIN, BASE_MONSTER_SPAWN_MAX) / difficulty.densityMultiplier;
  }
  if (state.ballTimer <= 0) {
    if (Math.random() < difficulty.ballChance) {
      spawnBall();
    }
    state.ballTimer = rand(5, 7.5);
  }

  const passX = Math.min(...state.players.map((player) => player.x));
  for (const monster of state.monsters) {
    monster.x -= (state.speed + monster.speed * difficulty.speedMultiplier) * monster.speedBurstMultiplier * dt;
    monster.y = clamp(
      monster.baseY +
        Math.sin(nowish(monster.seed) * monster.driftSpeed + monster.driftPhase) * monster.driftRange +
        Math.sin(monster.x * 0.018 + monster.driftPhase) * monster.float,
      90,
      H - monster.h - 32,
    );
    if (!monster.passed && monster.x + monster.w < passX) {
      monster.passed = true;
      state.score = Math.min(POKEMON_COUNT, state.score + 1);
      state.distance += 1;
      burst(monster.x + monster.w / 2, monster.y + monster.h / 2, "#f4d35e");
    }
  }
  for (const ball of state.balls) {
    ball.x -= (state.speed * 0.92) * dt;
    ball.spin += dt * 7;
  }
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }

  state.monsters = state.monsters.filter((m) => m.x > -80);
  state.balls = state.balls.filter((b) => b.x > -40 && !b.collected);
  state.particles = state.particles.filter((pcl) => pcl.life > 0);

  checkCollisions();
  if (state.score >= POKEMON_COUNT && state.monsters.every((monster) => monster.passed || monster.x < -80)) {
    updateHud();
    gameWin();
    return;
  }
  updateHud();
}

function updatePlayer(p, dt) {
  const controls = getPlayerControls(p);
  const up = controls.up;
  const down = controls.down;
  const left = controls.left;
  const right = controls.right;
  const dx = (right ? 1 : 0) - (left ? 1 : 0);
  const dy = (down ? 1 : 0) - (up ? 1 : 0);
  const len = Math.hypot(dx, dy) || 1;

  if (Math.abs(dx) > Math.abs(dy)) {
    p.direction = dx > 0 ? "right" : dx < 0 ? "left" : p.direction;
  } else if (dy !== 0) {
    p.direction = dy > 0 ? "down" : "up";
  }

  p.x = clamp(p.x + (dx / len) * p.speed * dt, 18, W - p.w - 18);
  p.y = clamp(p.y + (dy / len) * p.speed * dt, 90, H - p.h - 36);
  p.step += (Math.abs(dx) + Math.abs(dy) > 0 ? 14 : 6) * dt;
}

function getPlayerControls(player) {
  const arrows = {
    up: keys.has("ArrowUp"),
    down: keys.has("ArrowDown"),
    left: keys.has("ArrowLeft"),
    right: keys.has("ArrowRight"),
  };
  const wasd = {
    up: keys.has("w"),
    down: keys.has("s"),
    left: keys.has("a"),
    right: keys.has("d"),
  };
  const ijkl = {
    up: keys.has("i"),
    down: keys.has("k"),
    left: keys.has("j"),
    right: keys.has("l"),
  };
  if (state.mode === "single") {
    return {
      up: arrows.up || wasd.up,
      down: arrows.down || wasd.down,
      left: arrows.left || wasd.left,
      right: arrows.right || wasd.right,
    };
  }
  if (state.mode === "triple") {
    if (player.id === "laozhang") return arrows;
    if (player.id === "mama") return ijkl;
    return wasd;
  }
  return player.id === "laozhang" ? arrows : wasd;
}

function nowish(seed) {
  return performance.now() * 0.002 + seed;
}

function getDifficulty() {
  const level = Math.floor(state.score / 100);
  const progress = clamp(state.score / POKEMON_COUNT, 0, 1);
  return {
    speedMultiplier: Math.min(3, 1 + level * 0.2),
    densityMultiplier: Math.min(3, 1 + level * 0.2),
    ballChance: clamp(1 - progress * 1.2, 0, 1),
  };
}

function spawnMonster() {
  const order = state.nextPokemonIndex;
  const entry = state.pokemonDeck[order];
  state.nextPokemonIndex += 1;
  const number = entry.id || order + 1;
  const size = pokemonSize(entry);
  const baseY = rand(104, H - size.h - 42);
  const speedRoll = Math.random();
  const speedBurstMultiplier = speedRoll < 0.1 ? 3 : speedRoll < 0.2 ? 2 : 1;
  state.monsters.push({
    number,
    order,
    name: entry.zhName || entry.name || pokemonName(number),
    image: loadImage(`image/${entry.file}`),
    x: W + 42,
    y: baseY,
    baseY,
    w: size.w,
    h: size.h,
    seed: rand(0, 100),
    speed: 25 + (order / POKEMON_COUNT) * 95 + (number % 7) * 3,
    speedBurstMultiplier,
    float: rand(2, 7),
    driftRange: rand(8, 24),
    driftSpeed: rand(1.1, 2.3),
    driftPhase: rand(0, Math.PI * 2),
    passed: false,
  });
}

function pokemonName(number) {
  const entry = pokedex.find((item) => Number(item.id) === Number(number));
  return entry?.zhName || entry?.name || `宝可梦${number}`;
}

function pokemonSize(entry) {
  const heightMeters = Math.max(0.2, (entry.height || 8) / 10);
  const weightKg = Math.max(0.1, (entry.weight || 200) / 10);
  const heightFactor = clamp(Math.sqrt(heightMeters / 1.1), 0.48, 1.85);
  const weightFactor = clamp(Math.pow(weightKg / 35, 0.18), 0.82, 1.35);
  const aspect = clamp(0.78 + weightFactor * 0.22 + ((entry.id || 1) % 7) * 0.035, 0.76, 1.34);
  const h = Math.round(clamp(46 * heightFactor * weightFactor, 30, 118));
  return {
    w: Math.round(clamp(h * aspect, 30, 128)),
    h,
  };
}

function spawnBall() {
  state.balls.push({
    x: W + 32,
    y: rand(126, H - 88),
    r: 16,
    spin: 0,
  });
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function playerHitbox(player) {
  const verticalActionScale = ["up", "down"].includes(player.direction) ? 0.5 : 1;
  const scale = (player.collisionScale || 1) * verticalActionScale;
  const width = MIMI_HITBOX_W * scale;
  const height = MIMI_HITBOX_H * scale;
  return {
    x: player.x + player.w / 2 - width / 2,
    y: player.y + player.h / 2 - height / 2,
    w: width,
    h: height,
  };
}

function maybeTriggerTeamShield(playerHits) {
  if (state.mode !== "triple" || state.players.length < 3 || state.score < state.teamShieldReadyScore) return false;
  if (playerHits.length === 0) return false;
  if (state.teamCollisionUntil <= 0) {
    state.teamCollisionPlayers.clear();
    state.teamCollisionUntil = 0.5;
  }
  for (const hit of playerHits) {
    state.teamCollisionPlayers.add(hit.player.id);
  }
  const allPlayersHit = state.players.every((player) => state.teamCollisionPlayers.has(player.id));
  if (!allPlayersHit) return false;

  state.invincible = Math.max(state.invincible, 3);
  state.teamShield = 3;
  state.teamCollisionUntil = 0;
  state.teamCollisionPlayers.clear();
  state.teamShieldReadyScore += 100;
  while (state.teamShieldReadyScore <= state.score) {
    state.teamShieldReadyScore += 100;
  }
  for (const player of state.players) {
    burst(player.x + player.w / 2, player.y + player.h / 2, "#76f7d0");
    burst(player.x + player.w / 2, player.y + player.h / 2, "#f4d35e");
  }
  return true;
}

function checkCollisions() {
  const playerHitboxes = state.players.map((player) => ({
    player,
    hitbox: playerHitbox(player),
  }));

  const playerHits = [];
  for (const monster of state.monsters) {
    const monsterHitbox = { x: monster.x + 6, y: monster.y + 8, w: monster.w - 12, h: monster.h - 10 };
    for (const playerHitboxEntry of playerHitboxes) {
      if (rectsOverlap(playerHitboxEntry.hitbox, monsterHitbox)) {
        playerHits.push(playerHitboxEntry);
      }
    }
  }

  if (maybeTriggerTeamShield(playerHits)) return;

  if (state.invincible <= 0) {
    const hit = playerHits[0];
    if (hit) {
      state.hp -= 1;
      state.invincible = 1.1;
      burst(hit.player.x + hit.player.w / 2, hit.player.y + 24, "#d83d4b");
      if (state.hp <= 0) {
        state.hp = 0;
        updateHud();
        gameOver();
      }
    }
  }

  for (const ball of state.balls) {
    const ballHitbox = { x: ball.x - ball.r, y: ball.y - ball.r, w: ball.r * 2, h: ball.r * 2 };
    if (!ball.collected && playerHitboxes.some(({ hitbox }) => rectsOverlap(hitbox, ballHitbox))) {
      ball.collected = true;
      state.hp = Math.min(state.maxHp, state.hp + 1);
      burst(ball.x, ball.y, "#f4d35e");
    }
  }
}

function burst(x, y, color) {
  for (let i = 0; i < 12; i += 1) {
    state.particles.push({
      x,
      y,
      vx: rand(-100, 100),
      vy: rand(-120, 70),
      life: rand(0.25, 0.55),
      color,
    });
  }
}

function updateHud() {
  heartsEl.innerHTML = "";
  const maxHp = state.maxHp || MAX_HP;
  for (let i = 0; i < maxHp; i += 1) {
    const heart = document.createElement("span");
    heart.className = `heart${i >= state.hp ? " empty" : ""}`;
    heartsEl.appendChild(heart);
  }
  scoreEl.textContent = Math.floor(state.score);
  distanceEl.textContent = `${Math.floor(state.distance)}m`;
  const nextEntry = state.pokemonDeck?.[state.nextPokemonIndex];
  currentPokemonEl.textContent = nextEntry ? nextEntry.zhName || nextEntry.name || pokemonName(nextEntry.id) : "完成";
}

function draw() {
  drawBackground();
  drawRoad();
  drawProps();

  for (const ball of state.balls) {
    drawBall(ball);
  }
  for (const monster of state.monsters) {
    drawMonster(monster);
  }
  for (const player of state.players) {
    drawPlayer(player);
  }
  drawParticles();
}

function px(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawBackground() {
  const scroll = state ? state.distance : 0;
  const t = performance.now() / 1000;

  if (schoolBackgroundImage.complete && schoolBackgroundImage.naturalWidth > 0) {
    const scale = Math.max(W / schoolBackgroundImage.naturalWidth, H / schoolBackgroundImage.naturalHeight);
    const bgW = schoolBackgroundImage.naturalWidth * scale;
    const bgH = schoolBackgroundImage.naturalHeight * scale;
    const sway = Math.sin(t * 0.18) * 10;
    ctx.drawImage(schoolBackgroundImage, (W - bgW) / 2 + sway, (H - bgH) / 2, bgW, bgH);
  } else {
    ctx.fillStyle = "#f8f3df";
    ctx.fillRect(0, 0, W, H);
  }

  drawSchoolSkyMotion(scroll, t);
  drawSchoolYard(scroll, t);
}

function drawSchoolSkyMotion(scroll, t) {
  const sunPulse = 0.5 + Math.sin(t * 2.1) * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.28 + sunPulse * 0.18;
  px(0, 0, 114, 162, "#ffd05a");
  ctx.globalAlpha = 0.76;
  for (let i = 0; i < 8; i += 1) {
    const angle = i * (Math.PI / 4) + Math.sin(t * 0.8) * 0.08;
    const x = 66 + Math.cos(angle) * 58;
    const y = 72 + Math.sin(angle) * 58;
    px(x, y, 26, 5, "#e94c44");
  }

  ctx.globalAlpha = 0.64;
  for (let x = -260 - (scroll * 1.8) % 420; x < W + 420; x += 420) {
    drawCrayonCloud(x, 46 + Math.sin(t * 0.6 + x) * 6, "#28a9d7");
  }

  ctx.globalAlpha = 0.9;
  const planeX = W - ((scroll * 12 + t * 38) % (W + 240));
  const planeY = 116 + Math.sin(t * 1.7) * 12;
  drawPixelPlane(planeX, planeY);

  const butterflyX = 260 + Math.sin(t * 1.2) * 18;
  const butterflyY = 218 + Math.cos(t * 2.3) * 10;
  drawPixelButterfly(butterflyX, butterflyY, t);

  const stickers = [
    [430, 84, "#f5a2c4"],
    [740, 66, "#98d9ef"],
    [388, 210, "#b7d982"],
    [664, 246, "#9ad4ee"],
    [786, 202, "#f7d56c"],
  ];
  for (const [x, y, color] of stickers) {
    drawFloatingSticker(x + Math.sin(t + x) * 6, y + Math.cos(t * 0.8 + y) * 5, color);
  }
  ctx.restore();
}

function drawSchoolYard(scroll, t) {
  ctx.save();
  ctx.globalAlpha = 0.86;
  for (let i = 0; i < 5; i += 1) {
    const x = 40 + i * 72 - ((scroll * 5 + t * 18) % 360);
    const y = 274 + Math.sin(t * 4 + i) * 3;
    drawSchoolKid(x < -60 ? x + 720 : x, y, ["#d47b52", "#28a9d7", "#4aae55", "#ec8ab5", "#7e66d8"][i]);
  }

  const bell = 814 + Math.sin(t * 1.4) * 5;
  px(bell, 226, 88, 78, "rgba(236, 175, 60, 0.34)");
  px(bell + 12, 244, 64, 12, "rgba(236, 175, 60, 0.62)");
  px(bell + 12, 264, 64, 12, "rgba(236, 175, 60, 0.54)");
  px(bell + 12, 284, 64, 12, "rgba(236, 175, 60, 0.48)");
  ctx.restore();
}

function drawCrayonCloud(x, y, color) {
  px(x, y + 12, 112, 22, color);
  px(x + 32, y, 84, 34, color);
  px(x + 110, y + 8, 104, 28, color);
  px(x + 198, y + 12, 92, 22, color);
  px(x + 16, y + 34, 252, 6, "rgba(255, 255, 255, 0.42)");
}

function drawPixelPlane(x, y) {
  px(x, y, 78, 10, "#bd2f35");
  px(x + 58, y - 18, 10, 46, "#bd2f35");
  px(x + 24, y - 22, 12, 24, "#bd2f35");
  px(x + 8, y + 4, 34, 6, "#fff7e8");
  px(x - 14, y + 4, 18, 4, "rgba(255, 255, 255, 0.7)");
}

function drawPixelButterfly(x, y, t) {
  const flap = Math.sin(t * 8) * 5;
  px(x - 18, y - 8 - flap, 18, 22, "#ee6ea6");
  px(x + 4, y - 8 + flap, 18, 22, "#ee6ea6");
  px(x - 2, y - 2, 6, 26, "#bd3d77");
  px(x - 24, y + 10, 10, 6, "#f8b5d1");
  px(x + 18, y + 10, 10, 6, "#f8b5d1");
}

function drawFloatingSticker(x, y, color) {
  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
  ctx.arc(Math.round(x), Math.round(y), 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - 10), Math.round(y - 8), 20, 16);
  px(x - 5, y - 3, 4, 4, "#46372e");
  px(x + 5, y - 3, 4, 4, "#46372e");
  px(x - 4, y + 6, 12, 3, "#fff7e8");
}

function drawSchoolKid(x, y, color) {
  px(x + 16, y, 16, 16, "#ffe0b8");
  px(x + 12, y + 16, 26, 36, color);
  px(x + 8, y + 22, 10, 22, color);
  px(x + 34, y + 22, 10, 22, color);
  px(x + 16, y + 50, 8, 26, "#4166b1");
  px(x + 30, y + 50, 8, 26, "#4166b1");
  px(x + 10, y + 72, 16, 6, "#ffffff");
  px(x + 28, y + 72, 16, 6, "#ffffff");
}

function drawCloud(x, y) {
  px(x, y + 14, 86, 18, "#f4fbf5");
  px(x + 16, y, 32, 28, "#f4fbf5");
  px(x + 48, y + 6, 28, 24, "#f4fbf5");
  if (x < -120) drawCloud(x + 1120, y);
}

function drawMountain(x, base, width, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, base + 78);
  ctx.lineTo(x + width * 0.45, base - 46);
  ctx.lineTo(x + width, base + 78);
  ctx.closePath();
  ctx.fill();
  px(x + width * 0.42, base - 34, 28, 18, "#eef2dc");
  if (x < -width) drawMountain(x + 1180, base, width, color);
}

function drawRoad() {
  const scroll = state ? state.distance : 0;
  px(0, 304, W, 236, "rgba(174, 126, 84, 0.78)");
  px(0, 304, W, 16, "rgba(95, 142, 79, 0.72)");
  px(0, 320, W, 18, "rgba(230, 199, 125, 0.82)");
  for (let x = -90 - (scroll * 10) % 128; x < W + 128; x += 128) {
    px(x, 430, 76, 12, "rgba(233, 202, 128, 0.86)");
    px(x + 22, 372, 42, 10, "rgba(221, 123, 91, 0.62)");
  }
}

function drawProps() {
  const scroll = state ? state.distance : 0;
  for (let x = -40 - (scroll * 6) % 96; x < W + 96; x += 96) {
    px(x, 300, 10, 22, "rgba(56, 93, 56, 0.72)");
    px(x + 6, 292, 18, 16, "rgba(88, 131, 75, 0.72)");
    px(x + 32, 316, 8, 16, "rgba(56, 93, 56, 0.72)");
    px(x + 38, 310, 20, 14, "rgba(100, 142, 79, 0.72)");
  }
}

function drawPlayer(p) {
  if (state.teamShield <= 0 && state.invincible > 0 && Math.floor(state.invincible * 16) % 2 === 0) return;
  const bob = p.direction === "up" ? 0 : Math.sin(p.step) * 2;
  const x = p.x;
  const y = p.y + bob;

  if (state.teamShield > 0) {
    drawTeamShield(p, x, y);
  }

  if (isPlayerPoseReady(p, p.direction)) {
    drawPlayerPose(p, x, y);
    if (state.teamShield > 0) {
      drawTeamShieldSparkles(p, x, y);
    }
    return;
  }
  px(x + 12, y, 22, 14, "#1f1c1a");
  px(x + 8, y + 10, 30, 18, "#1f1c1a");
  px(x + 6, y + 42, 34, 28, "#b991dd");
  if (state.teamShield > 0) {
    drawTeamShieldSparkles(p, x, y);
  }
}

function drawTeamShield(p, x, y) {
  const pulse = 0.65 + Math.sin(performance.now() * 0.012 + p.x * 0.03) * 0.25;
  ctx.save();
  ctx.globalAlpha = 0.26 + pulse * 0.16;
  ctx.fillStyle = "#76f7d0";
  ctx.beginPath();
  ctx.ellipse(x + p.w / 2, y + p.h / 2, p.w * 0.72, p.h * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = "#f4d35e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x + p.w / 2, y + p.h / 2, p.w * 0.82, p.h * 0.64, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTeamShieldSparkles(p, x, y) {
  const t = performance.now() * 0.008;
  for (let i = 0; i < 4; i += 1) {
    const angle = t + i * Math.PI * 0.5 + p.x * 0.02;
    const sparkleX = x + p.w / 2 + Math.cos(angle) * p.w * 0.66;
    const sparkleY = y + p.h / 2 + Math.sin(angle) * p.h * 0.54;
    px(sparkleX - 2, sparkleY - 2, 4, 4, i % 2 ? "#76f7d0" : "#f4d35e");
  }
}

function drawPlayerPose(p, x, y) {
  const poses = p.poses || playerPoseImages;
  const direction = poses[p.direction] ? p.direction : "right";
  const usesVerticalAction = p.verticalActionPose && ["up", "down"].includes(direction);
  const image = poses[direction] || poses.right;
  const base = poses.right;
  const sourceHeight = p.normalizePoseHeight ? image.naturalHeight : base.naturalHeight;
  let crouchDisplayScale = 1;
  if (direction === "down" && usesVerticalAction) {
    crouchDisplayScale = p.id === "laozhang" ? 0.688 : 0.598;
  }
  const sideDisplayScale = p.id === "laozhang" && ["left", "right"].includes(direction) ? 0.8 : 1;
  const scale = (p.h * crouchDisplayScale * sideDisplayScale) / (sourceHeight || image.naturalHeight || 1);
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const drawX = x + (p.w - drawW) / 2;
  const jumpOffset = direction === "up" ? (usesVerticalAction ? -28 : -12) : 0;
  const drawY = y + p.h - drawH + jumpOffset;

  const shieldHue = Math.round((performance.now() * 0.24 + p.x) % 360);
  ctx.save();
  if (state.teamShield > 0) {
    ctx.filter = `hue-rotate(${shieldHue}deg) saturate(2.4) brightness(1.22)`;
    ctx.shadowColor = `hsl(${shieldHue}, 95%, 62%)`;
    ctx.shadowBlur = 18;
  }
  ctx.drawImage(image, drawX, drawY, drawW, drawH);
  if (state.teamShield > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.38;
    ctx.filter = `hue-rotate(${(shieldHue + 120) % 360}deg) saturate(3) brightness(1.35)`;
    ctx.drawImage(image, drawX, drawY, drawW, drawH);
  }
  ctx.restore();
}

function isPlayerPoseReady(p, direction) {
  const poses = p.poses || playerPoseImages;
  const image = poses[direction] || poses.right;
  return image.complete && image.naturalWidth > 0 && poses.right.naturalHeight > 0;
}

function drawMonster(m) {
  const x = m.x;
  const y = m.y;
  const label = m.name;
  ctx.font = "12px sans-serif";
  const labelWidth = Math.min(96, Math.max(42, ctx.measureText(label).width + 12));
  const labelX = Math.round(x + (m.w - labelWidth) / 2);
  const labelY = Math.round(y - 18);
  px(labelX - 1, labelY - 1, labelWidth + 2, 16, "rgba(45, 41, 36, 0.72)");
  px(labelX, labelY, labelWidth, 14, "rgba(255, 246, 223, 0.94)");
  ctx.fillStyle = "#16130f";
  ctx.fillText(label, labelX + 6, Math.round(y - 7));
  if (m.image.complete) {
    ctx.drawImage(m.image, x, y, m.w, m.h);
    return;
  }
  px(x, y, m.w, m.h, "#6c9f5f");
}

async function saveScore(result) {
  if (state.saved) return;
  state.saved = true;
  try {
    const response = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: state.score,
        maxScore: POKEMON_COUNT,
        distance: Math.floor(state.distance),
        hp: state.hp,
        result,
        mode: state.mode,
      }),
    });
    if (response.ok) {
      await loadScores();
    }
  } catch (error) {
    scoreHistoryEl.innerHTML = "<li>未连接本地服务，成绩未写入 SQLite</li>";
  }
}

async function loadScores() {
  try {
    const response = await fetch("/api/scores");
    if (!response.ok) return;
    const scores = await response.json();
    if (!scores.length) {
      scoreHistoryEl.innerHTML = "<li>还没有记录，玩一局看看</li>";
      return;
    }
    scoreHistoryEl.innerHTML = scores
      .map((item, index) => scoreCard(item, index))
      .join("");
  } catch (error) {
    scoreHistoryEl.innerHTML = "<li>直接打开网页可玩；启动本地服务后记录成绩</li>";
  }
}

function scoreCard(item, index) {
  const mode = ["single", "dual", "triple"].includes(item.mode) ? item.mode : "single";
  const modeText = mode === "triple" ? "三人模式" : mode === "dual" ? "双人模式" : "单人模式";
  const resultText = item.result === "win" ? "满分通关" : "冒险结束";
  return `
    <li class="score-card">
      <div class="score-cover score-cover-${mode}" aria-hidden="true">
        <img class="cover-mimi" src="image/player-right.png" alt="" />
        ${mode !== "single" ? '<img class="cover-laozhang" src="image/laozhang-right.png" alt="" />' : ""}
        ${mode === "triple" ? '<img class="cover-mama" src="image/mama-right.png" alt="" />' : ""}
      </div>
      <div class="score-rank">#${index + 1}</div>
      <div class="score-main">${item.score}/${item.max_score} 分</div>
      <div class="score-meta">${modeText} · ${resultText}</div>
      <div class="score-meta">${item.played_at}</div>
    </li>
  `;
}

function drawBall(ball) {
  const x = ball.x;
  const y = ball.y;
  px(x - 16, y - 14, 32, 14, "#d94747");
  px(x - 16, y, 32, 14, "#f8f4e8");
  px(x - 16, y - 2, 32, 5, "#222");
  px(x - 6, y - 7, 12, 12, "#f8f4e8");
  px(x - 3, y - 4, 6, 6, "#222");
}

function drawParticles() {
  for (const particle of state.particles) {
    px(particle.x, particle.y, 6, 6, particle.color);
  }
}

document.addEventListener("keydown", (event) => {
  const key = normalizeKey(event.key);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "i", "j", "k", "l"].includes(key)) {
    event.preventDefault();
    keys.add(key);
  }
  if (event.key === " " && state.status !== "playing") {
    resetGame(state.mode);
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(normalizeKey(event.key));
});

function normalizeKey(key) {
  return key.length === 1 ? key.toLowerCase() : key;
}

for (const button of touchKeys) {
  const key = button.dataset.key;

  const press = (event) => {
    event.preventDefault();
    keys.add(key);
    activeTouchKeys.add(key);
    button.classList.add("active");
    button.setPointerCapture?.(event.pointerId);
  };

  const release = (event) => {
    event.preventDefault();
    keys.delete(key);
    activeTouchKeys.delete(key);
    button.classList.remove("active");
    button.releasePointerCapture?.(event.pointerId);
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("touchstart", (event) => event.preventDefault(), { passive: false });
  button.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
  button.addEventListener("contextmenu", (event) => event.preventDefault());
}

function releaseTouchControls() {
  for (const key of activeTouchKeys) {
    keys.delete(key);
  }
  activeTouchKeys.clear();
  for (const button of touchKeys) {
    button.classList.remove("active");
  }
}

window.addEventListener("pointerup", releaseTouchControls);
window.addEventListener("pointercancel", releaseTouchControls);
window.addEventListener("blur", releaseTouchControls);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseTouchControls();
});

function showScoreHistory() {
  loadScores();
  scoreboard.scrollIntoView({ behavior: "smooth", block: "center" });
  scoreboard.classList.remove("flash");
  void scoreboard.offsetWidth;
  scoreboard.classList.add("flash");
}

restartButton.addEventListener("click", () => {
  ensurePokedex().then(hydratePokemonDeck);
  resetGame(state.mode);
});
for (const button of modeButtons) {
  button.addEventListener("click", () => {
    if (button.dataset.action === "history") {
      showScoreHistory();
      return;
    }
    ensurePokedex().then(hydratePokemonDeck);
    resetGame(button.dataset.mode || "single");
  });
}

restartButton.classList.add("hidden-control");

state = {
  status: "ready",
  mode: "single",
  maxHp: MAX_HP,
  hp: MAX_HP,
  score: 0,
  distance: 0,
  speed: 0,
  invincible: 0,
  teamShield: 0,
  teamShieldReadyScore: 100,
  teamCollisionUntil: 0,
  teamCollisionPlayers: new Set(),
  nextPokemonIndex: 0,
  pokemonDeck: [],
  saved: false,
  players: createPlayers("single"),
  monsters: [],
  balls: [],
  particles: [],
};
state.player = state.players[0];
updateHud();
Promise.all([loadScores(), ensurePokedex(), playerImagesReady]).finally(() => {
  if (state.status === "ready") {
    state.pokemonDeck = createPokemonDeck();
    updateHud();
  }
  draw();
});
