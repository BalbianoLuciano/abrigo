import { Inject, Injectable } from "@nestjs/common";
import type { Env } from "../config/env.js";
import { jobIds, type Queues } from "../infra/queues.js";
import { ENV, QUEUES } from "../infra/tokens.js";

/** Programa y cancela los jobs con demora del ciclo de vida de una alerta. */
@Injectable()
export class AlertTimersService {
  constructor(
    @Inject(QUEUES) private readonly queues: Queues,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async scheduleExpiry(alertId: string, round: number) {
    await this.queues.alertTimers.add(
      "alert-expiry",
      { kind: "alert-expiry", alertId },
      { delay: this.env.ALERT_EXPIRY_MS, jobId: `${jobIds.alertExpiry(alertId)}_${round}` },
    );
  }

  async scheduleClaimTimeout(alertId: string, claimId: string) {
    await this.queues.alertTimers.add(
      "claim-timeout",
      { kind: "claim-timeout", alertId, claimId },
      { delay: this.env.CLAIM_TIMEOUT_MS, jobId: jobIds.claimTimeout(claimId) },
    );
  }

  async cancelClaimTimeout(claimId: string) {
    await this.queues.alertTimers.remove(jobIds.claimTimeout(claimId));
  }

  async scheduleInactivityCheck(
    conversationId: string,
    delayMs = this.env.CONVERSATION_INACTIVITY_MS,
  ) {
    const at = Date.now() + delayMs;
    await this.queues.alertTimers.add(
      "conversation-inactivity",
      { kind: "conversation-inactivity", conversationId },
      { delay: delayMs, jobId: jobIds.inactivity(conversationId, at) },
    );
  }

  /** Los handlers verifican el estado al dispararse; esto solo evita trabajo inútil. */
  async cancelForAlert(alertId: string) {
    const jobs = await this.queues.alertTimers.getDelayed();
    await Promise.all(
      jobs
        .filter((j) => "alertId" in j.data && j.data.alertId === alertId)
        .map((j) => j.remove().catch(() => undefined)),
    );
  }

  async enqueueFanout(alertId: string, round: number) {
    await this.queues.notifications.add(
      "alert-fanout",
      { kind: "alert-fanout", alertId },
      { jobId: `${jobIds.fanout(alertId)}_${round}` },
    );
  }
}
