import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from "react-native";
import { Text } from "./text";
import { useTheme } from "./theme";
import { radius, spacing } from "./tokens";

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: "primary" | "secondary" | "quiet";
  loading?: boolean;
  /** Ancho completo (por defecto en mobile). */
  block?: boolean;
}

/** Una sola acción principal por pantalla: `primary`. Todo lo demás, `secondary` o `quiet`. */
export function Button({
  label,
  variant = "primary",
  loading = false,
  block = true,
  disabled,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "secondary"
        ? colors.surface
        : "transparent";
  const fg =
    variant === "primary" ? colors.onPrimary : variant === "quiet" ? colors.primary : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed && variant === "primary" ? colors.primaryHover : bg,
          borderColor: variant === "secondary" ? colors.hairline : "transparent",
          minHeight: variant === "primary" ? 56 : 52,
          alignSelf: block ? "stretch" : "flex-start",
          opacity: isDisabled ? 0.55 : 1,
        },
      ]}
      {...rest}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={fg} /> : null}
        <Text variant="button" style={{ color: fg, textAlign: "center" }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
});
