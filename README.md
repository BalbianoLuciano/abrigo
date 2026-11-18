# Abrigo

Herramienta open source para acompañar a personas en situación de riesgo de suicidio o de violencia: escucha inmediata con profesionales y voluntarios verificados, sin pedir datos personales.

- Visión, arquitectura y etapas: [`docs/sdd/`](docs/sdd/README.md)
- Sistema de diseño: [`docs/design/DESIGN.md`](docs/design/DESIGN.md)
- Textos legales (borrador): [`docs/legal/`](docs/legal/README.md)

## Estructura

| Carpeta           | Qué hay                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/api`        | NestJS + Fastify: HTTP, WebSocket (`src/main.ts`) y worker de BullMQ (`src/worker.ts`)                  |
| `apps/mobile`     | Expo Router: PWA para quien pide ayuda, panel de ayudantes y de administración                          |
| `apps/e2e`        | Playwright contra la API real y la PWA exportada                                                        |
| `packages/db`     | Esquema Drizzle, migraciones (PostGIS) y helpers de test                                                |
| `packages/shared` | Esquemas zod, constantes y líneas de crisis (`@abrigo/shared/client` es la versión liviana para la app) |
| `packages/ui`     | Tokens y componentes de DESIGN.md                                                                       |
| `infra/terraform` | GCP (`southamerica-east1`): Cloud Run, Cloud SQL, Memorystore, KMS, Secret Manager, balanceador         |

## Desarrollo local

Requisitos: Node 24 (`.nvmrc`), pnpm (corepack) y Docker.

```sh
corepack enable
pnpm install
cp .env.example .env            # completá BETTER_AUTH_SECRET y MESSAGE_KEYS
docker compose up -d            # Postgres+PostGIS, Redis y Mailpit (http://localhost:8025)
pnpm build                      # compila los paquetes compartidos
pnpm --filter @abrigo/api db:migrate

pnpm --filter @abrigo/api dev           # API en http://localhost:3000
pnpm --filter @abrigo/api dev:worker    # temporizadores y notificaciones
pnpm --filter @abrigo/mobile web        # PWA en http://localhost:8081
```

Primer admin: registrate en `/ayudante/registro` y después

```sh
DATABASE_URL=... pnpm --filter @abrigo/api admin:promote tu@email.com
```

## Calidad

```sh
pnpm lint typecheck test       # tests de la API con Postgres y Redis reales (Testcontainers)
pnpm --filter @abrigo/e2e e2e  # flujo completo en el navegador
```

## Deploy

Ver `infra/terraform/README.md`. El workflow `.github/workflows/deploy.yml` corre después de un CI verde en `main`: construye la imagen, ejecuta migraciones, actualiza API y worker y sube la PWA al bucket.
