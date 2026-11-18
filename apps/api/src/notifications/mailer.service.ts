import { Inject, Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import type { Env } from "../config/env.js";
import { ENV } from "../infra/tokens.js";

/** Email por SMTP (Resend y AWS SES exponen SMTP; en local, Mailpit). */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transport: Transporter | null;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;
  }

  async send(to: string, subject: string, text: string): Promise<boolean> {
    if (!this.transport) {
      this.logger.debug("SMTP no configurado: email omitido");
      return false;
    }
    await this.transport.sendMail({ from: this.env.EMAIL_FROM, to, subject, text });
    return true;
  }
}
