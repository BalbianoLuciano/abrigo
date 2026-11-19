import { createAlertSchema, type CreateAlertInput } from "@abrigo/shared";
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { AnonGuard, Roles, StaffGuard } from "../auth/guards.js";
import {
  CurrentAnon,
  CurrentStaff,
  type AnonPrincipal,
  type StaffPrincipal,
} from "../common/principal.js";
import { ZodPipe } from "../common/zod-pipe.js";
import { AlertsService } from "./alerts.service.js";
import { LifecycleService } from "./lifecycle.service.js";

@Controller("v1/alerts")
@UseGuards(AnonGuard)
export class AlertsController {
  constructor(@Inject(AlertsService) private readonly alerts: AlertsService) {}

  @Post()
  create(
    @CurrentAnon() anon: AnonPrincipal,
    @Body(new ZodPipe(createAlertSchema)) body: CreateAlertInput,
    @Headers("x-captcha-token") captcha: string | undefined,
    @Req() req: FastifyRequest,
  ) {
    return this.alerts.create(anon.sessionId, body, req.ip, captcha);
  }

  @Get("current")
  async current(@CurrentAnon() anon: AnonPrincipal) {
    return { alert: await this.alerts.current(anon.sessionId) };
  }

  @Post(":id/cancel")
  @HttpCode(204)
  async cancel(@CurrentAnon() anon: AnonPrincipal, @Param("id", ParseUUIDPipe) id: string) {
    await this.alerts.cancel(anon.sessionId, id);
  }

  @Post(":id/reassign")
  @HttpCode(204)
  async reassign(@CurrentAnon() anon: AnonPrincipal, @Param("id", ParseUUIDPipe) id: string) {
    await this.alerts.reassign(anon.sessionId, id);
  }
}

@Controller("v1/helper/alerts")
@UseGuards(StaffGuard)
@Roles("helper")
export class HelperAlertsController {
  constructor(
    @Inject(AlertsService) private readonly alerts: AlertsService,
    @Inject(LifecycleService) private readonly lifecycle: LifecycleService,
  ) {}

  @Get()
  async list(@CurrentStaff() staff: StaffPrincipal) {
    const rows = await this.alerts.listOpenFor(staff.helperId!);
    return { alerts: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
  }

  @Post(":id/claim")
  async claim(@CurrentStaff() staff: StaffPrincipal, @Param("id", ParseUUIDPipe) id: string) {
    const { conversation } = await this.lifecycle.claim(id, staff.helperId!);
    return { conversationId: conversation.id };
  }
}
