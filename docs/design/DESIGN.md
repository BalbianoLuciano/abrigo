---
version: 0.1.0
name: Abrigo
description: Sistema de diseño de Abrigo — una plataforma para pedir y ofrecer escucha a personas en crisis (depresión, ideación suicida, violencia). Base de papel cálido, volúmenes de color suave inspirados en el Hospital Infantil Teletón de Oncología (HITO, Querétaro) y principios de diseño informado en trauma (Chayn). El color abriga, nunca alarma.

colors:
  # ─── Superficies ───
  canvas: "#F7F1E8"        # papel cálido, estado de reposo de toda la app
  surface: "#FFFDF9"       # tarjetas, inputs, burbujas
  surface-sunk: "#EFE7DB"  # zonas hundidas, fondo del composer
  hairline: "#E3D9CC"
  # ─── Texto ───
  ink: "#2B2622"           # nunca negro puro
  ink-soft: "#5A524B"
  mute: "#857B71"
  # ─── Acción ───
  primary: "#3F6B57"       # "refugio" — salvia profunda, única acción principal
  primary-hover: "#34594A"
  on-primary: "#FFFDF9"
  primary-tint: "#E1EBE3"
  # ─── Calidez ───
  embrace: "#9A5537"       # "abrazo" — terracota para texto/acento (AA sobre canvas)
  embrace-soft: "#C98A6A"  # terracota decorativa (solo formas, no texto)
  # ─── Volúmenes (inspirados en HITO, desaturados) ───
  vol-sun: "#EBC98F"       # sol de tarde
  vol-leaf: "#CCD8C2"      # hoja
  vol-skin: "#EDD3C4"      # piel / abrazo
  vol-calm: "#D9D3E8"      # lavanda — calma
  vol-air: "#CFE1E5"       # aire
  # ─── Estados (sin rojo de alarma) ───
  urgent: "#8A5A16"        # ámbar profundo — texto de urgencia
  urgent-bg: "#F6E6C8"
  success: "#3F6B57"
  danger-form: "#A1483A"   # SOLO validación de formularios del lado ayudante
  focus-ring: "#3F6B57"

colors-dark:               # modo noche — mucha gente escribe de madrugada
  canvas: "#1B1815"
  surface: "#25211D"
  surface-sunk: "#16130F"
  hairline: "#3A342D"
  ink: "#F1E9DE"
  ink-soft: "#C9BEB1"
  mute: "#998E82"
  primary: "#8FBBA3"
  primary-hover: "#A6CBB6"
  on-primary: "#14211B"
  primary-tint: "#2A3A32"
  embrace: "#E2A182"
  embrace-soft: "#B9775A"
  vol-sun: "#5E4A2A"
  vol-leaf: "#3A4637"
  vol-skin: "#56403A"
  vol-calm: "#3F3A50"
  vol-air: "#334548"
  urgent: "#EBC27F"
  urgent-bg: "#3E321F"
  danger-form: "#E08B7C"
  focus-ring: "#8FBBA3"

typography:
  display:
    fontFamily: Fraunces            # ejes SOFT=100, WONK=0, opsz alto
    fontSize: 40px
    fontWeight: 400
    lineHeight: 1.15
  heading:
    fontFamily: Fraunces
    fontSize: 28px
    fontWeight: 450
    lineHeight: 1.2
  title:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 18px                  # mínimo 17px en mobile
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  button:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1
  caption:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45

rounded:
  sm: 10px
  md: 16px
  lg: 24px
  xl: 32px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px

motion:
  duration-quick: 160ms
  duration-base: 280ms
  duration-slow: 420ms
  easing: cubic-bezier(0.22, 1, 0.36, 1)   # ease-out suave, sin rebotes
  breath-cycle: 8s                          # 4s inhalar / 4s exhalar

touch:
  min-target: 48px

components:
  quick-exit:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.full}"
    position: fixed-top-right
    note: "Visible en TODAS las pantallas de quien pide ayuda. Atajo: Esc dos veces."
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    minHeight: 56px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.full}"
    minHeight: 52px
  crisis-line-card:
    backgroundColor: "{colors.urgent-bg}"
    textColor: "{colors.ink}"
    accent: "{colors.urgent}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  step-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  choice-chip:
    backgroundColor: "{colors.surface}"
    selectedBackground: "{colors.primary-tint}"
    selectedBorder: "{colors.primary}"
    rounded: "{rounded.full}"
  waiting-breath:
    color: "{colors.vol-leaf}"
    cycle: "{motion.breath-cycle}"
  chat-bubble-self:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg} {rounded.lg} {rounded.sm} {rounded.lg}"
  chat-bubble-helper:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg} {rounded.lg} {rounded.lg} {rounded.sm}"
  chat-composer:
    backgroundColor: "{colors.surface-sunk}"
    rounded: "{rounded.xl}"
  map-zone:
    fill: "{colors.embrace-soft}"
    opacity: 0.28
    note: "Nunca un pin exacto. Siempre una zona difusa de ≥2 km."
  alert-card-helper:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  volume-shape:
    note: "Formas orgánicas de fondo, cada una con una inclinación distinta (-8° a 8°), en colores vol-*. Decorativas, aria-hidden."
