# 02 · Etapa 1 — MVP

**Objetivo:** que una persona pueda pedir ayuda sin identificarse y que un ayudante verificado converse con ella por chat.

## Historias de usuario

### Persona que pide ayuda

- **P1.** Como persona en crisis, quiero pedir que alguien me escuche sin dar mi nombre.
- **P2.** Si estoy en peligro inmediato, quiero ver de inmediato a quién llamar.
- **P3.** Quiero elegir si mi situación es de salud mental o de violencia.
- **P4.** Quiero salir rápido de la app si alguien se acerca.
- **P5.** Quiero chatear con la persona que me responda y saber que está verificada.
- **P6.** Quiero poder terminar la conversación, pedir otra persona o reportar.
- **P7.** Quiero poder borrar todo lo que quedó en mi dispositivo.

### Ayudante

- **A1.** Como profesional, quiero registrarme con mis datos y matrícula para ser verificado.
- **A2.** Quiero activar y pausar mi disponibilidad ("de guardia").
- **A3.** Quiero recibir un aviso (push y email) cuando hay una alerta de mi especialidad.
- **A4.** Quiero ver las alertas abiertas y tomar una conversación.
- **A5.** Quiero chatear, ver las líneas de derivación y cerrar la conversación con un resumen privado opcional.

### Admin

- **D1.** Quiero ver las solicitudes de ayudantes pendientes, revisar los datos y aprobar o rechazar.
- **D2.** Quiero suspender a un ayudante de inmediato.

## Flujo de pedido de ayuda

1. **Inicio:** "¿Necesitás que alguien te escuche?" + salida rápida + acceso directo a líneas de ayuda.
2. **Edad:** "¿Tenés 18 años o más?" → No: pantalla con la línea 102 y recursos, sin crear alerta.
3. **Camino:** "¿Qué te está pasando?" → _Me siento muy mal / pienso en hacerme daño_ (salud mental) · _Estoy sufriendo violencia_ (violencia).
4. **Peligro:** "¿Estás en peligro ahora mismo?" → Sí / No sé / No. Con Sí o No sé, la tarjeta de líneas de crisis del camino se muestra en esta pantalla y se registra `crisis_lines_shown_at`.
5. **Solo violencia:** "¿Tenés un momento seguro para escribir?" y "¿Preferís que te escriba una mujer?" (opcional).
6. **Zona (opcional):** "¿Querés compartir tu zona aproximada? Sirve para encontrar a alguien cerca." → GPS reducido a H3 en el dispositivo, o elegir provincia, o "Prefiero no".
7. **Consentimiento:** resumen en lenguaje simple de qué se guarda y por cuánto tiempo + aceptar.
8. **Captcha invisible** y envío.
9. **Espera que respira** + "Mientras tanto podés llamar a…" + opción de recibir aviso push cuando alguien responda.
10. **Chat.**

## Flujo del ayudante

1. Registro: nombre, apellido, profesión, matrícula y jurisdicción (si corresponde), organización (si es voluntario/a), especialidades, género (opcional), zona de cobertura, aceptación del código de conducta. Configuración de TOTP.
2. Estado `helper_pending` hasta que el admin apruebe.
3. Aprobado: activa "Estoy de guardia". Se le pide permiso de notificaciones push.
4. Alerta nueva de su especialidad → push + email → lista de alertas abiertas.
5. "Tomar esta conversación" → si otro la tomó, mensaje amable "Otra persona ya está acompañando este pedido".
6. Chat con panel lateral: líneas de derivación del camino, guía breve de primer contacto, botón "Cerrar conversación".

## Avisos en el MVP

- Fan-out simple: **todos los ayudantes de guardia de la especialidad**, sin filtrar por cercanía (la cercanía llega en la etapa 2).
- Canales: Web Push + email.
- Contenido del aviso sin datos sensibles: "Hay una persona que necesita que la escuchen (salud mental)". Nunca la zona en el email.

## API (borrador)

