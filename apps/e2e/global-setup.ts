import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { API_URL, startStack, WEB_DIST } from "./stack.js";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

export default async function globalSetup() {
  // La PWA se exporta apuntando a la API de esta corrida.
  execFileSync("npx", ["expo", "export", "-p", "web", "--output-dir", WEB_DIST], {
    cwd: resolve(ROOT, "apps/mobile"),
    env: { ...process.env, EXPO_PUBLIC_API_URL: API_URL },
    stdio: "ignore",
  });
  const stack = await startStack();
  process.env.E2E_DATABASE_URL = stack.databaseUrl;
  return async () => stack.stop();
}
