import type { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Redis } from "ioredis";
import type { Server, ServerOptions } from "socket.io";

/** Socket.IO con adaptador Redis: varias instancias de la API comparten salas. */
export class RedisIoAdapter extends IoAdapter {
  private pub: Redis | null = null;
  private sub: Redis | null = null;

  constructor(
    app: INestApplicationContext,
    private readonly redis: Redis,
    private readonly corsOrigin: string,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    this.pub = this.redis.duplicate();
    this.sub = this.redis.duplicate();
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigin, credentials: true },
      pingInterval: 20_000,
      pingTimeout: 20_000,
    } as ServerOptions) as Server;
    server.adapter(createAdapter(this.pub, this.sub));
    return server;
  }

  override async close(server: Server): Promise<void> {
    await super.close(server);
    this.pub?.disconnect();
    this.sub?.disconnect();
  }
}
