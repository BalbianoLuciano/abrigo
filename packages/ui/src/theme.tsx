import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { darkColors, lightColors, type Colors } from "./tokens";

export interface Theme {
  scheme: "light" | "dark";
  colors: Colors;
}

const ThemeContext = createContext<Theme>({ scheme: "light", colors: lightColors });

/** Modo noche como ciudadano de primera clase: sigue la preferencia del sistema. */
export function ThemeProvider({
  children,
  scheme: forced,
}: {
  children: ReactNode;
  scheme?: "light" | "dark";
}) {
  const system = useColorScheme();
  const scheme = forced ?? (system === "dark" ? "dark" : "light");
  const value = useMemo<Theme>(
    () => ({ scheme, colors: scheme === "dark" ? darkColors : lightColors }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
