import { helperDecisionSchema, suspendSchema } from "@abrigo/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { Roles, StaffGuard } from "../auth/guards.js";
import { CurrentStaff, type StaffPrincipal } from "../common/principal.js";
import { ZodPipe } from "../common/zod-pipe.js";
import { AdminService } from "./admin.service.js";

const statusQuery = z.object({
  status: z.enum(["pending", "approved", "rejected", "suspended"]).default("pending"),
});

@Controller("v1/admin/helpers")
@UseGuards(StaffGuard)
@Roles("admin")
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get()
  async list(@Query(new ZodPipe(statusQuery)) q: z.infer<typeof statusQuery>) {
    return { helpers: await this.admin.listHelpers(q.status) };
  }

  @Post(":id/decision")
  @HttpCode(204)
  async decide(
    @CurrentStaff() staff: StaffPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(helperDecisionSchema)) body: z.infer<typeof helperDecisionSchema>,
  ) {
    await this.admin.decide(staff.userId, id, body.decision, body.reason);
  }

  @Post(":id/suspend")
  suspend(
    @CurrentStaff() staff: StaffPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(suspendSchema)) body: z.infer<typeof suspendSchema>,
  ) {
    return this.admin.suspend(staff.userId, id, body.reason);
  }

  @Post(":id/reactivate")
  @HttpCode(204)
  async reactivate(@CurrentStaff() staff: StaffPrincipal, @Param("id", ParseUUIDPipe) id: string) {
    await this.admin.reactivate(staff.userId, id);
  }
}
