# Abrigo — Software Design Document (SDD)

Documento vivo. Cada etapa se itera por separado: se revisa, se ajusta y recién ahí se implementa.

| # | Documento | Estado |
|---|---|---|
| 00 | [Visión y alcance](00-vision-y-alcance.md) | Borrador v0.1 |
| 01 | [Arquitectura](01-arquitectura.md) | Borrador v0.1 |
| 02 | [Etapa 1 — MVP](02-etapa-mvp.md) | Borrador v0.1 |
| 03 | [Etapa 2 — Cercanía y escalado](03-etapa-cercania.md) | Borrador v0.1 |
| 04 | [Etapa 3 — Moderación y admin](04-etapa-moderacion-admin.md) | Borrador v0.1 |
| 05 | [Etapa 4 — Apps nativas](05-etapa-nativas.md) | Borrador v0.1 |

Diseño visual y voz: [`docs/design/DESIGN.md`](../design/DESIGN.md).

## Decisiones cerradas

| Fecha | Decisión |
|---|---|
| 2026-11-16 | Backend propio: NestJS + PostgreSQL/PostGIS + Redis/BullMQ (se descartan Supabase y Firebase) |
| 2026-11-16 | Frontend: Expo + React Native Web, PWA primero |
| 2026-11-17 | Diseño: DESIGN.md propio (HITO + Oura + principios de Chayn) |
| 2026-11-18 | Alcance: solo Argentina |
| 2026-11-18 | Ayuda solo remota (chat). Nada presencial |
| 2026-11-18 | Ayudantes aprobados manualmente por el admin (fundador) |
| 2026-11-18 | Menores de 18: fuera del MVP, se derivan a la línea 102 |
| 2026-11-18 | Dos caminos separados: salud mental y violencia |

## Pendientes

- Consulta legal: transferencia internacional de datos sensibles (región de nube en São Paulo) e inscripción de la base en la AAIP.
- Validar textos y flujos con profesionales de salud mental y con sobrevivientes de violencia (principio "compartir el poder").
