import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { authUsers, createDb, eq, type DbHandle } from "@abrigo/db";
import { startTestDatabase } from "@abrigo/db/testing";
import type { HelperRegistrationInput } from "@abrigo/shared";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { NestFactory } from "@nestjs/core";
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { generateSync } from "otplib";
import { io, type Socket } from "socket.io-client";
import { createApp } from "../app.js";
import { loadEnv, type Env } from "../config/env.js";
import { Processors } from "../worker/processors.js";
import { WorkerModule } from "../worker/worker.module.js";
import type { INestApplicationContext } from "@nestjs/common";

export interface Harness {
  env: Env;
  app: NestFastifyApplication;
  worker: INestApplicationContext;
  db: DbHandle;
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startHarness(
  overrides: Partial<Record<keyof Env, string>> = {},
): Promise<Harness> {
  const [{ container: pg, url }, redis] = await Promise.all([
    startTestDatabase(),
    new RedisContainer("redis:7-alpine").start(),
  ]);
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: url,
    REDIS_URL: redis.getConnectionUrl(),
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    MESSAGE_KEYS: `1:${randomBytes(32).toString("base64")}`,
    API_URL: "http://localhost:3000",
    // Todos los tests salen de la misma IP.
    MAX_ALERTS_PER_IP_24H: "1000",
    MAX_REGISTRATIONS_PER_IP_24H: "1000",
    ...overrides,
  });
  const app = await createApp(env);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = (app.getHttpServer().address() as AddressInfo).port;
  const worker = await NestFactory.createApplicationContext(WorkerModule.forRoot(env), {
    logger: ["error", "warn"],
  });
  worker.get(Processors).start();
  const db = createDb(url);
  return {
    env,
    app,
    worker,
    db,
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      await worker.close();
      await app.close();
      await db.close();
      await stopAll(pg, redis);
    },
  };
}

async function stopAll(pg: StartedPostgreSqlContainer, redis: StartedRedisContainer) {
  await Promise.all([pg.stop(), redis.stop()]);
}

export interface Res<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export async function call<T = any>(
  h: Harness,
  method: string,
  path: string,
  opts: { body?: unknown; anon?: string; bearer?: string; headers?: Record<string, string> } = {},
): Promise<Res<T>> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.anon) headers["x-anon-token"] = opts.anon;
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  const res = await fetch(`${h.baseUrl}${path}`, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body: body as T, headers: res.headers };
}

export async function newAnon(h: Harness): Promise<string> {
  const res = await call<{ token: string }>(h, "POST", "/v1/anon/session");
  return res.body.token;
}

let counter = 0;

export function registration(
  overrides: Partial<HelperRegistrationInput> = {},
): HelperRegistrationInput {
  counter++;
  return {
    email: `ayudante${counter}-${randomBytes(3).toString("hex")}@example.com`,
    password: "una-clave-bien-larga",
    firstName: "Lucía",
    lastName: `Pérez ${counter}`,
    profession: "psicologia",
    licenseNumber: `MN ${10000 + counter}`,
    licenseJurisdiction: "CABA",
    specialties: ["mental_health", "violence"],
    gender: "woman",
    languages: ["es"],
    acceptsRemoteAnywhere: true,
    acceptsCodeOfConduct: true,
    ...overrides,
  };
}

