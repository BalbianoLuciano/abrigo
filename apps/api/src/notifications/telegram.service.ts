import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Env } from "../config/env.js";
import { ENV } from "../infra/tokens.js";

/** Envío por el bot de Telegram. Sin token configurado, no hace nada. */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  get enabled() {
    return Boolean(this.env.TELEGRAM_BOT_TOKEN);
  }

  linkUrl(code: string) {
    return this.env.TELEGRAM_BOT_USERNAME
      ? `https://t.me/${this.env.TELEGRAM_BOT_USERNAME}?start=${code}`
      : null;
  }

  async send(chatId: string, text: string, button?: { text: string; url: string }) {
    if (!this.env.TELEGRAM_BOT_TOKEN) return false;
    const res = await fetch(
      `${this.env.TELEGRAM_API_BASE}/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
          ...(button ? { reply_markup: { inline_keyboard: [[button]] } } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      // No se loguea el chat ni el texto.
      this.logger.warn(`Telegram respondió ${res.status}`);
      return false;
    }
    return true;
  }
}