---

## Visión general

Abrigo se tiene que sentir como **una habitación tibia con la luz baja**: no como un hospital, no como una app de emergencias, no como una red social. La persona que llega está en uno de los peores momentos de su vida; cada píxel tiene que bajar la intensidad, no subirla.

El sistema combina tres fuentes:

1. **HITO — Hospital Infantil Teletón de Oncología (Sordo Madaleno Arquitectos, Querétaro, 2013).** El edificio rompe con el hospital blanco y frío: nueve volúmenes curvos, cada uno con una inclinación distinta, inspirados en *una cadena de células en movimiento* (la regeneración celular). Tomamos el **principio**, no la intensidad: el color como abrigo y los volúmenes orgánicos encadenados como metáfora de **personas conectándose**. Como nuestro público son adultos en crisis (no chicos que necesitan estímulo), los colores están desaturados y viven en el fondo.
2. **Oura (vía awesome-design-md).** Estructura técnica: canvas de papel cálido en vez de blanco, serif para el sentimiento y sans para los hechos, una única acción principal, y tierra/salvia como paleta de acento.
3. **Chayn — 8 principios de diseño informado en trauma:** seguridad, agencia, equidad, privacidad, rendición de cuentas, pluralidad, compartir el poder y esperanza. Son reglas de producto, no decoración (ver más abajo).

**Características clave**

- Canvas de papel cálido (`canvas #F7F1E8`). Nunca blanco puro de fondo, nunca negro puro de texto.
- Una sola acción principal en **salvia profunda** (`primary`, "refugio"). Todo lo demás es neutro.
- **Sin rojo** en el lado de quien pide ayuda. La urgencia se comunica en ámbar suave y con texto claro, no con alarma.
- Volúmenes de color orgánicos en el fondo (sol, hoja, piel, calma, aire) con inclinaciones distintas — el eco del HITO.
- Tipografía: **Fraunces** (serif con eje SOFT, cálida) para títulos; **Atkinson Hyperlegible Next** para todo lo que se lee — diseñada para máxima legibilidad, clave cuando alguien lee llorando, con poca luz o con ansiedad.
- Botón de **salida rápida** siempre visible.
- Modo noche cuidado como ciudadano de primera clase.

## Dos mundos

| | Quien pide ayuda | Quien ayuda (profesional/voluntario) |
|---|---|---|
| Tono | Íntimo, lento, una cosa por pantalla | Claro, operativo, denso pero sereno |
| Color | Canvas + volúmenes, sin rojo | Canvas + surface, `danger-form` permitido en formularios |
| Cuenta | Ninguna | Login + 2FA |
| Salida rápida | Siempre | No aplica |
| Mapa | No lo ve (o solo "hay personas cerca dispuestas a escucharte") | Zonas difusas, nunca puntos exactos |

## Colores

### Acción
- **Refugio** (`primary #3F6B57`): botón principal, foco, enlaces importantes. Contraste 6:1 sobre `surface`.
- **Abrazo** (`embrace #9A5537`): calidez puntual — nombre de quien te escucha, detalles de compañía. `embrace-soft` solo para formas, nunca texto.

### Volúmenes (HITO)
`vol-sun`, `vol-leaf`, `vol-skin`, `vol-calm`, `vol-air`. Se usan como formas orgánicas de fondo, fondos de tarjetas de categoría y en la animación de espera. **Nunca** para texto ni para comunicar estado.

### Estados
- **Urgente** (`urgent` sobre `urgent-bg`): la tarjeta de líneas de crisis. Ámbar, no rojo: dice "esto es importante" sin gritar.
- **danger-form**: únicamente validación en formularios del lado ayudante/admin.
- No usar colores de alarma, sirenas, signos de exclamación grandes ni conteos regresivos.

### Contraste
Mínimo **WCAG AA** (4.5:1 texto normal, 3:1 texto grande y componentes). Apuntar a AAA en el cuerpo de texto del flujo de crisis.

## Tipografía

- **Fraunces** (Google Fonts, variable): `SOFT 100`, `WONK 0`, pesos 400–500. Solo títulos y frases de contención ("Acá estamos").
- **Atkinson Hyperlegible Next** (Google Fonts): cuerpo, UI, botones. Cuerpo 18px, nunca menos de 17px en mobile. Interlineado generoso (1.6).
- Jerarquía por tamaño y aire, no por negritas pesadas ni MAYÚSCULAS.

## Layout y ritmo

- Base de 8px. Mucho aire: el vacío es parte del abrazo.
- **Una pregunta por pantalla** en el flujo de alerta. Barra de progreso suave y sin números ("Ya casi").
- Mobile first (la mayoría escribirá desde el celular). Ancho de lectura máximo 640px.
- Objetivos táctiles de mínimo 48px; botones principales de 56px de alto, a ancho completo en mobile y al alcance del pulgar.

## Movimiento

