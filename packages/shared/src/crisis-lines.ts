import type { AlertPath } from "./constants.js";

export interface CrisisLine {
  id: string;
  name: string;
  /** Número tal como se marca. */
  phone: string;
  /** Cómo se muestra el número, si difiere de cómo se marca. */
  display?: string;
  description: string;
}

/** Líneas oficiales de Argentina. Revisar periódicamente que sigan vigentes. */
export const CRISIS_LINES = {
  suicide: {
    id: "suicide",
    name: "Asistencia al Suicida",
    phone: "135",
    description: "Desde CABA y GBA. Desde todo el país: (011) 5275-1135",
  },
  suicideNational: {
    id: "suicideNational",
    name: "Asistencia al Suicida (todo el país)",
    phone: "01152751135",
    display: "(011) 5275-1135",
    description: "Atención las 24 h desde cualquier lugar del país",
  },
  genderViolence: {
    id: "genderViolence",
    name: "Violencia de género",
    phone: "144",
    description: "Atención las 24 h, gratuita y confidencial",
  },
  familyViolence: {
    id: "familyViolence",
    name: "Violencia familiar y sexual",
    phone: "137",
    description: "Atención las 24 h",
  },
  childhood: {
    id: "childhood",
    name: "Niñez y adolescencia",
    phone: "102",
    description: "Para chicos, chicas y adolescentes",
  },
  emergency: {
    id: "emergency",
    name: "Emergencias",
    phone: "911",
    description: "Si hay riesgo de vida inmediato",
  },
} as const satisfies Record<string, CrisisLine>;

export const CRISIS_LINES_BY_PATH: Record<AlertPath, readonly CrisisLine[]> = {
  mental_health: [CRISIS_LINES.suicide, CRISIS_LINES.suicideNational, CRISIS_LINES.emergency],
  violence: [CRISIS_LINES.genderViolence, CRISIS_LINES.familyViolence, CRISIS_LINES.emergency],
};

/** Para menores de 18: no se crea alerta, se deriva a la línea 102. */
export const UNDERAGE_LINES: readonly CrisisLine[] = [
  CRISIS_LINES.childhood,
  CRISIS_LINES.emergency,
];
