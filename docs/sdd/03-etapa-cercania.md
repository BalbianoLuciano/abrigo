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

- [ ] Una alerta en CABA avisa primero a ayudantes con cobertura en CABA (test con fixtures PostGIS).
- [ ] Si nadie la toma, se escala por niveles en los tiempos definidos (test con reloj simulado).
- [ ] Tomar una alerta cancela los escalados pendientes.
- [ ] El ayudante nunca ve una ubicación más precisa que la celda H3.
- [ ] Vincular y desvincular Telegram funciona; los avisos llegan por el canal preferido.

## Tareas

1. Zona de cobertura del ayudante (UI + `geography`).
2. Consultas de coincidencia PostGIS + índices.
3. Motor de escalado (jobs BullMQ con demora + cancelación).
4. Mapa del ayudante (web y nativo).
5. Bot de Telegram + vinculación + preferencias de canal.
6. Métricas: tiempo hasta tomar, por nivel de escalado y provincia.
