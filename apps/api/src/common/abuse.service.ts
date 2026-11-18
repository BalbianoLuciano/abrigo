import { createHash, randomBytes } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import type { Redis } from "ioredis";
import type { Env } from "../config/env.js";
import { ENV, REDIS } from "../infra/tokens.js";

const DAY_S = 24 * 60 * 60;

/**
 * Antiabuso: límites en Redis y captcha invisible (Turnstile).
 * La IP solo se usa como hash con sal diaria; ni la IP ni el hash viven más de 24 h.
 */
@Injectable()
export class AbuseService {
  private readonly logger = new Logger(AbuseService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async hashIp(ip: string): Promise<string> {
    const day = new Date().toISOString().slice(0, 10);
    const key = `abuse:salt:${day}`;
    await this.redis.set(key, randomBytes(32).toString("hex"), "EX", DAY_S, "NX");
    const salt = (await this.redis.get(key)) ?? "";
    return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
  }

  /** Ventana fija de 24 h. Lanza 429 si se supera el máximo. */
  async consume(bucket: string, max: number, message: string): Promise<void> {
    const key = `abuse:limit:${bucket}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, DAY_S);
    if (count > max) {
      throw new HttpException({ message, code: "rate_limited" }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async verifyCaptcha(token: string | undefined, ip: string): Promise<void> {
    const secret = this.env.TURNSTILE_SECRET_KEY;
    if (!secret) return; // dev/test sin captcha (en producción es obligatorio, ver env.ts)
    if (!token) throw new HttpException({ message: "Falta el captcha", code: "captcha" }, 400);
    const body = new URLSearchParams({ secret, response: token, remoteip: ip });
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(5000),
      });
      const data = (await res.json()) as { success?: boolean };
      if (data.success) return;
    } catch (err) {
      // Si Cloudflare no responde, no dejamos a nadie sin poder pedir ayuda:
      // los límites por sesión e IP siguen activos.
      this.logger.warn(`Turnstile no disponible: ${(err as Error).name}`);
      return;
    }
    throw new HttpException({ message: "No pudimos verificar el envío", code: "captcha" }, 400);
  }
}
