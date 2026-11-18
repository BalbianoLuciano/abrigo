import { describe, expect, it } from "vitest";
import { createAlertSchema } from "./alerts.js";
import { requiresCrisisLines } from "./constants.js";
import { CRISIS_LINES_BY_PATH, UNDERAGE_LINES } from "./crisis-lines.js";

describe("createAlertSchema", () => {
  const base = { ageConfirmed: true, consentAccepted: true, dangerNow: "no" } as const;

  it("acepta una alerta de salud mental sin datos de ubicación", () => {
    expect(createAlertSchema.safeParse({ ...base, path: "mental_health" }).success).toBe(true);
  });

  it("acepta las preferencias propias del camino de violencia", () => {
    const result = createAlertSchema.safeParse({
      ...base,
      path: "violence",
      safeTimeToWrite: "little",
      helperGenderPref: "woman",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza a quien no confirmó ser mayor de edad", () => {
    expect(
      createAlertSchema.safeParse({ ...base, ageConfirmed: false, path: "mental_health" }).success,
    ).toBe(false);
  });

  it("rechaza coordenadas en lugar de una celda H3", () => {
    expect(
      createAlertSchema.safeParse({ ...base, path: "mental_health", h3Cell: "-34.6037,-58.3816" })
        .success,
    ).toBe(false);
  });
});

describe("createAlertSchema con peligro", () => {
  const base = { ageConfirmed: true, consentAccepted: true, path: "mental_health" } as const;

  it("exige que las líneas se hayan mostrado si hay peligro o duda", () => {
    for (const dangerNow of ["yes", "unsure"] as const) {
      expect(createAlertSchema.safeParse({ ...base, dangerNow }).success).toBe(false);
      expect(
        createAlertSchema.safeParse({
          ...base,
          dangerNow,
          crisisLinesShownAt: new Date().toISOString(),
        }).success,
      ).toBe(true);
    }
  });
});

describe("líneas de crisis", () => {
  it("se muestran ante peligro o duda", () => {
    expect(requiresCrisisLines("yes")).toBe(true);
    expect(requiresCrisisLines("unsure")).toBe(true);
    expect(requiresCrisisLines("no")).toBe(false);
  });

  it("cada camino incluye el 911", () => {
    for (const lines of Object.values(CRISIS_LINES_BY_PATH)) {
      expect(lines.some((l) => l.phone === "911")).toBe(true);
    }
  });

  it("los menores son derivados a la línea 102", () => {
    expect(UNDERAGE_LINES.map((l) => l.phone)).toContain("102");
  });
});
