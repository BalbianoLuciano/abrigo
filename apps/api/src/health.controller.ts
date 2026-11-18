import type { DbHandle } from "@abrigo/db";
import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import type { Redis } from "ioredis";
import { DB_HANDLE, REDIS } from "./infra/tokens.js";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(DB_HANDLE) private readonly db: DbHandle,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    try {
      await this.db.pool.query("SELECT 1");
      await this.redis.ping();
      return { ok: true };
    } catch {
      throw new ServiceUnavailableException({ ok: false });
    }
  }
}
