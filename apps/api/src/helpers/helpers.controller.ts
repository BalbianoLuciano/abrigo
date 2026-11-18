import {
  availabilitySchema,
  helperRegistrationSchema,
  type HelperRegistrationInput,
} from "@abrigo/shared";
import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { Roles, StaffGuard, StaffSessionResolver } from "../auth/guards.js";
import { toWebHeaders } from "../common/http.js";
import { CurrentStaff, type StaffPrincipal } from "../common/principal.js";
import { ZodPipe } from "../common/zod-pipe.js";
import { HelpersService } from "./helpers.service.js";

@Controller("v1")
export class HelpersController {
  constructor(
    @Inject(HelpersService) private readonly helpers: HelpersService,
    @Inject(StaffSessionResolver) private readonly resolver: StaffSessionResolver,
  ) {}

  @Post("helpers/register")
  register(
    @Body(new ZodPipe(helperRegistrationSchema)) body: HelperRegistrationInput,
    @Req() req: FastifyRequest,
  ) {
    return this.helpers.register(body, req.ip);
  }

  /**
   * Estado de la cuenta. Accesible sin 2FA activo para que la app pueda guiar
   * la configuración de TOTP y mostrar "pendiente de aprobación".
   */
  @Get("helper/me")
  async me(@Req() req: FastifyRequest) {
    const staff = await this.resolver.resolve(toWebHeaders(req.headers));
    if (!staff) throw new UnauthorizedException("Tenés que iniciar sesión");
    if (staff.role === "helper_suspended") {
      throw new HttpException({ message: "Tu cuenta está suspendida", code: "suspended" }, 403);
    }
    return this.helpers.me(staff.userId);
  }

  @Patch("helper/availability")
  @UseGuards(StaffGuard)
  @Roles("helper")
  availability(
    @CurrentStaff() staff: StaffPrincipal,
    @Body(new ZodPipe(availabilitySchema)) body: z.infer<typeof availabilitySchema>,
  ) {
    return this.helpers.setAvailability(staff.helperId!, body.isOnCall, body.pausedUntil);
  }
}
