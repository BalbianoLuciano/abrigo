import { ESCALATION } from "@abrigo/shared";
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

  async enqueueFanout(alertId: string, round: number, level: number) {
    await this.queues.notifications.add(
      "alert-fanout",
      { kind: "alert-fanout", alertId, level },
      { jobId: jobIds.fanout(alertId, round, level) },
    );
  }

  /**
   * Arranca una vuelta: aviso del nivel inicial y escalados programados para
   * los siguientes, con demoras contadas desde `startedAt`.
   */
  async startRound(alert: {
    id: string;
    round: number;
    escalationLevel: number;
    roundStartedAt: Date;
  }) {
    await this.enqueueFanout(alert.id, alert.round, alert.escalationLevel);
    const elapsed = Date.now() - alert.roundStartedAt.getTime();
    for (let level = alert.escalationLevel + 1; level <= ESCALATION.maxLevel; level++) {
      const delay = Math.max(0, this.env.ESCALATION_DELAYS_MS[level - 1]! - elapsed);
      await this.queues.alertTimers.add(
        "alert-escalate",
        { kind: "alert-escalate", alertId: alert.id, round: alert.round, level },
        { delay, jobId: jobIds.escalate(alert.id, alert.round, level) },
      );
    }
    await this.scheduleExpiry(alert.id, alert.round);
  }

  /** Al tomarse la alerta, los escalados pendientes de esa vuelta ya no corren. */
  async cancelEscalation(alertId: string, round: number) {
    await Promise.all(
      Array.from({ length: ESCALATION.maxLevel }, (_, i) =>
        this.queues.alertTimers.remove(jobIds.escalate(alertId, round, i + 1)),
      ),
    );
  }
}
