import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Redis } from "ioredis";
import { AppModule } from "./app.module.js";
import type { Auth } from "./auth/better-auth.js";
import { toWebHeaders } from "./common/http.js";
import type { Env } from "./config/env.js";
import { AUTH, REDIS } from "./infra/tokens.js";
import { RedisIoAdapter } from "./realtime/redis-io.adapter.js";

/** Rutas de Better Auth que no exponemos: el alta de ayudantes pasa por /v1/helpers/register. */
const BLOCKED_AUTH_PATHS = [
  /^\/api\/auth\/sign-up/,
  /^\/api\/auth\/delete-user/,
  /^\/api\/auth\/update-user/,
];

export async function createApp(env: Env): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({ trustProxy: true, bodyLimit: 64 * 1024 });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(env), adapter, {
    logger: env.NODE_ENV === "test" ? ["error", "warn"] : ["log", "error", "warn"],
  });

  app.enableCors({
    origin: env.PUBLIC_APP_URL,
    credentials: true,
    // @fastify/cors solo permite GET, HEAD y POST por defecto.
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    exposedHeaders: ["x-anon-token-rotated", "set-auth-token"],
  });
  app.useWebSocketAdapter(new RedisIoAdapter(app, app.get<Redis>(REDIS), env.PUBLIC_APP_URL));
  mountBetterAuth(app, app.get<Auth>(AUTH), env);
  app.enableShutdownHooks();
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

function mountBetterAuth(app: INestApplication, auth: Auth, env: Env) {
  const fastify = (app as NestFastifyApplication).getHttpAdapter().getInstance();
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const path = request.url.split("?")[0] ?? "";
      if (BLOCKED_AUTH_PATHS.some((re) => re.test(path))) {
        return reply.status(404).send({ message: "No disponible" });
      }
      const url = new URL(request.url, env.API_URL);
      const req = new Request(url, {
        method: request.method,
        headers: toWebHeaders(request.headers),
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== "set-cookie") reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header("set-cookie", cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });
}
