import { timingSafeEqual } from "node:crypto";
import {
  coverageUpdateSchema,
  notificationPrefsSchema,
  type CoverageUpdateInput,
  type NotificationPrefsInput,
} from "@abrigo/shared";
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { Roles, StaffGuard } from "../auth/guards.js";
import { CurrentStaff, type StaffPrincipal } from "../common/principal.js";
import { ZodPipe } from "../common/zod-pipe.js";
import type { Env } from "../config/env.js";
import { ENV } from "../infra/tokens.js";
import { TelegramService } from "../notifications/telegram.service.js";
import { HelperSettingsService } from "./helper-settings.service.js";

@Controller("v1/helper")
@UseGuards(StaffGuard)
@Roles("helper")
export class HelperSettingsController {
  constructor(@Inject(HelperSettingsService) private readonly settings: HelperSettingsService) {}

  @Get("coverage")
  coverage(@CurrentStaff() staff: StaffPrincipal) {
    return this.settings.coverage(staff.helperId!);
  }

  @Put("coverage")
  setCoverage(
    @CurrentStaff() staff: StaffPrincipal,
    @Body(new ZodPipe(coverageUpdateSchema)) body: CoverageUpdateInput,
  ) {
    return this.settings.setCoverage(staff.helperId!, body);
  }

  @Get("notification-prefs")
  prefs(@CurrentStaff() staff: StaffPrincipal) {
    return this.settings.prefs(staff.helperId!);
  }

  @Put("notification-prefs")
  setPrefs(
    @CurrentStaff() staff: StaffPrincipal,
    @Body(new ZodPipe(notificationPrefsSchema)) body: NotificationPrefsInput,
  ) {
    return this.settings.setPrefs(staff.helperId!, body);
  }

  @Post("telegram/link")
  link(@CurrentStaff() staff: StaffPrincipal) {
    return this.settings.createTelegramLink(staff.helperId!);
  }

  @Delete("telegram")
  @HttpCode(204)
  async unlink(@CurrentStaff() staff: StaffPrincipal) {
    await this.settings.unlinkTelegram(staff.helperId!);
  }
}

interface TelegramUpdate {
  message?: { text?: string; chat?: { id?: number | string; type?: string } };
}

/** Webhook del bot. Telegram firma cada pedido con el secreto configurado en setWebhook. */
@Controller("v1/telegram")
export class TelegramWebhookController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(HelperSettingsService) private readonly settings: HelperSettingsService,
    @Inject(TelegramService) private readonly telegram: TelegramService,
  ) {}

  @Post("webhook")
  @HttpCode(200)
  async webhook(
    @Headers("x-telegram-bot-api-secret-token") secret: string | undefined,
    @Body() update: TelegramUpdate,
  ) {
    const expected = this.env.TELEGRAM_WEBHOOK_SECRET;
    if (
      !expected ||
      !secret ||
      secret.length !== expected.length ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
    ) {
      throw new ForbiddenException();
    }
    const text = update.message?.text?.trim() ?? "";
    const chat = update.message?.chat;
    // Solo chats privados: un grupo no debería recibir avisos.
    if (!chat?.id || chat.type !== "private") return { ok: true };
    const chatId = String(chat.id);

    const start = /^\/start(?:\s+([A-Za-z0-9_-]{8,64}))?$/.exec(text);
    if (start) {
      const linked = start[1] ? await this.settings.linkTelegramChat(start[1], chatId) : false;
      await this.telegram.send(
        chatId,
        linked
          ? "Listo: vas a recibir acá los avisos de Abrigo cuando estés de guardia. Para dejar de recibirlos, escribí /stop."
          : "Para vincular tu cuenta, abrí Abrigo → Avisos → Vincular Telegram. El código vence a los 15 minutos.",
      );
    } else if (text === "/stop") {
      await this.settings.unlinkTelegramChat(chatId);
      await this.telegram.send(chatId, "Listo, no vas a recibir más avisos por acá.");
    }
    return { ok: true };
  }
}
