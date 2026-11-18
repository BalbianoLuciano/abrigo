/**
 * Tokens de docs/design/DESIGN.md. Si cambia el DESIGN.md, cambia acá.
 * El color abriga, nunca alarma: no hay rojo del lado de quien pide ayuda.
 */
export const lightColors = {
  canvas: "#F7F1E8",
  surface: "#FFFDF9",
  surfaceSunk: "#EFE7DB",
  hairline: "#E3D9CC",
  ink: "#2B2622",
  inkSoft: "#5A524B",
  // Oscurecido desde #857B71 (3,7:1) para cumplir AA sobre canvas, surface y surface-sunk.
  mute: "#70675D",
  primary: "#3F6B57",
  primaryHover: "#34594A",
  onPrimary: "#FFFDF9",
  primaryTint: "#E1EBE3",
  embrace: "#9A5537",
  embraceSoft: "#C98A6A",
  volSun: "#EBC98F",
  volLeaf: "#CCD8C2",
  volSkin: "#EDD3C4",
  volCalm: "#D9D3E8",
  volAir: "#CFE1E5",
  urgent: "#8A5A16",
  urgentBg: "#F6E6C8",
  success: "#3F6B57",
  /** SOLO validación de formularios del lado ayudante/admin. */
  dangerForm: "#A1483A",
  focusRing: "#3F6B57",
} as const;

export type ColorName = keyof typeof lightColors;
export type Colors = Record<ColorName, string>;

export const darkColors: Colors = {
  canvas: "#1B1815",
  surface: "#25211D",
  surfaceSunk: "#16130F",
  hairline: "#3A342D",
  ink: "#F1E9DE",
  inkSoft: "#C9BEB1",
  mute: "#998E82",
  primary: "#8FBBA3",
  primaryHover: "#A6CBB6",
  onPrimary: "#14211B",
  primaryTint: "#2A3A32",
  embrace: "#E2A182",
  embraceSoft: "#B9775A",
  volSun: "#5E4A2A",
  volLeaf: "#3A4637",
  volSkin: "#56403A",
  volCalm: "#3F3A50",
  volAir: "#334548",
  urgent: "#EBC27F",
  urgentBg: "#3E321F",
  success: "#8FBBA3",
  dangerForm: "#E08B7C",
  focusRing: "#8FBBA3",
};

/** Nombres con los que se cargan las fuentes (ver apps/mobile, useFonts). */
export const fontFamilies = {
  serif: "Fraunces_400Regular",
  serifMedium: "Fraunces_500Medium",
  sans: "AtkinsonHyperlegibleNext_400Regular",
  sansBold: "AtkinsonHyperlegibleNext_700Bold",
} as const;

export const typography = {
  display: { fontFamily: fontFamilies.serif, fontSize: 40, lineHeight: 46 },
  heading: { fontFamily: fontFamilies.serifMedium, fontSize: 28, lineHeight: 34 },
  title: { fontFamily: fontFamilies.sansBold, fontSize: 20, lineHeight: 27 },
  body: { fontFamily: fontFamilies.sans, fontSize: 18, lineHeight: 29 },
  bodySm: { fontFamily: fontFamilies.sans, fontSize: 16, lineHeight: 25 },
  button: { fontFamily: fontFamilies.sansBold, fontSize: 17, lineHeight: 20 },
  caption: { fontFamily: fontFamilies.sans, fontSize: 14, lineHeight: 20 },
} as const;

export type TypographyVariant = keyof typeof typography;

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, full: 9999 } as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const motion = {
  quick: 160,
  base: 280,
  slow: 420,
  /** Ciclo de respiración: 4 s inhalar, 4 s exhalar. */
  breathCycle: 8000,
  easing: [0.22, 1, 0.36, 1] as const,
} as const;

export const touch = { minTarget: 48 } as const;

/** Ancho máximo de lectura. */
export const READING_WIDTH = 640;
