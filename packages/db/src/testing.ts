import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { runMigrations } from "./migrate.js";

/** Imagen multi-arch de PostGIS 16 (la oficial no publica arm64). */
export const POSTGIS_IMAGE = "imresamu/postgis:16-3.5";

/** Levanta un Postgres+PostGIS real con las migraciones aplicadas. */
export async function startTestDatabase(): Promise<{
  container: StartedPostgreSqlContainer;
  url: string;
}> {
  const container = await new PostgreSqlContainer(POSTGIS_IMAGE).start();
  const url = container.getConnectionUri();
  await runMigrations(url);
  return { container, url };
}
