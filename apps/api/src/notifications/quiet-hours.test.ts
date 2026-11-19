import { describe, expect, it } from "vitest";
import { argentinaMinuteOfDay, isQuiet } from "./quiet-hours.js";

describe("horario de silencio", () => {
  it("sin horario nunca silencia", () => {
    expect(isQuiet(null, null, 600)).toBe(false);
  });
  it("tramo dentro del día", () => {
    expect(isQuiet(13 * 60, 15 * 60, 14 * 60)).toBe(true);
    expect(isQuiet(13 * 60, 15 * 60, 15 * 60)).toBe(false);
  });
  it("tramo que cruza la medianoche", () => {
    expect(isQuiet(23 * 60, 7 * 60, 23 * 60 + 30)).toBe(true);
    expect(isQuiet(23 * 60, 7 * 60, 3 * 60)).toBe(true);
    expect(isQuiet(23 * 60, 7 * 60, 12 * 60)).toBe(false);
  });
  it("usa la hora de Argentina", () => {
    expect(argentinaMinuteOfDay(new Date("2026-11-19T03:00:00Z"))).toBe(0);
  });
});
