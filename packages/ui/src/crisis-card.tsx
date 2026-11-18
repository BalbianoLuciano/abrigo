import type { CrisisLine } from "@abrigo/shared/client";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./text";
import { useTheme } from "./theme";
import { radius, spacing } from "./tokens";

/**
 * Tarjeta de líneas de crisis. Ámbar, no rojo: dice "esto es importante" sin gritar.
 */
export function CrisisLineCard({
  lines,
  title = "Si estás en peligro ahora, estas líneas atienden ya",
}: {
  lines: readonly CrisisLine[];
  title?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="summary"
      style={[styles.card, { backgroundColor: colors.urgentBg, borderColor: colors.urgent }]}
    >
      <Text variant="title" color="ink">
        {title}
      </Text>
      {lines.map((line) => (
        <View key={line.id} style={styles.line}>
          <View style={styles.lineText}>
            <Text variant="body" style={{ fontWeight: "700" }}>
              {line.name}
            </Text>
            <Text variant="bodySm" color="inkSoft">
              {line.description}
            </Text>
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Llamar a ${line.name}, ${line.display ?? line.phone}`}
            onPress={() => Linking.openURL(`tel:${line.phone}`)}
            style={[styles.call, { borderColor: colors.urgent, backgroundColor: colors.surface }]}
          >
            <Text variant="button" style={{ color: colors.urgent }}>
              Llamar al {line.display ?? line.phone}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderLeftWidth: 4 },
  line: { gap: spacing.xs },
  lineText: { gap: 2 },
  call: {
    minHeight: 48,
    borderRadius: radius.full,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
});
