import { Module, type DynamicModule } from "@nestjs/common";
import { AdminController, AdminMetricsController } from "./admin/admin.controller.js";
import { AlertsController, HelperAlertsController } from "./alerts/alerts.controller.js";
import { AnonController } from "./anon/anon.controller.js";
import type { Env } from "./config/env.js";
import {
  ConversationsController,
  HelperConversationsController,
} from "./conversations/conversations.controller.js";
import { CoreModule } from "./core.module.js";
import { HealthController } from "./health.controller.js";
import { HelpersController } from "./helpers/helpers.controller.js";
import {
  HelperSettingsController,
  TelegramWebhookController,
} from "./helpers/helper-settings.controller.js";
import { PushController } from "./notifications/push.controller.js";
import { ChatGateway } from "./realtime/chat.gateway.js";

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [CoreModule.forRoot(env)],
      controllers: [
        HealthController,
        AnonController,
        AlertsController,
        HelperAlertsController,
        HelpersController,
        HelperSettingsController,
        TelegramWebhookController,
        AdminMetricsController,
        AdminController,
        ConversationsController,
        HelperConversationsController,
        PushController,
      ],
      providers: [ChatGateway],
    };
  }
}
