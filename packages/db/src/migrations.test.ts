import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "./client.js";
import { auditLog } from "./schema/index.js";
import { startTestDatabase } from "./testing.js";

describe("migraciones", () => {
  let container: StartedPostgreSqlContainer;
  let handle: DbHandle;

  beforeAll(async () => {
    const started = await startTestDatabase();
    container = started.container;
    handle = createDb(started.url);
  });

  afterAll(async () => {
    await handle?.close();
    await container?.stop();
  });

  it("habilitan PostGIS", async () => {
    const { rows } = await handle.pool.query<{ v: string }>("SELECT postgis_version() AS v");
    expect(rows[0]?.v).toMatch(/^3\./);
  });

  it("dejan la auditoría inmutable", async () => {
    const [row] = await handle.db
      .insert(auditLog)
      .values({ actorType: "system", action: "test" })
      .returning();
    await expect(
      handle.db.execute(sql`UPDATE audit_log SET action = 'otra' WHERE id = ${row!.id}`),
    ).rejects.toThrow();
    await expect(
      handle.db.execute(sql`DELETE FROM audit_log WHERE id = ${row!.id}`),
    ).rejects.toThrow();
  });
});