- Lento y con ease-out (`motion.easing`), sin rebotes, sin shakes, sin parpadeos.
- **Espera que respira:** mientras se busca a alguien, un volumen `vol-leaf` se expande y contrae en un ciclo de 8s (4 inhalar / 4 exhalar) con el texto "Respirá con el círculo mientras alguien llega". Convierte la espera en un ejercicio de grounding.
- Respetar siempre `prefers-reduced-motion`: el círculo queda quieto y el texto se mantiene.

## Componentes clave

### Salida rápida
Botón fijo arriba a la derecha, `surface` con borde `hairline`, texto "Salir". Al tocarlo (o al tocar Esc dos veces): reemplaza la historia de navegación (`location.replace`) por un sitio neutro (clima/Google), limpia el estado local de la sesión visible. Debe ser lo primero que se enfoca con el teclado.

### Tarjeta de líneas de crisis
Fondo `urgent-bg`, ícono de teléfono, nombre de la línea y botón de llamar (`tel:`). Aparece **antes** de publicar la alerta si la persona indica peligro inmediato, y siempre accesible desde el chat. Argentina: 135 / (011) 5275-1135 (Asistencia al Suicida), 144 (violencia de género), 137 (violencia familiar/sexual), 102 (niñez y adolescencia), 911.

### Burbujas de chat
- Propias: `primary-tint`, esquina inferior derecha más cerrada.
- De quien ayuda: `surface` con `hairline`, esquina inferior izquierda más cerrada, con su nombre de pila y rol verificado ("Lucía · psicóloga verificada") en `embrace`.
- Indicador "está escribiendo…" con tres puntos que respiran, no que saltan.
- Sin "visto" ni conteo de tiempo de respuesta del lado de la persona.

### Mapa (solo ayudantes)
Zonas difusas `embrace-soft` al 28% de opacidad, radio ≥2 km, sin centro exacto. Estilo de mapa de Google personalizado: tonos crema, calles en `hairline`, agua en `vol-air`, sin POIs comerciales.

### Tarjeta de alerta (ayudantes)
Tipo de situación (chip), zona aproximada, hace cuánto, idioma, y una sola acción: "Tomar esta conversación". Al tomarla, queda bloqueada para los demás.

## Voz y microcopy

Español rioplatense, voseo, tono humano, frases cortas.

| Sí | No |
|---|---|
| "Gracias por escribir. Acá estamos." | "Alerta enviada correctamente." |
| "No tenés que contar nada que no quieras." | "Complete todos los campos obligatorios." |
| "¿Estás en peligro ahora mismo?" | "Nivel de riesgo (1–10)" |
| "Estamos buscando a alguien para vos." | "Esperando asignación…" |
| "Lo que sentís importa." | "No es para tanto" / "Ánimo, todo pasa" |
| "Podés salir cuando quieras." | Cualquier cosa que culpe, apure o juzgue |

- Nunca prometer tiempos ("alguien te responderá en 2 minutos").
- Nunca usar la palabra "caso", "ticket" ni "usuario" frente a la persona.
- Pedir consentimiento antes de cada dato ("¿Querés compartir tu zona aproximada? Sirve para encontrar a alguien cerca.").

## Principios informados en trauma (Chayn) aplicados

| Principio | Cómo se aplica en Abrigo |
|---|---|
| Seguridad | Salida rápida, zonas difusas, sin historial visible, nombre e ícono discretos al instalar, líneas de crisis siempre a mano |
| Agencia | Consentimiento por cada dato, la persona puede terminar la conversación o pedir otra persona en cualquier momento |
| Equidad | AA/AAA, Atkinson Hyperlegible, lectura fácil, funciona en celulares de gama baja y con mala conexión |
| Privacidad | Anonimato por defecto, borrado automático, nada de nombres reales requeridos |
| Rendición de cuentas | Explicar qué pasa con sus datos en lenguaje simple; poder reportar a quien ayuda |
| Pluralidad | Tipos de situación distintos (salud mental / violencia), no asumir género ni relación con el agresor |
| Compartir el poder | Co-diseñar y testear con sobrevivientes y profesionales antes de lanzar |
| Esperanza | Lenguaje cálido, imágenes y formas suaves, nunca imágenes tristes ni dramáticas |

## Do / Don't

**Do**
- Fondo `canvas` cálido, una sola acción principal por pantalla.
- Volúmenes de color suaves en el fondo, `aria-hidden`.
- Mostrar quién te está escuchando (nombre de pila + rol verificado).
- Dejar siempre una salida (salida rápida, terminar, pedir otra persona).

**Don't**
- Rojo, sirenas, signos de exclamación, conteos regresivos, vibraciones fuertes.
- Pines exactos en el mapa.
- Fotos de personas tristes, manos en la cara, lluvia, colores grises de "depresión".
- Pedir datos personales para pedir ayuda.
- Gamificación, badges o rankings de ayudantes visibles para quien pide ayuda.

## Fuentes
- ArchDaily — Teletón Infant Oncology Clinic / Sordo Madaleno Arquitectos.
- Designboom — HITO clinic in Querétaro.
- VoltAgent/awesome-design-md — Oura DESIGN.md (estructura y paleta base).
- Chayn — Trauma-informed design principles (vía promo.cymru).
