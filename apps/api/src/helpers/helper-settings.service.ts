import { createHash, randomBytes } from "node:crypto";
import { helperNotificationPrefs, helpers, telegramLinkCodes, type Database } from "@abrigo/db";
import type { CoverageUpdateInput, NotificationPrefsInput } from "@abrigo/shared";
import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { and, eq, gt, isNull, sql } from "@abrigo/db";
import { AuditService } from "../audit/audit.service.js";
import { DB } from "../infra/tokens.js";
import { TelegramService } from "../notifications/telegram.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";

const LINK_CODE_TTL_MS = 15 * 60_000;
const hash = (code: string) => createHash("sha256").update(code).digest("hex");

/** Zona de cobertura, canales de aviso y vinculación con Telegram. */
@Injectable()
export class HelperSettingsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(TelegramService) private readonly telegram: TelegramService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  async coverage(helperId: string) {
    const [row] = await this.db
      .select({
        regionCodes: helpers.regionCodes,
        acceptsRemoteAnywhere: helpers.acceptsRemoteAnywhere,
        // El círculo se guarda como polígono: recuperamos centro y radio aproximado.
        lat: sql<number | null>`ST_Y(ST_Centroid(${helpers.coverage}::geometry))`,
        lng: sql<number | null>`ST_X(ST_Centroid(${helpers.coverage}::geometry))`,
        radiusKm: sql<
          number | null
        >`round((sqrt(ST_Area(${helpers.coverage}) / pi()) / 1000)::numeric, 1)::float8`,
      })
      .from(helpers)
      .where(eq(helpers.id, helperId))
      .limit(1);
    if (!row) throw new NotFoundException();
    return {
      circle:
        row.lat !== null && row.lng !== null && row.radiusKm !== null
          ? { lat: row.lat, lng: row.lng, radiusKm: row.radiusKm }
          : null,
      regionCodes: row.regionCodes,
      acceptsRemoteAnywhere: row.acceptsRemoteAnywhere,
    };
  }

  async setCoverage(helperId: string, input: CoverageUpdateInput) {
    const c = input.circle;
    await this.db
      .update(helpers)
      .set({
        coverage: c
          ? sql`ST_Buffer(ST_SetSRID(ST_MakePoint(${c.lng}, ${c.lat}), 4326)::geography, ${c.radiusKm * 1000})::geography(Polygon, 4326)`
          : null,
        regionCodes: input.regionCodes,
        acceptsRemoteAnywhere: input.acceptsRemoteAnywhere,
      })
      .where(eq(helpers.id, helperId));
    // La auditoría no guarda la ubicación del ayudante.
    await this.audit.record({
      actorType: "helper",
      actorId: helperId,
      action: "helper.coverage_updated",
      targetType: "helper",
      targetId: helperId,
      metadata: { regions: input.regionCodes.length, hasCircle: Boolean(c) },
    });
    this.realtime.alertListChanged();
    return this.coverage(helperId);
  }

  async prefs(helperId: string) {
    const [row] = await this.db
      .select()
      .from(helperNotificationPrefs)
      .where(eq(helperNotificationPrefs.helperId, helperId))
      .limit(1);
    return {
      webPush: row?.webPush ?? true,
      email: row?.email ?? true,
      telegram: row?.telegram ?? true,
      quietStartMin: row?.quietStartMin ?? null,
      quietEndMin: row?.quietEndMin ?? null,
      telegramLinked: Boolean(row?.telegramChatId),
      telegramAvailable: this.telegram.enabled,
    };
  }

  async setPrefs(helperId: string, input: NotificationPrefsInput) {
    await this.db
      .insert(helperNotificationPrefs)
      .values({ helperId, ...input })
      .onConflictDoUpdate({ target: helperNotificationPrefs.helperId, set: input });
    return this.prefs(helperId);
  }

  async createTelegramLink(helperId: string) {
    if (!this.telegram.enabled) {
      throw new ServiceUnavailableException("Telegram todavía no está disponible");
    }
    const code = randomBytes(18).toString("base64url");
    await this.db.insert(telegramLinkCodes).values({
      codeHash: hash(code),
      helperId,
      expiresAt: new Date(Date.now() + LINK_CODE_TTL_MS),
    });
    return { code, url: this.telegram.linkUrl(code), expiresInMinutes: LINK_CODE_TTL_MS / 60_000 };
  }

  async unlinkTelegram(helperId: string) {
    await this.db
      .update(helperNotificationPrefs)
      .set({ telegramChatId: null, telegramLinkedAt: null })
      .where(eq(helperNotificationPrefs.helperId, helperId));
  }

  /** "/start <código>" desde el bot. Devuelve si se vinculó. */
  async linkTelegramChat(code: string, chatId: string): Promise<boolean> {
    const [used] = await this.db
      .update(telegramLinkCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(telegramLinkCodes.codeHash, hash(code)),
          isNull(telegramLinkCodes.usedAt),
          gt(telegramLinkCodes.expiresAt, new Date()),
        ),
      )
      .returning({ helperId: telegramLinkCodes.helperId });
    if (!used) return false;
    // Un chat queda vinculado a una sola cuenta.
    await this.db
      .update(helperNotificationPrefs)
      .set({ telegramChatId: null, telegramLinkedAt: null })
      .where(eq(helperNotificationPrefs.telegramChatId, chatId));
    const values = { telegramChatId: chatId, telegramLinkedAt: new Date() };
    await this.db
      .insert(helperNotificationPrefs)
      .values({ helperId: used.helperId, ...values })
      .onConflictDoUpdate({ target: helperNotificationPrefs.helperId, set: values });
    await this.audit.record({
      actorType: "helper",
      actorId: used.helperId,
      action: "helper.telegram_linked",
      targetType: "helper",
      targetId: used.helperId,
    });
    return true;
  }

  async unlinkTelegramChat(chatId: string) {
    await this.db
      .update(helperNotificationPrefs)
      .set({ telegramChatId: null, telegramLinkedAt: null })
      .where(eq(helperNotificationPrefs.telegramChatId, chatId));
  }
}
