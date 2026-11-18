import { QuickExitButton, useTheme } from "@abrigo/ui";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { installEscapeShortcut, quickExit } from "@/lib/quick-exit";

/** Todo lo de quien pide ayuda: salida rápida siempre visible y Esc dos veces. */
export default function PersonaLayout() {
  const { colors } = useTheme();
  useEffect(() => installEscapeShortcut(), []);
  return (
    <View style={{ flex: 1 }}>
      {/* Primero en el orden de foco del teclado. */}
      <QuickExitButton onExit={quickExit} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
    </View>
  );
}
