import {
  authSessions,
  authUsers,
  conversations,
  helperAvailability,
  helpers,
  verificationRequests,
  type Database,
} from "@abrigo/db";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "@abrigo/db";
import { LifecycleService } from "../alerts/lifecycle.service.js";
import { AuditService } from "../audit/audit.service.js";
import { DB } from "../infra/tokens.js";
import { RealtimeService } from "../realtime/realtime.service.js";

type HelperStatus = (typeof helpers.$inferSelect)["status"];

@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(LifecycleService) private readonly lifecycle: LifecycleService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  async listHelpers(status: HelperStatus) {
    const rows = await this.db
      .select({
        id: helpers.id,
        firstName: helpers.firstName,
        lastName: helpers.lastName,
        email: authUsers.email,
        profession: helpers.profession,
        licenseNumber: helpers.licenseNumber,
        licenseJurisdiction: helpers.licenseJurisdiction,
        organization: helpers.organization,
        specialties: helpers.specialties,
        gender: helpers.gender,
        bioShort: helpers.bioShort,
        status: helpers.status,
        twoFactorEnabled: authUsers.twoFactorEnabled,
        createdAt: helpers.createdAt,
      })
      .from(helpers)
      .innerJoin(authUsers, eq(authUsers.id, helpers.userId))
      .where(eq(helpers.status, status))
      .orderBy(desc(helpers.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  async decide(
    adminUserId: string,
    helperId: string,
    decision: "approve" | "reject",
    reason?: string,
  ) {
    const helper = await this.helper(helperId);
    if (helper.status !== "pending") {
      throw new ConflictException({
        message: "Esta solicitud ya fue resuelta",
        code: "not_pending",
      });
    }
    const approve = decision === "approve";
    await this.db.transaction(async (tx) => {
      await tx
        .update(helpers)
        .set({
          status: approve ? "approved" : "rejected",
          verifiedBy: approve ? adminUserId : null,
          verifiedAt: approve ? new Date() : null,
        })
        .where(eq(helpers.id, helperId));
      await tx
        .update(authUsers)
        .set({ role: approve ? "helper" : "helper_pending" })
        .where(eq(authUsers.id, helper.userId));
      await tx
        .update(verificationRequests)
        .set({
          decision,
          decisionReason: reason ?? null,
          decidedBy: adminUserId,
          decidedAt: new Date(),
        })
        .where(
          and(eq(verificationRequests.helperId, helperId), isNull(verificationRequests.decidedAt)),
        );
      await this.audit.record(
        {
          actorType: "admin",
          actorId: adminUserId,
          action: approve ? "helper.approved" : "helper.rejected",
          targetType: "helper",
          targetId: helperId,
          metadata: reason ? { reason } : {},
        },
        tx,
      );
    });
  }

  /**
   * Suspensión inmediata: rol suspendido, se revocan todas sus sesiones, se
   * desconectan sus sockets y sus conversaciones en curso vuelven a abrirse
   * para que otra persona acompañe.
   */
  async suspend(adminUserId: string, helperId: string, reason: string) {
    const helper = await this.helper(helperId);
    await this.db.transaction(async (tx) => {
      await tx.update(helpers).set({ status: "suspended" }).where(eq(helpers.id, helperId));
      await tx
        .update(authUsers)
        .set({ role: "helper_suspended" })
        .where(eq(authUsers.id, helper.userId));
      await tx
        .update(helperAvailability)
        .set({ isOnCall: false })
        .where(eq(helperAvailability.helperId, helperId));
      await tx.delete(authSessions).where(eq(authSessions.userId, helper.userId));
      await this.audit.record(
        {
          actorType: "admin",
          actorId: adminUserId,
          action: "helper.suspended",
          targetType: "helper",
          targetId: helperId,
          metadata: { reason },
        },
        tx,
      );
    });
    this.realtime.disconnectUser(helper.userId);

    const live = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.helperId, helperId), isNull(conversations.endedAt)));
    for (const conv of live) {
      await this.lifecycle.releaseAndReopen(conv.id, "helper_suspended", "system");
    }
    return { reopenedConversations: live.length };
  }

  async reactivate(adminUserId: string, helperId: string) {
    const helper = await this.helper(helperId);
    if (helper.status !== "suspended") {
      throw new ConflictException({
        message: "La cuenta no está suspendida",
        code: "not_suspended",
      });
    }
    await this.db.transaction(async (tx) => {
      await tx.update(helpers).set({ status: "approved" }).where(eq(helpers.id, helperId));
      await tx.update(authUsers).set({ role: "helper" }).where(eq(authUsers.id, helper.userId));
      await this.audit.record(
        {
          actorType: "admin",
          actorId: adminUserId,
          action: "helper.reactivated",
          targetType: "helper",
          targetId: helperId,
        },
        tx,
      );
    });
  }

  private async helper(helperId: string) {
    const [row] = await this.db.select().from(helpers).where(eq(helpers.id, helperId)).limit(1);
    if (!row) throw new NotFoundException("No encontramos a ese ayudante");
    return row;
  }
}
