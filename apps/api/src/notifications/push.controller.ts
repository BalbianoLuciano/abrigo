import { pushSubscriptionSchema } from "@abrigo/shared";
import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { AnyPrincipalGuard } from "../auth/guards.js";
import { CurrentPrincipal, type Principal } from "../common/principal.js";
import { ZodPipe } from "../common/zod-pipe.js";
import type { Env } from "../config/env.js";
import { ENV } from "../infra/tokens.js";
import { PushService } from "./push.service.js";

@Controller("v1/push")
export class PushController {
  constructor(
    @Inject(PushService) private readonly push: PushService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get("vapid-public-key")
  key() {
    return { key: this.env.VAPID_PUBLIC_KEY ?? null };
  }

  @Post("subscriptions")
  @HttpCode(204)
  @UseGuards(AnyPrincipalGuard)
  async subscribe(
    @CurrentPrincipal() who: Principal,
    @Body(new ZodPipe(pushSubscriptionSchema)) body: z.infer<typeof pushSubscriptionSchema>,
  ) {
    if (who.kind === "anon") {
      await this.push.subscribe({ kind: "anon", sessionId: who.sessionId }, body);
    } else if (who.helperId) {
      await this.push.subscribe({ kind: "helper", helperId: who.helperId }, body);
    }
  }
}
