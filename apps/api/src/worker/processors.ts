import { alertClaims, conversations, type Database } from "@abrigo/db";
import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import { eq } from "@abrigo/db";
import type { Redis } from "ioredis";
import { EscalationService } from "../alerts/escalation.service.js";
import { LifecycleService } from "../alerts/lifecycle.service.js";
import type { Env } from "../config/env.js";
import { ConversationsService } from "../conversations/conversations.service.js";
import { QUEUE_NAMES, type AlertTimerJob, type NotificationJob } from "../infra/queues.js";
import { DB, ENV, REDIS } from "../infra/tokens.js";
import { FanoutService } from "../notifications/fanout.service.js";

/** Consumidores BullMQ: tiempos del ciclo de vida y avisos a ayudantes. */
@Injectable()
export class Processors implements OnModuleDestroy {
  private readonly logger = new Logger(Processors.name);
  private workers: Worker[] = [];
  private connections: Redis[] = [];

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Database,
    @Inject(LifecycleService) private readonly lifecycle: LifecycleService,
    @Inject(ConversationsService) private readonly conversations: ConversationsService,
    @Inject(FanoutService) private readonly fanout: FanoutService,
    @Inject(EscalationService) private readonly escalation: EscalationService,
  ) {}

  start() {
    const connection = this.redis.duplicate();
    const notificationsConnection = this.redis.duplicate();
    this.connections = [connection, notificationsConnection];
    this.workers = [
      new Worker<AlertTimerJob>(QUEUE_NAMES.alertTimers, (job) => this.onTimer(job), {
        connection,
        concurrency: 10,
      }),
      new Worker<NotificationJob>(QUEUE_NAMES.notifications, (job) => this.onNotification(job), {
        connection: notificationsConnection,
        concurrency: 5,
      }),
    ];
    for (const w of this.workers) {
      w.on("failed", (job, err) => this.logger.error(`Job ${job?.name} falló: ${err.message}`));
    }
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((w) => w.close()));
    for (const c of this.connections) c.disconnect();
  }

  async onTimer(job: Job<AlertTimerJob>) {
    const data = job.data;
    switch (data.kind) {
      case "claim-timeout": {
        const [conv] = await this.db
          .select({ id: conversations.id, firstMessageAt: alertClaims.firstMessageAt })
          .from(conversations)
          .innerJoin(alertClaims, eq(alertClaims.id, conversations.claimId))
          .where(eq(conversations.claimId, data.claimId))
          .limit(1);
        if (conv && !conv.firstMessageAt) {
          await this.lifecycle.releaseAndReopen(conv.id, "no_first_message", "system");
        }
        return;
      }
      case "alert-expiry":
        await this.lifecycle.closeOpenAlert(data.alertId, "no_response");
        return;
      case "alert-escalate":
        await this.escalation.escalate(data.alertId, data.round, data.level);
        return;
      case "conversation-inactivity":
        await this.conversations.checkInactivity(
          data.conversationId,
          this.env.CONVERSATION_INACTIVITY_MS,
        );
        return;
    }
  }

  async onNotification(job: Job<NotificationJob>) {
    if (job.data.kind === "alert-fanout")
      await this.fanout.fanout(job.data.alertId, job.data.level);
  }
}
