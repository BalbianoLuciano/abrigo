# 00 · Visión y alcance

## Problema

Una persona que atraviesa depresión, ideación suicida o violencia muchas veces no pide ayuda porque no sabe a quién, tiene miedo de ser identificada o siente que va a molestar. Las líneas oficiales existen pero no siempre son la primera puerta que alguien se anima a tocar.

## Propuesta

Abrigo permite **pedir que alguien te escuche, sin dar tu nombre**, y conecta ese pedido con **profesionales y voluntarios verificados** que están disponibles para conversar por chat.

## Usuarios

| Rol                    | Descripción                                                                                                                               | Cuenta                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Persona que pide ayuda | Adulto (18+) en Argentina, en situación de salud mental o de violencia                                                                    | No. Sesión anónima ligada al dispositivo                    |
| Ayudante               | Profesional matriculado (psicología, psiquiatría, trabajo social, acompañamiento terapéutico) o voluntario/a de una organización de ayuda | Sí. Email + contraseña + 2FA obligatorio. Aprobación manual |
| Admin                  | Fundador (por ahora). Aprueba ayudantes, modera, ve métricas                                                                              | Sí. 2FA obligatorio                                         |

## Dos caminos

|                                | Salud mental                                   | Violencia                                                                                                   |
| ------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Situaciones                    | Depresión, ansiedad, ideación suicida, soledad | Violencia de género, familiar, sexual                                                                       |
| Líneas oficiales destacadas    | 135 / (011) 5275-1135 · 911                    | 144 · 137 · 911                                                                                             |
| Preguntas extra                | ¿Estás en peligro ahora mismo?                 | ¿Estás en peligro ahora? · ¿Tenés un momento seguro para escribir? · Preferencia de género de quien escucha |
| Ayudantes que reciben el aviso | Especialidad salud mental                      | Especialidad violencia                                                                                      |
| Riesgos propios                | Riesgo de vida inmediato                       | El agresor puede ver el dispositivo                                                                         |

## Dentro del alcance

- Pedido de ayuda anónimo con triage y líneas de crisis.
- Chat anónimo en tiempo real entre la persona y un ayudante.
- Registro, verificación manual y disponibilidad de ayudantes.
- Avisos a ayudantes por push, email y luego Telegram, priorizando cercanía.
- Panel de admin y moderación.
- PWA primero; apps nativas después.

## Fuera del alcance

- Atención presencial o encuentros físicos.
- Menores de 18 (se los deriva a la línea 102).
- Diagnóstico, tratamiento o prescripción. Abrigo **no reemplaza** un servicio de salud ni de emergencias.
- Países fuera de Argentina (la arquitectura lo deja preparado, no se activa).
- Videollamadas. Llamadas de voz: a evaluar en una etapa futura.

## Principios rectores

1. **Primero la vida.** Ante peligro inmediato, las líneas oficiales aparecen antes que cualquier otra cosa.
2. **Anonimato por defecto.** Nunca se pide nombre, teléfono ni ubicación exacta.
3. **Nunca prometer lo que no podemos cumplir.** No hay tiempos de respuesta garantizados en la interfaz.
4. **Seguridad de las dos partes.** Ayudantes verificados; nada presencial; todo queda auditado.
5. **Diseño informado en trauma.** Ver los 8 principios en `DESIGN.md`.

## Marco legal (Argentina) — a validar con un abogado

| Norma                                           | Impacto                                                                                                                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ley 25.326 de Protección de Datos Personales    | Los datos de salud son sensibles. Consentimiento expreso, finalidad, minimización, seguridad. Inscripción de la base en el Registro Nacional de Bases de Datos (AAIP). Condiciones para transferir datos fuera del país |
| Ley 26.657 de Salud Mental                      | Enfoque de derechos; Abrigo no realiza prácticas de salud, solo acompañamiento y derivación                                                                                                                             |
| Ley 27.130 de Prevención del Suicidio           | Marco de referencia para protocolos y derivación                                                                                                                                                                        |
| Ley 26.485 de Protección Integral a las Mujeres | Marco de referencia para el camino de violencia                                                                                                                                                                         |
| Ejercicio profesional                           | Los profesionales actúan bajo su propia matrícula y responsabilidad; Abrigo lo deja explícito en sus términos                                                                                                           |

Documentos necesarios antes de lanzar: términos y condiciones, política de privacidad en lenguaje simple, código de conducta para ayudantes, protocolo de derivación ante riesgo.

## Riesgos principales

| Riesgo                                            | Mitigación                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Nadie responde a tiempo                           | Líneas oficiales siempre visibles; aviso progresivo; nunca prometer tiempos                      |
| Un agresor o depredador se registra como ayudante | Verificación manual con matrícula/organización, 2FA, auditoría, reportes, ubicación nunca exacta |
| El agresor ve el dispositivo de la víctima        | Salida rápida, nombre e ícono discretos, sin historial visible, borrado de datos locales         |
| Alertas falsas o trolls                           | Límite por dispositivo/IP, captcha invisible, moderación                                         |
| Filtración de datos                               | Cifrado de mensajes en la aplicación, borrado automático, mínimo de datos                        |
| Desgaste de ayudantes                             | Límite de conversaciones simultáneas, pausas, protocolo de derivación                            |

## Métricas de éxito

- Tiempo hasta el primer mensaje de un ayudante (p50, p90).
- % de alertas que reciben respuesta.
- % de alertas con peligro indicado a las que se les mostraron las líneas oficiales (objetivo: 100%).
- Cantidad de ayudantes verificados activos por provincia.
- Valoración opcional y anónima al cerrar la conversación ("¿Te sentiste escuchado/a?").