| Método | Ruta                                                | Quién                          |
| ------ | --------------------------------------------------- | ------------------------------ |
| POST   | `/v1/anon/session`                                  | Anónimo                        |
| DELETE | `/v1/anon/session`                                  | Anónimo ("borrar todo")        |
| POST   | `/v1/alerts`                                        | Anónimo                        |
| POST   | `/v1/alerts/:id/cancel`                             | Anónimo                        |
| POST   | `/v1/alerts/:id/reassign`                           | Anónimo ("pedir otra persona") |
| GET    | `/v1/helper/alerts?status=open`                     | Ayudante                       |
| POST   | `/v1/helper/alerts/:id/claim`                       | Ayudante                       |
| PATCH  | `/v1/helper/availability`                           | Ayudante                       |
| POST   | `/v1/helpers/register`                              | Público                        |
| GET    | `/v1/admin/helpers?status=pending`                  | Admin                          |
| POST   | `/v1/admin/helpers/:id/decision`                    | Admin                          |
| POST   | `/v1/admin/helpers/:id/suspend`                     | Admin                          |
| POST   | `/v1/push/subscriptions`                            | Anónimo / Ayudante             |
| POST   | `/v1/conversations/:id/close`                       | Ambos                          |
| POST   | `/v1/conversations/:id/report`                      | Ambos                          |
| WS     | `conversation:{id}` → `message`, `typing`, `closed` | Ambos                          |

## Criterios de aceptación

- [x] Se puede crear una alerta sin ningún dato personal.
- [x] Con "Sí" o "No sé" en peligro, las líneas oficiales se muestran **antes** de enviar; el 100% de esas alertas tiene `crisis_lines_shown_at`.
- [x] Un menor de 18 no puede crear una alerta y ve la línea 102.
- [x] La salida rápida está en todas las pantallas de la persona, funciona con Esc dos veces y no deja la app en el historial "atrás".
- [x] Dos ayudantes que toman la misma alerta al mismo tiempo: solo uno lo logra (test de concurrencia).
- [x] Una alerta tomada sin primer mensaje en 3 minutos vuelve a estar abierta.
- [x] Los mensajes se guardan cifrados; una consulta directa a la base no muestra texto plano.
- [x] Un ayudante sin TOTP no puede entrar. Un ayudante suspendido pierde la sesión al instante.
- [x] "Borrar todo" elimina la sesión local y los datos del servidor.
- [x] Lighthouse: PWA instalable, Accesibilidad ≥ 95. (Accesibilidad 95; Performance 56 en mobile throttled, ver pendiente de bundle.)
- [x] E2E (Playwright): pedido de ayuda → aviso → tomar → chat → cierre.

## Tareas

1. Monorepo (pnpm, Turborepo, TS, lint, CI básico).
2. `packages/ui`: tokens de DESIGN.md + componentes base (botones, opciones, tarjeta de crisis, burbujas, salida rápida).
3. `packages/db`: esquema Drizzle + migraciones + PostGIS.
4. API: auth (anónima + ayudantes + TOTP + roles).
5. API: alertas + tomar/liberar + jobs de timeout.
6. API: chat (Socket.IO) + cifrado de mensajes.
7. Notificaciones: Web Push + email.
8. App: flujo de pedido de ayuda completo.
9. App: registro y panel del ayudante.
10. App: panel mínimo de admin (aprobar/suspender).
11. Infra: Terraform (Cloud Run, Cloud SQL, Memorystore, KMS) + deploy desde CI.
12. Textos legales v1 (términos, privacidad, código de conducta) — redacción con asesoría.
13. Prueba con 3–5 profesionales y revisión de textos por especialistas antes de abrir.

## Estado de implementación (2026-11-18)

| Tarea                        | Estado                  | Dónde                                                                                      |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| 1. Monorepo                  | ✅                      | raíz, `docker-compose.yml`, `.github/workflows/ci.yml`                                     |
| 2. `packages/ui`             | ✅                      | tokens + botones, opciones, tarjeta de crisis, burbujas, salida rápida, espera que respira |
| 3. `packages/db`             | ✅                      | esquema Drizzle, migraciones con PostGIS, auditoría inmutable                              |
| 4–7. API                     | ✅                      | `apps/api` (25 tests con Postgres y Redis reales) + `apps/e2e` (3 E2E Playwright)                           |
| 8–10. App                    | ✅                      | `apps/mobile` (persona, ayudante, admin)                                                   |
| 11. Infra                    | ✅ escrita, sin aplicar | `infra/terraform`, `Dockerfile`, `.github/workflows/deploy.yml`                            |
| 12. Textos legales           | 📝 borrador             | `docs/legal/` — **requiere asesoría legal**                                                |
| 13. Prueba con profesionales | ⏳                      | depende de personas, no de código                                                          |