/** Inicia sesión; si tiene 2FA, completa el TOTP. Devuelve el token bearer. */
export async function signIn(h: Harness, email: string, password: string, totpSecret?: string) {
  const res = await fetch(`${h.baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { twoFactorRedirect?: boolean; token?: string };
  if (!body.twoFactorRedirect) {
    return {
      token: res.headers.get("set-auth-token") ?? body.token ?? "",
      twoFactorRedirect: false,
    };
  }
  if (!totpSecret) return { token: "", twoFactorRedirect: true };
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const verify = await fetch(`${h.baseUrl}/api/auth/two-factor/verify-totp`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ code: generateSync({ secret: totpSecret }) }),
  });
  if (!verify.ok) throw new Error(`verify-totp ${verify.status}: ${await verify.text()}`);
  return { token: verify.headers.get("set-auth-token") ?? "", twoFactorRedirect: true };
}

/** Activa TOTP para una sesión ya iniciada. Devuelve el secreto y un token nuevo. */
export async function enableTotp(h: Harness, token: string, password: string) {
  const enable = await call<{ totpURI: string }>(h, "POST", "/api/auth/two-factor/enable", {
    bearer: token,
    body: { password },
  });
  if (enable.status !== 200)
    throw new Error(`enable ${enable.status}: ${JSON.stringify(enable.body)}`);
  const secret = new URL(enable.body.totpURI).searchParams.get("secret")!;
  const verify = await call(h, "POST", "/api/auth/two-factor/verify-totp", {
    bearer: token,
    body: { code: generateSync({ secret }) },
  });
  if (verify.status !== 200)
    throw new Error(`verify ${verify.status}: ${JSON.stringify(verify.body)}`);
  return { secret, token: verify.headers.get("set-auth-token") ?? token };
}

export interface StaffAccount {
  email: string;
  password: string;
  token: string;
  totpSecret: string;
  helperId: string;
  userId: string;
}

export async function createAdmin(h: Harness): Promise<StaffAccount> {
  const reg = registration();
  const res = await call(h, "POST", "/v1/helpers/register", { body: reg });
  if (res.status !== 201)
    throw new Error(`register admin ${res.status} ${JSON.stringify(res.body)}`);
  const [user] = await h.db.db
    .update(authUsers)
    .set({ role: "admin" })
    .where(eq(authUsers.email, reg.email))
    .returning();
  const login = await signIn(h, reg.email, reg.password);
  const totp = await enableTotp(h, login.token, reg.password);
  return {
    email: reg.email,
    password: reg.password,
    token: totp.token,
    totpSecret: totp.secret,
    helperId: res.body.helperId,
    userId: user!.id,
  };
}

/** Registra, aprueba (con el admin), activa TOTP y pone de guardia a un ayudante. */
export async function createApprovedHelper(
  h: Harness,
  admin: StaffAccount,
  overrides: Partial<HelperRegistrationInput> = {},
  opts: { onCall?: boolean } = {},
): Promise<StaffAccount> {
  const reg = registration(overrides);
  const res = await call(h, "POST", "/v1/helpers/register", { body: reg });
  if (res.status !== 201) throw new Error(`register ${res.status} ${JSON.stringify(res.body)}`);
  const helperId = res.body.helperId as string;
  const decision = await call(h, "POST", `/v1/admin/helpers/${helperId}/decision`, {
    bearer: admin.token,
    body: { decision: "approve" },
  });
  if (decision.status !== 204)
    throw new Error(`approve ${decision.status} ${JSON.stringify(decision.body)}`);
  const login = await signIn(h, reg.email, reg.password);
  const totp = await enableTotp(h, login.token, reg.password);
  if (opts.onCall !== false) {
    const av = await call(h, "PATCH", "/v1/helper/availability", {
      bearer: totp.token,
      body: { isOnCall: true },
    });
    if (av.status !== 200) throw new Error(`availability ${av.status} ${JSON.stringify(av.body)}`);
  }
  const [user] = await h.db.db.select().from(authUsers).where(eq(authUsers.email, reg.email));
  return {
    email: reg.email,
    password: reg.password,
    token: totp.token,
    totpSecret: totp.secret,
    helperId,
    userId: user!.id,
  };
}

export const mentalHealthAlert = {
  path: "mental_health",
  ageConfirmed: true,
  consentAccepted: true,
  dangerNow: "no",
} as const;

export function connectSocket(h: Harness, auth: Record<string, string>): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(h.baseUrl, { auth, transports: ["websocket"], reconnection: false });
    socket.once("connect", () => {
      // Damos tiempo a que el servidor termine de unir las salas.
      setTimeout(() => resolve(socket), 150);
    });
    socket.once("connect_error", reject);
  });
}

export function nextEvent<T = any>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout esperando ${event}`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

export async function waitFor<T>(
  fn: () => Promise<T | null | undefined | false>,
  timeoutMs = 10_000,
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error("waitFor: timeout");
    await new Promise((r) => setTimeout(r, 100));
  }
}
