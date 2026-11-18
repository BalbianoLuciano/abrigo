import { Controller, Delete, HttpCode, Inject, Post, UseGuards } from "@nestjs/common";
import { AnonGuard } from "../auth/guards.js";
import { CurrentAnon, type AnonPrincipal } from "../common/principal.js";
import { AnonService } from "./anon.service.js";

@Controller("v1/anon/session")
export class AnonController {
  constructor(@Inject(AnonService) private readonly anon: AnonService) {}

  /** Crea una sesión anónima. El token solo se devuelve acá; el servidor guarda su hash. */
  @Post()
  async create() {
    const { token } = await this.anon.create();
    return { token };
  }

  /** "Borrar todo". */
  @Delete()
  @HttpCode(204)
  @UseGuards(AnonGuard)
  async erase(@CurrentAnon() anon: AnonPrincipal) {
    await this.anon.eraseEverything(anon.sessionId);
  }
}
