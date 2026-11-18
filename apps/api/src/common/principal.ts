import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export type StaffRole = "helper_pending" | "helper" | "helper_suspended" | "admin";

export interface AnonPrincipal {
  kind: "anon";
  sessionId: string;
}

export interface StaffPrincipal {
  kind: "staff";
  userId: string;
  role: StaffRole;
  /** Fila en `helpers` (los admin pueden no tenerla). */
  helperId: string | null;
}

export type Principal = AnonPrincipal | StaffPrincipal;

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
  }
}

export const CurrentAnon = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const p = ctx.switchToHttp().getRequest<{ principal?: Principal }>().principal;
  if (p?.kind !== "anon") throw new Error("CurrentAnon sin AnonGuard");
  return p;
});

export const CurrentStaff = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const p = ctx.switchToHttp().getRequest<{ principal?: Principal }>().principal;
  if (p?.kind !== "staff") throw new Error("CurrentStaff sin StaffGuard");
  return p;
});

export const CurrentPrincipal = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const p = ctx.switchToHttp().getRequest<{ principal?: Principal }>().principal;
  if (!p) throw new Error("CurrentPrincipal sin guard");
  return p;
});
