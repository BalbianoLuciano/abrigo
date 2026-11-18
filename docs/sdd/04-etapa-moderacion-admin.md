# 04 · Etapa 3 — Moderación y admin

**Objetivo:** cuidar a las personas, a los ayudantes y a la plataforma a medida que crece.

## Panel de admin

- **Verificaciones:** cola de solicitudes, datos del ayudante, link de consulta a REFEPS/SISA para la matrícula, notas internas, aprobar/rechazar con motivo.
- **Ayudantes:** estado, especialidades, conversaciones atendidas, reportes recibidos, suspender/reactivar.
- **Reportes:** cola priorizada; acceso a los mensajes de esa conversación **solo** con reporte abierto y con registro de auditoría.
- **Métricas:** alertas por camino y provincia, tiempos de respuesta, % sin respuesta, cobertura de ayudantes por provincia (para saber dónde reclutar).
- **Auditoría:** quién hizo qué y cuándo; inmutable.

## Moderación

- Reporte con un toque desde el chat (ambos lados): motivos predefinidos + texto libre opcional.
- Reporte de la persona contra un ayudante: la conversación se cierra para ese ayudante, se le ofrece otra persona, y el ayudante queda en revisión si acumula reportes.
- Bloqueo de sesiones anónimas abusivas (por sesión y hash de IP).
- Detección simple de alertas spam (frecuencia, textos repetidos).

## Cuidado de ayudantes

- Límite de conversaciones simultáneas (por defecto 2, configurable).
- Pausa sugerida después de una conversación con peligro indicado.
- Guía de primer contacto y protocolo de derivación siempre visibles en el chat.
- Botón "Necesito apoyo" que avisa al admin.
- Organizaciones aliadas (futuro): una organización puede verificar a sus propios voluntarios.

## Borrado automático

- Job diario que aplica la tabla de retención de `01-arquitectura.md`.
- Reporte mensual de borrado (cantidades, no contenido) para rendición de cuentas.

## Criterios de aceptación

- [ ] Un admin no puede leer mensajes de una conversación sin reporte abierto.
- [ ] Toda lectura de mensajes por un admin queda en la auditoría.
- [ ] Suspender a un ayudante cierra su sesión y lo saca de todas las conversaciones en curso, ofreciendo otra persona.
- [ ] El job de retención borra los mensajes a los 30 días (test con datos sembrados).
