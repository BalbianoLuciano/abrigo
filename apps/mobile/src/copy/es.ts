/**
 * Textos de quien pide ayuda, centralizados para revisión con especialistas y
 * una futura traducción. Voz: rioplatense, cálida, sin prometer tiempos.
 * PENDIENTE: validar con profesionales de salud mental y sobrevivientes.
 */
export const t = {
  home: {
    title: "¿Necesitás que alguien te escuche?",
    body: "Podés pedirlo sin dar tu nombre. Del otro lado hay profesionales y voluntarios verificados.",
    cta: "Quiero que alguien me escuche",
    lines: "Ver líneas de ayuda",
    notEmergency: "Abrigo no reemplaza a un servicio de emergencias.",
    eraseAll: "Borrar todo de este dispositivo",
    helperLink: "Soy profesional o voluntario/a",
    resume: "Volver a tu conversación",
    resumeWaiting: "Seguir esperando",
  },
  age: {
    title: "¿Tenés 18 años o más?",
    yes: "Sí, tengo 18 o más",
    no: "No, tengo menos de 18",
  },
  underage: {
    title: "Hay personas para escucharte",
    body: "Abrigo es para personas de 18 años o más. La línea 102 atiende a chicos, chicas y adolescentes, es gratis y confidencial.",
  },
  path: {
    title: "¿Qué te está pasando?",
    hint: "No tenés que contar nada que no quieras.",
    mental: "Me siento muy mal o pienso en hacerme daño",
    violence: "Estoy sufriendo violencia",
  },
  danger: {
    title: "¿Estás en peligro ahora mismo?",
    yes: "Sí",
    unsure: "No sé",
    no: "No",
    linesIntro:
      "Tu vida es lo primero. Si podés, llamá ahora. Igual vamos a buscar a alguien para vos.",
  },
  violence: {
    safeTitle: "¿Tenés un momento seguro para escribir?",
    safeYes: "Sí, ahora puedo",
    safeLittle: "Un ratito",
    safeNo: "No mucho, puede que tenga que irme",
    genderTitle: "¿Preferís que te escriba una mujer?",
    genderWoman: "Sí, prefiero una mujer",
    genderAny: "Me da igual",
    genderHint: "Es opcional. Lo vamos a respetar.",
  },
  zone: {
    title: "¿Querés compartir tu zona aproximada?",
    body: "Sirve para encontrar a alguien cerca, que conozca los lugares de ayuda de tu zona. Nunca guardamos tu ubicación exacta: solo una zona amplia.",
    gps: "Usar mi zona aproximada",
    province: "Elegir mi provincia",
    none: "Prefiero no",
    locating: "Buscando tu zona…",
    gpsFailed: "No pudimos obtener tu zona. Podés elegir tu provincia o seguir sin compartirla.",
  },
  consent: {
    title: "Antes de enviar",
    items: [
      "No guardamos tu nombre, teléfono ni email.",
      "Si compartiste tu zona, guardamos solo una zona amplia, nunca tu ubicación exacta.",
      "Los mensajes se guardan cifrados y se borran 30 días después de terminar la conversación.",
      "Podés terminar la conversación, pedir otra persona o borrar todo cuando quieras.",
      "Abrigo no reemplaza a un servicio de salud ni de emergencias.",
    ],
    accept: "Entiendo y quiero enviar mi pedido",
    terms: "Leer la política de privacidad",
  },
  waiting: {
    title: "Gracias por escribir. Acá estamos.",
    body: "Estamos buscando a alguien para vos.",
    breathe: "Respirá con el círculo mientras alguien llega.",
    meanwhile: "Mientras tanto podés llamar a:",
    notify: "Avisame cuando alguien responda",
    notifyOn: "Te vamos a avisar cuando alguien responda.",
    claimed: "Alguien tomó tu pedido y te va a escribir.",
    cancel: "Cancelar mi pedido",
    closedNoResponse:
      "Esta vez no encontramos a alguien disponible. Lo sentimos mucho. Las líneas de ayuda atienden ahora, y podés volver a intentarlo.",
    retry: "Volver a pedir",
  },
  chat: {
    composer: "Escribí tu mensaje",
    send: "Enviar",
    typing: "está escribiendo…",
    verified: "verificada/o",
    end: "Terminar la conversación",
    another: "Pedir otra persona",
    report: "Reportar",
    lines: "Líneas de ayuda",
    closedByHelper: "La conversación terminó. Gracias por animarte a escribir.",
    closedByYou: "Terminaste la conversación. Podés volver cuando quieras.",
    released: "La persona que te acompañaba ya no está disponible. Estamos buscando a alguien más.",
    endConfirm: "¿Querés terminar la conversación?",
    anotherConfirm: "Vamos a buscar a otra persona para vos. ¿Seguimos?",
    reportTitle: "¿Qué pasó?",
    reportSent: "Gracias por avisarnos. Lo vamos a revisar.",
  },
  erase: {
    title: "Borrar todo",
    body: "Se borra tu sesión de este dispositivo y los mensajes guardados en Abrigo. No se puede deshacer.",
    confirm: "Sí, borrar todo",
    done: "Listo. No quedó nada de Abrigo en este dispositivo.",
  },
  common: {
    continue: "Continuar",
    back: "Volver",
    cancel: "No, volver",
    error: "Algo no funcionó. Probá de nuevo en un momento.",
  },
} as const;

export const reportReasons = [
  { value: "disrespect", label: "Me faltó el respeto" },
  { value: "inappropriate", label: "Dijo algo inapropiado" },
  { value: "asked_personal_data", label: "Me pidió datos personales" },
  { value: "spam", label: "No era una persona real o era spam" },
  { value: "other", label: "Otra cosa" },
] as const;
