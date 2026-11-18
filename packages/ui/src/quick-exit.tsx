import { Pressable, StyleSheet } from "react-native";
import { Text } from "./text";
import { useTheme } from "./theme";
import { radius, spacing } from "./tokens";

/**
 * Botón de salida rápida, fijo arriba a la derecha. El comportamiento (reemplazar
 * la historia, limpiar lo visible) lo inyecta la app.
 */
export function QuickExitButton({ onExit }: { onExit: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Salir rápido de Abrigo"
      accessibilityHint="Te lleva a otra página. También funciona tocando Escape dos veces."
      onPress={onExit}
      style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.hairline }]}
    >
      <Text variant="button">Salir</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 100,
    minHeight: 48,
    minWidth: 72,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
