import { closeConversationSchema, reportSchema } from "@abrigo/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AnyPrincipalGuard, Roles, StaffGuard } from "../auth/guards.js";
import {
  CurrentPrincipal,
  CurrentStaff,
  type Principal,
  type StaffPrincipal,
} from "../common/principal.js";
import { ZodPipe } from "../common/zod-pipe.js";
import { ConversationsService } from "./conversations.service.js";

const messageSchema = z.object({
  body: z.string().min(1).max(4000),
  clientId: z.string().max(64).optional(),
});

@Controller("v1/conversations")
@UseGuards(AnyPrincipalGuard)
export class ConversationsController {
  constructor(@Inject(ConversationsService) private readonly conversations: ConversationsService) {}

  @Get(":id")
  summary(@CurrentPrincipal() who: Principal, @Param("id", ParseUUIDPipe) id: string) {
    return this.conversations.summary(id, who);
  }

  @Get(":id/messages")
  async messages(@CurrentPrincipal() who: Principal, @Param("id", ParseUUIDPipe) id: string) {
    return { messages: await this.conversations.listMessages(id, who) };
  }

  /** Alternativa HTTP al evento de socket (conexiones inestables). */
  @Post(":id/messages")
  send(
    @CurrentPrincipal() who: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(messageSchema)) body: z.infer<typeof messageSchema>,
  ) {
    return this.conversations.send(id, who, body.body, body.clientId);
  }

  @Post(":id/close")
  @HttpCode(204)
  async close(
    @CurrentPrincipal() who: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(closeConversationSchema)) body: z.infer<typeof closeConversationSchema>,
  ) {
    await this.conversations.close(id, who, body.helperNote);
  }

  @Post(":id/report")
  report(
    @CurrentPrincipal() who: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(reportSchema)) body: z.infer<typeof reportSchema>,
  ) {
    return this.conversations.report(id, who, body.reason, body.details);
  }
}

@Controller("v1/helper/conversations")
@UseGuards(StaffGuard)
@Roles("helper")
export class HelperConversationsController {
  constructor(@Inject(ConversationsService) private readonly conversations: ConversationsService) {}

  @Get()
  async list(@CurrentStaff() staff: StaffPrincipal) {
    return { conversations: await this.conversations.listActiveForHelper(staff.helperId!) };
  }
}
