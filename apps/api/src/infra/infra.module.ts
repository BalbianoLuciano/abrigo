import { createDb, type DbHandle } from "@abrigo/db";
import { Global, Inject, Module, type OnApplicationShutdown, type Provider } from "@nestjs/common";
import { Redis } from "ioredis";
import type { Env } from "../config/env.js";
import { createQueues, type Queues } from "./queues.js";
import { DB, DB_HANDLE, ENV, QUEUES, REDIS } from "./tokens.js";

export function infraProviders(env: Env): Provider[] {
  return [
    { provide: ENV, useValue: env },
    { provide: DB_HANDLE, useFactory: () => createDb(env.DATABASE_URL) },
    { provide: DB, useFactory: (h: DbHandle) => h.db, inject: [DB_HANDLE] },
    {
      provide: REDIS,
      useFactory: () =>
        new Redis(env.REDIS_URL, {
          // BullMQ exige reintentos ilimitados en la conexión compartida.
          maxRetriesPerRequest: null,
          ...(env.REDIS_CA_CERT ? { tls: { ca: env.REDIS_CA_CERT } } : {}),
        }),
    },
    { provide: QUEUES, useFactory: (redis: Redis) => createQueues(redis), inject: [REDIS] },
  ];
}

@Global()
@Module({})
export class InfraModule implements OnApplicationShutdown {
  constructor(
    @Inject(DB_HANDLE) private readonly handle: DbHandle,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(QUEUES) private readonly queues: Queues,
  ) {}

  static forRoot(env: Env) {
    const providers = infraProviders(env);
    return {
      module: InfraModule,
      providers,
      exports: [ENV, DB, DB_HANDLE, REDIS, QUEUES],
    };
  }

  async onApplicationShutdown() {
    await this.queues.close();
    await this.handle.close();
    this.redis.disconnect();
  }
}
