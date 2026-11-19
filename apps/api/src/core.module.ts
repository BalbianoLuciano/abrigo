import type { Database } from "@abrigo/db";
import { Module, type DynamicModule } from "@nestjs/common";
import { AdminService } from "./admin/admin.service.js";
import { AlertTimersService } from "./alerts/alert-timers.service.js";
import { AlertsService } from "./alerts/alerts.service.js";
import { LifecycleService } from "./alerts/lifecycle.service.js";
import { AnonService } from "./anon/anon.service.js";
import { AuditService } from "./audit/audit.service.js";
import { createAuth } from "./auth/better-auth.js";
import { AnonGuard, AnyPrincipalGuard, StaffGuard, StaffSessionResolver } from "./auth/guards.js";
import { AbuseService } from "./common/abuse.service.js";
import type { Env } from "./config/env.js";
import { ConversationsService } from "./conversations/conversations.service.js";
import { createKeyRing, type KeyRing } from "./crypto/key-ring.js";
import { MessageCipher } from "./crypto/message-cipher.js";
import { HelpersService } from "./helpers/helpers.service.js";
import { HelperSettingsService } from "./helpers/helper-settings.service.js";
import { MetricsService } from "./admin/metrics.service.js";
import { InfraModule } from "./infra/infra.module.js";
import { AUTH, DB, ENV, KEY_RING } from "./infra/tokens.js";
import { EscalationService } from "./alerts/escalation.service.js";
import { FanoutService } from "./notifications/fanout.service.js";
import { TelegramService } from "./notifications/telegram.service.js";
import { MailerService } from "./notifications/mailer.service.js";
import { PushService } from "./notifications/push.service.js";
import { RealtimeService } from "./realtime/realtime.service.js";

const services = [
  AuditService,
  AbuseService,
  RealtimeService,
  AlertTimersService,
  LifecycleService,
  AlertsService,
  AnonService,
  ConversationsService,
  HelpersService,
  HelperSettingsService,
  MetricsService,
  AdminService,
  PushService,
  MailerService,
  TelegramService,
  FanoutService,
  EscalationService,
  StaffSessionResolver,
  StaffGuard,
  AnonGuard,
  AnyPrincipalGuard,
];

/** Servicios de dominio compartidos por la API y el worker. */
@Module({})
export class CoreModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: CoreModule,
      global: true,
      imports: [InfraModule.forRoot(env)],
      providers: [
        ...services,
        {
          provide: AUTH,
          useFactory: (db: Database, e: Env) => createAuth(db, e),
          inject: [DB, ENV],
        },
        { provide: KEY_RING, useFactory: (e: Env) => createKeyRing(e), inject: [ENV] },
        {
          provide: MessageCipher,
          useFactory: (k: KeyRing) => new MessageCipher(k),
          inject: [KEY_RING],
        },
      ],
      exports: [...services, AUTH, KEY_RING, MessageCipher, InfraModule],
    };
  }
}
