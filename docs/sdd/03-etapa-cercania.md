# 03 · Etapa 2 — Cercanía y escalado

**Objetivo:** avisar primero a los ayudantes más cercanos y adecuados, y ampliar el aviso de forma progresiva si nadie responde.

## Por qué cercanía si la ayuda es remota

La conversación es por chat, pero un ayudante cercano conoce los recursos locales (hospitales, comisarías de la mujer, centros de salud mental del partido) y puede derivar mejor. La cercanía es una **prioridad**, no un requisito.

## Escalado progresivo

| Nivel | Cuándo             | A quién se avisa                                                                                                       |
| ----- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 0     | Al crear la alerta | De guardia, misma especialidad, zona de cobertura que contiene la celda                                                |
| 1     | +3 min sin tomar   | + radio de 50 km                                                                                                       |
| 2     | +6 min sin tomar   | + toda la provincia                                                                                                    |
| 3     | +10 min sin tomar  | + todo el país (ayudantes con `accepts_remote_anywhere`)                                                               |
| 4     | +20 min sin tomar  | Se le vuelve a mostrar a la persona: "Seguimos buscando. Mientras tanto, estas líneas atienden ahora" + aviso al admin |

- Con preferencia de género (camino violencia) se respeta en los niveles 0–2; en el nivel 3 se avisa a todos y se le explica a la persona.
- Alertas con peligro indicado arrancan directamente en el nivel 1.
- Cada nivel es un job con demora en BullMQ; si la alerta se toma, los jobs pendientes se cancelan.
- No se avisa dos veces al mismo ayudante por la misma alerta.

## Mapa del ayudante

- Google Maps con estilo propio (tonos de DESIGN.md, sin POIs comerciales).
- Alertas abiertas como zonas difusas (celda H3), color por camino.
- Lista sincronizada con el mapa; la lista es la vista principal en mobile.
- Su propia zona de cobertura editable.

## Canal Telegram

- Bot de Abrigo. El ayudante lo vincula desde su perfil con un código de un solo uso.
- Mensaje: "Hay una persona que necesita que la escuchen (violencia). Abrir Abrigo" con un link profundo. Sin zona ni datos.
- Preferencias por canal (push / Telegram / email) y horario de silencio.

## Criterios de aceptación

- [x] Una alerta en CABA avisa primero a ayudantes con cobertura en CABA (test con fixtures PostGIS).
- [x] Si nadie la toma, se escala por niveles en los tiempos definidos (test con reloj simulado).
- [x] Tomar una alerta cancela los escalados pendientes.
- [x] El ayudante nunca ve una ubicación más precisa que la celda H3.
- [x] Vincular y desvincular Telegram funciona; los avisos llegan por el canal preferido.

## Tareas

1. Zona de cobertura del ayudante (UI + `geography`).
2. Consultas de coincidencia PostGIS + índices.
3. Motor de escalado (jobs BullMQ con demora + cancelación).
4. Mapa del ayudante (web y nativo).
5. Bot de Telegram + vinculación + preferencias de canal.
6. Métricas: tiempo hasta tomar, por nivel de escalado y provincia.

## Estado de implementación (2026-11-19)

| Tarea                      | Estado                       | Dónde                                                                                                               |
| -------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1. Zona de cobertura       | ✅                           | `PUT /v1/helper/coverage` (círculo → `geography(Polygon)`, provincias, "todo el país") · pantalla `ayudante/zona`   |
| 2. Coincidencia PostGIS    | ✅                           | `apps/api/src/proximity/eligibility.ts`: una sola regla para el aviso y para la lista                               |
| 3. Motor de escalado       | ✅                           | jobs `alert-escalate` con demora y `jobId` determinista; se cancelan al tomar                                       |
| 4. Mapa del ayudante       | ✅ web · ⏳ nativo (etapa 4) | `components/alerts-map.web.tsx` (Maps JS con estilo propio, celdas H3)                                              |
| 5. Telegram y preferencias | ✅                           | webhook firmado `POST /v1/telegram/webhook`, códigos de un solo uso (15 min, solo hash), pantalla `ayudante/avisos` |
| 6. Métricas                | ✅                           | `GET /v1/admin/metrics` + pestaña "Métricas" en admin                                                               |

Tests: `apps/api/src/test/proximity.int.test.ts` (PostGIS real, reloj acelerado, bot de Telegram falso) y el E2E del flujo completo.

### Decisiones tomadas al implementar

- **"No sé" cuenta como peligro** y también arranca en el nivel 1, igual que "Sí" (mismo criterio que las líneas de crisis).
- **Provincia de una alerta con celda:** no se guarda la provincia de la celda (haría falta cargar los límites provinciales). En el nivel 2, una alerta con solo celda avisa a quien tenga cobertura a menos de 200 km. Si se cargan los límites del IGN, se puede reemplazar.
- **Alertas sin ubicación:** desde el nivel 0 se avisa a quienes aceptan pedidos de todo el país.
- **Lista de pedidos:** el ayudante ve solo los pedidos para los que ya sería avisado según el nivel actual, y solo si está de guardia.
- **Horario de silencio:** se aplica a todos los canales. Sin preferencias guardadas: push y email.
- **Nivel 4:** no suma destinatarios. A la persona se le muestran las líneas con más peso y a los admins les llega un email sin datos del pedido.
- **Toma con preferencia de mujer:** desde el nivel 3 cualquier ayudante puede tomarlo, y a la persona se le explica.
- **Ubicación del ayudante:** el centro de su zona se redondea a ~1 km en el dispositivo.
