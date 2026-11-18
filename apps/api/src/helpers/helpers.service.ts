import {
  authUsers,
  helperAvailability,
  helpers,
  verificationRequests,
  type Database,
} from "@abrigo/db";
import type { AlertPath, HelperRegistrationInput } from "@abrigo/shared";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq, sql } from "@abrigo/db";
import { AuditService } from "../audit/audit.service.js";
import type { Auth } from "../auth/better-auth.js";
import { AbuseService } from "../common/abuse.service.js";
import type { Env } from "../config/env.js";
import { AUTH, DB, ENV } from "../infra/tokens.js";
import { RealtimeService } from "../realtime/realtime.service.js";

@Injectable()
export class HelpersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(AbuseService) private readonly abuse: AbuseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  async register(input: HelperRegistrationInput, ip: string) {
    await this.abuse.verifyCaptcha(input.captchaToken, ip);
    await this.abuse.consume(
      `register:${await this.abuse.hashIp(ip)}`,
      this.env.MAX_REGISTRATIONS_PER_IP_24H,
      "Demasiados registros desde esta conexión",
    );

    const [existing] = await this.db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.email, input.email.toLowerCase()))
      .limit(1);
    if (existing) {
      throw new ConflictException({
        message: "Ya hay una cuenta con ese email",
        code: "email_taken",
      });
    }

    const created = await this.auth.api.signUpEmail({
      body: {
        email: input.email,
        password: input.password,
        name: `${input.firstName} ${input.lastName}`,
      },
    });
    const userId = created.user.id;

    try {
      const helperId = await this.db.transaction(async (tx) => {
        const [helper] = await tx
          .insert(helpers)
          .values({
            userId,
            firstName: input.firstName,
            lastName: input.lastName,
            gender: input.gender ?? null,
            profession: input.profession,
            licenseNumber: input.licenseNumber ?? null,
            licenseJurisdiction: input.licenseJurisdiction ?? null,
            organization: input.organization ?? null,
            specialties: input.specialties,
            languages: input.languages,
            bioShort: input.bioShort ?? null,
            acceptsRemoteAnywhere: input.acceptsRemoteAnywhere,
            codeOfConductAcceptedAt: new Date(),
            coverage: input.coverage
              ? sql`ST_Buffer(ST_SetSRID(ST_MakePoint(${input.coverage.lng}, ${input.coverage.lat}), 4326)::geography, ${input.coverage.radiusKm * 1000})::geography(Polygon, 4326)`
              : null,
          })
          .returning({ id: helpers.id });
        await tx.insert(helperAvailability).values({ helperId: helper!.id });
        await tx.insert(verificationRequests).values({ helperId: helper!.id });
        await this.audit.record(
          {
            actorType: "helper",
            actorId: helper!.id,
            action: "helper.registered",
            targetType: "helper",
            targetId: helper!.id,
          },
          tx,
        );
        return helper!.id;
      });
      return { helperId, status: "pending" as const };
    } catch (err) {
      // Si falla el alta del perfil, no dejamos una cuenta huérfana.
      await this.db.delete(authUsers).where(eq(authUsers.id, userId));
      throw err;
    }
  }

  async me(userId: string) {
    const [row] = await this.db
      .select({
        helperId: helpers.id,
        firstName: helpers.firstName,
        lastName: helpers.lastName,
        profession: helpers.profession,
        specialties: helpers.specialties,
        gender: helpers.gender,
        status: helpers.status,
        maxConcurrent: helpers.maxConcurrent,
        isOnCall: helperAvailability.isOnCall,
        pausedUntil: helperAvailability.pausedUntil,
        email: authUsers.email,
        role: authUsers.role,
        twoFactorEnabled: authUsers.twoFactorEnabled,
      })
      .from(authUsers)
      .leftJoin(helpers, eq(helpers.userId, authUsers.id))
      .leftJoin(helperAvailability, eq(helperAvailability.helperId, helpers.id))
      .where(eq(authUsers.id, userId))
      .limit(1);
    if (!row) throw new NotFoundException();
    return { ...row, pausedUntil: row.pausedUntil?.toISOString() ?? null };
  }

  async profileForClaims(
    helperId: string,
  ): Promise<{ id: string; specialties: AlertPath[]; gender: string | null }> {
    const [row] = await this.db
      .select({ id: helpers.id, specialties: helpers.specialties, gender: helpers.gender })
      .from(helpers)
      .where(eq(helpers.id, helperId))
      .limit(1);
    if (!row) throw new NotFoundException();
    return row;
  }

  async setAvailability(
    helperId: string,
    isOnCall: boolean,
    pausedUntil: string | null | undefined,
  ) {
    const values = {
      isOnCall,
      onCallSince: isOnCall ? new Date() : null,
      pausedUntil: pausedUntil ? new Date(pausedUntil) : null,
    };
    await this.db
      .insert(helperAvailability)
      .values({ helperId, ...values })
      .onConflictDoUpdate({ target: helperAvailability.helperId, set: values });
    await this.audit.record({
      actorType: "helper",
      actorId: helperId,
      action: isOnCall ? "helper.on_call" : "helper.off_call",
      targetType: "helper",
      targetId: helperId,
    });
    this.realtime.alertListChanged();
    return values;
  }
}
