import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startTestDatabase } from "@abrigo/db/testing";
import { RedisContainer } from "@testcontainers/redis";

export const API_PORT = 3999;
export const WEB_PORT = 8199;
export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
export const WEB_DIST = join(ROOT, "apps/mobile/dist-e2e");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".css": "text/css",
};

/** Servidor estático con fallback a index.html (SPA). */
function serveStatic(dir: string, port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    let file = join(dir, path);
    if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) {
      file = join(dir, "index.html");
    }
    res.setHeader("content-type", TYPES[extname(file)] ?? "application/octet-stream");
    createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv, cwd = ROOT): ChildProcess {
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "inherit", "inherit"],
  });
  return child;
}

async function waitForHealth(url: string, timeoutMs = 60_000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // todavía no levantó
    }
    if (Date.now() - start > timeoutMs) throw new Error(`No respondió ${url}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

export async function startStack() {
  const [{ container: pg, url }, redis] = await Promise.all([
    startTestDatabase(),
    new RedisContainer("redis:7-alpine").start(),
  ]);
  const env = {
    NODE_ENV: "test",
    PORT: String(API_PORT),
    DATABASE_URL: url,
    REDIS_URL: redis.getConnectionUrl(),
    PUBLIC_APP_URL: WEB_URL,
    API_URL,
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    MESSAGE_KEYS: `1:${randomBytes(32).toString("base64")}`,
    MAX_ALERTS_PER_IP_24H: "1000",
    MAX_REGISTRATIONS_PER_IP_24H: "1000",
  };
  const api = run("node", ["apps/api/dist/main.js"], env);
  const worker = run("node", ["apps/api/dist/worker.js"], env);
  await waitForHealth(`${API_URL}/health`);
  const web = await serveStatic(WEB_DIST, WEB_PORT);
  return {
    databaseUrl: url,
    async stop() {
      api.kill("SIGTERM");
      worker.kill("SIGTERM");
      web.close();
      await Promise.all([pg.stop(), redis.stop()]);
    },
  };
}
