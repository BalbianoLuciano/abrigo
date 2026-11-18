import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./text";
import { useTheme } from "./theme";
import { radius, spacing } from "./tokens";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** Opciones grandes, una por fila. Para preguntas de una sola respuesta. */
export function ChoiceList<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.list}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={opt.hint ? `${opt.label}. ${opt.hint}` : opt.label}
            onPress={() => onChange(opt.value)}
            style={[
              styles.option,
              {
                backgroundColor: selected ? colors.primaryTint : colors.surface,
                borderColor: selected ? colors.primary : colors.hairline,
              },
            ]}
          >
            <Text variant="body" style={{ fontWeight: selected ? "700" : "400" }}>
              {opt.label}
            </Text>
            {opt.hint ? (
              <Text variant="bodySm" color="inkSoft">
                {opt.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  option: {
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    gap: spacing.xxs,
  },
});
