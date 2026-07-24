const { createServer } = require("node:http");
const { readFileSync, existsSync, mkdirSync } = require("node:fs");
const { extname, join, normalize } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;
const DATA_DIR = join(ROOT, "data");
const DB_PATH = join(DATA_DIR, "scores.db");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR);
}

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    distance INTEGER NOT NULL,
    hp INTEGER NOT NULL,
    result TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'single',
    played_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

try {
  db.exec("ALTER TABLE scores ADD COLUMN mode TEXT NOT NULL DEFAULT 'single';");
} catch (error) {
  // Older databases already migrated keep running normally.
}

const insertScore = db.prepare(`
  INSERT INTO scores (score, max_score, distance, hp, result, mode)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const listScores = db.prepare(`
  SELECT id, score, max_score, distance, hp, result, mode, played_at
  FROM scores
  ORDER BY score DESC, id DESC
  LIMIT 20
`);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(ROOT, requested));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch (error) {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/api/scores") {
    sendJson(res, 200, listScores.all());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/scores") {
    try {
      const payload = JSON.parse(await readBody(req));
      const score = Math.max(0, Math.min(1025, Number(payload.score) || 0));
      const maxScore = Math.max(1, Math.min(2000, Number(payload.maxScore) || 1025));
      const distance = Math.max(0, Number(payload.distance) || 0);
      const hp = Math.max(0, Math.min(30, Number(payload.hp) || 0));
      const result = payload.result === "win" ? "win" : "defeat";
      const mode = ["single", "dual", "triple"].includes(payload.mode) ? payload.mode : "single";

      insertScore.run(score, maxScore, distance, hp, result, mode);
      sendJson(res, 201, { ok: true });
    } catch (error) {
      sendJson(res, 400, { error: "Invalid score payload" });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Pixel Hisui Runner: http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});
