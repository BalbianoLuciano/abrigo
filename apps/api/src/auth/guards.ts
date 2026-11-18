import { authUsers, helpers, type Database } from "@abrigo/db";
import {
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { eq } from "@abrigo/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AnonService } from "../anon/anon.service.js";
import { ANON_TOKEN_HEADER, ANON_TOKEN_ROTATED_HEADER, toWebHeaders } from "../common/http.js";
import type { StaffPrincipal, StaffRole } from "../common/principal.js";
import { AUTH, DB } from "../infra/tokens.js";
import type { Auth } from "./better-auth.js";

const ROLES_KEY = "abrigo:roles";
/** Roles permitidos para el endpoint. Sin decorador: helper aprobado o admin. */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);

const DEFAULT_ROLES: StaffRole[] = ["helper", "admin"];

@Injectable()
export class StaffSessionResolver {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(DB) private readonly db: Database,
  ) {}

  /** Valida la sesión de Better Auth (cookie o bearer) y lee el rol vigente de la base. */
  async resolve(
    headers: Headers,
  ): Promise<(StaffPrincipal & { twoFactorEnabled: boolean }) | null> {
    const session = await this.auth.api.getSession({ headers });
    if (!session) return null;
    const [row] = await this.db
      .select({
        role: authUsers.role,
        twoFactorEnabled: authUsers.twoFactorEnabled,
        helperId: helpers.id,
      })
      .from(authUsers)
      .leftJoin(helpers, eq(helpers.userId, authUsers.id))
      .where(eq(authUsers.id, session.user.id))
      .limit(1);
    if (!row) return null;
    return {
      kind: "staff",
      userId: session.user.id,
      role: row.role as StaffRole,
      helperId: row.helperId,
      twoFactorEnabled: row.twoFactorEnabled,
    };
  }
}

@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(StaffSessionResolver) private readonly resolver: StaffSessionResolver,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const staff = await this.resolver.resolve(toWebHeaders(req.headers));
    if (!staff) throw new UnauthorizedException("Tenés que iniciar sesión");
    if (!staff.twoFactorEnabled) {
      throw new ForbiddenException({
        message: "Activá la verificación en dos pasos para continuar",
        code: "two_factor_required",
      });
    }
    const allowed =
      this.reflector.getAllAndOverride<StaffRole[] | undefined>(ROLES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? DEFAULT_ROLES;
    if (!allowed.includes(staff.role)) {
      throw new ForbiddenException({ message: "No tenés permiso para esto", code: "role" });
    }
    req.principal = {
      kind: "staff",
      userId: staff.userId,
      role: staff.role,
      helperId: staff.helperId,
    };
    return true;
  }
}

@Injectable()
export class AnonGuard implements CanActivate {
  constructor(@Inject(AnonService) private readonly anon: AnonService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const token = req.headers[ANON_TOKEN_HEADER];
    if (typeof token !== "string" || !token) throw new UnauthorizedException("Sesión no válida");
    const result = await this.anon.validate(token);
    if (!result)
      throw new UnauthorizedException({ message: "Sesión no válida", code: "anon_invalid" });
    if (result.rotatedToken) {
      ctx
        .switchToHttp()
        .getResponse<FastifyReply>()
        .header(ANON_TOKEN_ROTATED_HEADER, result.rotatedToken);
    }
    req.principal = { kind: "anon", sessionId: result.sessionId };
    return true;
  }
}

/** Acepta sesión anónima o de ayudante/admin (por ejemplo, para cerrar una conversación). */
@Injectable()
export class AnyPrincipalGuard implements CanActivate {
  constructor(
    @Inject(AnonGuard) private readonly anonGuard: AnonGuard,
    @Inject(StaffGuard) private readonly staffGuard: StaffGuard,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (typeof req.headers[ANON_TOKEN_HEADER] === "string") return this.anonGuard.canActivate(ctx);
    return this.staffGuard.canActivate(ctx);
  }
}
