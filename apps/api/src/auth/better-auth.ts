import {
  authAccounts,
  authSessions,
  authTwoFactors,
  authUsers,
  authVerifications,
  type Database,
} from "@abrigo/db";
import { hash, verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, twoFactor } from "better-auth/plugins";
import type { Env } from "../config/env.js";

/** Parámetros Argon2id recomendados por OWASP (m=19 MiB, t=2, p=1). */
const ARGON2 = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function createAuth(db: Database, env: Env) {
  return betterAuth({
    appName: "Abrigo",
    baseURL: env.API_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.PUBLIC_APP_URL],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
        twoFactor: authTwoFactors,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      password: {
        hash: (password) => hash(password, ARGON2),
        verify: ({ hash: digest, password }) => verify(digest, password),
      },
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, input: false, defaultValue: "helper_pending" },
      },
    },
    // Sesiones cortas con renovación (01-arquitectura.md · Identidad).
    session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60 },
    rateLimit: { enabled: env.NODE_ENV !== "test", storage: "memory" },
    advanced: {
      useSecureCookies: env.NODE_ENV === "production",
      database: { generateId: () => crypto.randomUUID() },
    },
    telemetry: { enabled: false },
    plugins: [twoFactor({ issuer: "Abrigo" }), bearer()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
