import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "./theme";
import { READING_WIDTH, radius, spacing } from "./tokens";
import { Volumes } from "./volumes";

/** Pantalla con canvas cálido, ancho de lectura de 640 y aire generoso. */
export function Screen({
  children,
  volumes = false,
  scroll = true,
  footer,
}: {
  children: ReactNode;
  volumes?: boolean;
  scroll?: boolean;
  footer?: ReactNode;
}) {
  const { colors } = useTheme();
  const body = <View style={styles.column}>{children}</View>;
  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      {volumes ? <Volumes /> : null}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        <View style={styles.scroll}>{body}</View>
      )}
      {footer ? <View style={[styles.column, styles.footer]}>{footer}</View> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.xl,
          gap: spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Stack({
  children,
  gap = "md",
}: {
  children: ReactNode;
  gap?: keyof typeof spacing;
}) {
  return <View style={{ gap: spacing[gap] }}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: 72, paddingBottom: spacing.xl },
  column: { width: "100%", maxWidth: READING_WIDTH, alignSelf: "center", gap: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
});
