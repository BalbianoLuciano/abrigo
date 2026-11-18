import { auditLog, type Database } from "@abrigo/db";
import { Inject, Injectable } from "@nestjs/common";
import { DB } from "../infra/tokens.js";

export interface AuditEntry {
  actorType: "anon" | "helper" | "admin" | "system";
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  /** Nunca contenido de mensajes ni datos personales. */
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(entry: AuditEntry, tx: Pick<Database, "insert"> = this.db): Promise<void> {
    await tx.insert(auditLog).values({
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
    });
  }
}
